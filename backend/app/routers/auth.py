import hmac
import hashlib
import jwt
import logging
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Header, HTTPException, Request, Response
from sqlalchemy import case, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import DUMMY_PASSWORD_HASH, create_access_token, create_refresh_token, decode_access_token, hash_password, new_csrf_token, verify_password
from app.dependencies import get_current_user, require_role
from app.models import AuditLog, PasswordResetToken, PatientProfile, RateLimitBucket, RefreshToken, User, UserRole
from app.schemas import LoginRequest, PasswordResetConfirm, PasswordResetRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger("ghana_health.auth")
ACCESS_COOKIE = "gha_access"
CSRF_COOKIE = "gha_csrf"
REFRESH_COOKIE = "gha_refresh"

def check_csrf(cookie_token: str | None, header_token: str | None) -> None:
    if not cookie_token or not header_token or not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def send_email(recipient: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.email_configured:
        raise RuntimeError("Email provider is not configured")
    message = EmailMessage()
    message["From"] = settings.smtp_sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    if settings.smtp_port == 465:
        connection = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10, context=ssl.create_default_context())
    else:
        connection = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
    with connection as client:
        if settings.smtp_port != 465:
            client.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password or "")
        client.send_message(message)

def deliver_email_safely(recipient: str, subject: str, body: str, label: str) -> None:
    try:
        send_email(recipient, subject, body)
    except Exception as exc:
        # Never log the address, message, reset URL, or token.
        logger.warning("%s delivery failed (%s)", label, type(exc).__name__)

def enforce_limit(db: Session, key: str, *, maximum: int, window: timedelta, now: datetime) -> bool:
    digest = token_digest(key)
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        cutoff = now - window
        reset_window = RateLimitBucket.window_started_at <= cutoff
        statement = pg_insert(RateLimitBucket).values(key_hash=digest, window_started_at=now, attempts=1)
        statement = statement.on_conflict_do_update(
            index_elements=[RateLimitBucket.key_hash],
            set_={
                "attempts": case((reset_window, 1), else_=RateLimitBucket.attempts + 1),
                "window_started_at": case((reset_window, now), else_=RateLimitBucket.window_started_at),
            },
        ).returning(RateLimitBucket.attempts)
        return db.execute(statement).scalar_one() <= maximum
    bucket = db.scalar(select(RateLimitBucket).where(RateLimitBucket.key_hash == digest).with_for_update())
    if bucket is None:
        db.add(RateLimitBucket(key_hash=digest, window_started_at=now, attempts=1))
        db.flush()
        return True
    window_started = bucket.window_started_at if bucket.window_started_at.tzinfo else bucket.window_started_at.replace(tzinfo=timezone.utc)
    if window_started <= now - window:
        bucket.window_started_at = now
        bucket.attempts = 1
        return True
    if bucket.attempts >= maximum:
        return False
    bucket.attempts += 1
    return True

def set_session(response: Response, user: User, csrf_token: str, db: Session) -> None:
    settings = get_settings()
    age = settings.access_token_expire_minutes * 60
    response.set_cookie(ACCESS_COOKIE, create_access_token(str(user.id), user.session_version), max_age=age, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/")
    response.set_cookie(CSRF_COOKIE, csrf_token, max_age=age, httponly=False, secure=settings.secure_cookies, samesite="lax", path="/")
    now = datetime.now(timezone.utc)
    raw_refresh = secrets.token_urlsafe(48)
    refresh = RefreshToken(
        user_id=user.id,
        token_hash=token_digest(raw_refresh),
        expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        created_at=now,
    )
    db.add(refresh)
    response.set_cookie(REFRESH_COOKIE, raw_refresh, max_age=settings.refresh_token_expire_days * 86400, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/")

@router.get("/csrf", status_code=204)
def issue_csrf(response: Response) -> None:
    settings = get_settings()
    response.set_cookie(CSRF_COOKIE, new_csrf_token(), httponly=False, secure=settings.secure_cookies, samesite="lax", path="/")

RESET_MESSAGE = "If an account matches that email address, password reset instructions will be sent shortly."

@router.post("/password-reset/request", status_code=202)
def request_password_reset(payload: PasswordResetRequest, request: Request, background_tasks: BackgroundTasks,
                           csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE),
                           csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
                           db: Session = Depends(get_db)) -> dict[str, str]:
    check_csrf(csrf_cookie, csrf_header)
    now = datetime.now(timezone.utc)
    email = str(payload.email).strip().lower()
    ip = request.client.host if request.client else "unknown"
    allowed_email = enforce_limit(db, "reset-email:" + email, maximum=3, window=timedelta(hours=1), now=now)
    allowed_ip = enforce_limit(db, "reset-ip:" + ip, maximum=10, window=timedelta(hours=1), now=now)
    if not allowed_email or not allowed_ip:
        db.commit()
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    settings = get_settings()
    if user and settings.email_configured:
        raw_token = secrets.token_urlsafe(32)
        reset = PasswordResetToken(user_id=user.id, token_hash=token_digest(raw_token),
                                   expires_at=now + timedelta(minutes=max(5, min(settings.password_reset_minutes, 60))))
        db.add(reset)
        for old in db.scalars(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))):
            old.used_at = now
        db.add(AuditLog(actor_user_id=user.id, action="password_reset_requested", resource_type="user", resource_id=str(user.id)))
        db.commit()
        reset_url = settings.frontend_url.rstrip("/") + "/#reset/" + raw_token
        background_tasks.add_task(deliver_email_safely, user.email, "Reset your Ghana Health Assistant password",
                                  "A password reset was requested for your account. This link expires soon and can only be used once:\n\n" + reset_url + "\n\nIf you did not request this, you can ignore this email.",
                                  "Password reset email")
    else:
        db.commit()
    return {"message": RESET_MESSAGE}

@router.post("/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm, request: Request, background_tasks: BackgroundTasks,
                           db: Session = Depends(get_db)) -> dict[str, str]:
    now = datetime.now(timezone.utc)
    ip = request.client.host if request.client else "unknown"
    if not enforce_limit(db, "reset-confirm-ip:" + ip, maximum=20, window=timedelta(minutes=10), now=now):
        db.commit()
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new reset link later.")
    reset = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_digest(payload.token)).with_for_update())
    expiry = reset.expires_at if reset and reset.expires_at.tzinfo else (reset.expires_at.replace(tzinfo=timezone.utc) if reset else now)
    if reset is None or reset.used_at is not None or expiry <= now:
        raise HTTPException(status_code=400, detail="This reset link is invalid or expired. Request a new one.")
    user = db.get(User, reset.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=400, detail="This reset link is invalid or expired. Request a new one.")
    reset.used_at = now
    user.password_hash = hash_password(payload.password)
    user.session_version += 1
    db.add(AuditLog(actor_user_id=user.id, action="password_changed", resource_type="user", resource_id=str(user.id)))
    db.commit()
    background_tasks.add_task(deliver_email_safely, user.email, "Your Ghana Health Assistant password was changed",
                              "Your account password was changed. If you did not make this change, contact the service administrator.",
                              "Password change notification")
    return {"message": "Your password has been changed. You can now sign in."}

@router.post("/register", response_model=UserResponse, status_code=201)
def register(payload: RegisterRequest, response: Response, csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE), csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"), db: Session = Depends(get_db)) -> User:
    check_csrf(csrf_cookie, csrf_header)
    try:
        create_access_token("configuration-check")
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Authentication is not configured") from None
    user = User(email=str(payload.email), password_hash=hash_password(payload.password), role=UserRole.PATIENT.value)
    user.patient_profile = PatientProfile(full_name=payload.full_name, preferred_language=payload.preferred_language)
    db.add(user)
    try:
        db.flush()
        db.add(AuditLog(actor_user_id=user.id, action="patient_registered", resource_type="user", resource_id=str(user.id)))
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists") from None
    set_session(response, user, new_csrf_token(), db)
    return user

@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, request: Request, response: Response, csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE), csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"), db: Session = Depends(get_db)) -> User:
    check_csrf(csrf_cookie, csrf_header)
    now = datetime.now(timezone.utc)
    ip = request.client.host if request.client else "unknown"
    email = str(payload.email).strip().lower()
    allowed_email = enforce_limit(db, "login-email:" + email, maximum=10, window=timedelta(minutes=10), now=now)
    allowed_ip = enforce_limit(db, "login-ip:" + ip, maximum=40, window=timedelta(minutes=10), now=now)
    if not allowed_email or not allowed_ip:
        db.commit()
        raise HTTPException(status_code=429, detail="Too many sign-in attempts. Please try again later.")
    user = db.scalar(select(User).where(User.email == email))
    matches = verify_password(payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if user is None or not matches or not user.is_active:
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")
    set_session(response, user, new_csrf_token(), db)
    db.add(AuditLog(actor_user_id=user.id, action="login", resource_type="user", resource_id=str(user.id)))
    db.commit()
    return user

@router.get("/me", response_model=UserResponse)
def who_am_i(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/refresh", status_code=200)
def refresh_session(response: Response, csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE), csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"), refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE), db: Session = Depends(get_db)) -> dict[str, str]:
    settings = get_settings()
    check_csrf(csrf_cookie, csrf_header)
    if not refresh_cookie:
        raise HTTPException(status_code=401, detail="No refresh token")
    now = datetime.now(timezone.utc)
    refresh = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_digest(refresh_cookie)))
    if refresh is None or refresh.revoked_at is not None or refresh.expires_at <= now:
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")
    user = db.get(User, refresh.user_id)
    if user is None or not user.is_active or refresh.session_version != user.session_version:
        raise HTTPException(status_code=401, detail="Session revoked")
    refresh.revoked_at = now
    raw_refresh = secrets.token_urlsafe(48)
    db.add(RefreshToken(user_id=user.id, token_hash=token_digest(raw_refresh), expires_at=now + timedelta(days=settings.refresh_token_expire_days), session_version=user.session_version, created_at=now))
    db.add(AuditLog(actor_user_id=user.id, action="token_refreshed", resource_type="user", resource_id=str(user.id)))
    db.commit()
    response.set_cookie(REFRESH_COOKIE, raw_refresh, max_age=settings.refresh_token_expire_days * 86400, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/")
    response.set_cookie(ACCESS_COOKIE, create_access_token(str(user.id), user.session_version), max_age=settings.access_token_expire_minutes * 60, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/")
    return {"status": "refreshed"}


@router.post("/logout", status_code=204)
def logout(response: Response, request: Request, refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE), csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE), csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"), db: Session = Depends(get_db)) -> None:
    check_csrf(csrf_cookie, csrf_header)
    user = None
    access_cookie = request.cookies.get(ACCESS_COOKIE)
    if access_cookie:
        try:
            claims = decode_access_token(access_cookie)
            user = db.get(User, UUID(claims["sub"]))
        except (jwt.PyJWTError, KeyError, ValueError):
            pass
    if refresh_cookie:
        refresh = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_digest(refresh_cookie)))
        if refresh is not None:
            if user is None or str(user.id) != str(refresh.user_id):
                user = db.get(User, refresh.user_id)
            refresh.revoked_at = datetime.now(timezone.utc)
    if user is not None:
        db.add(AuditLog(actor_user_id=user.id, action="logout", resource_type="user", resource_id=str(user.id)))
    db.commit()
    response.delete_cookie(ACCESS_COOKIE, path="/", samesite="lax")
    response.delete_cookie(CSRF_COOKIE, path="/", samesite="lax")
    response.delete_cookie(REFRESH_COOKIE, path="/", samesite="lax")

@router.get("/patient", response_model=UserResponse)
def patient_access(user: User = Depends(require_role(UserRole.PATIENT))) -> User:
    return user

@router.get("/doctor", response_model=UserResponse)
def doctor_access(user: User = Depends(require_role(UserRole.DOCTOR))) -> User:
    return user

@router.get("/admin", response_model=UserResponse)
def admin_access(user: User = Depends(require_role(UserRole.ADMIN))) -> User:
    return user
