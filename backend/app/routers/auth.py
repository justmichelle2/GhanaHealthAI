import hmac
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import DUMMY_PASSWORD_HASH, create_access_token, hash_password, new_csrf_token, verify_password
from app.dependencies import get_current_user, require_role
from app.models import AuditLog, PatientProfile, User, UserRole
from app.schemas import LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])
ACCESS_COOKIE = "gha_access"
CSRF_COOKIE = "gha_csrf"

def check_csrf(cookie_token: str | None, header_token: str | None) -> None:
    if not cookie_token or not header_token or not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

def set_session(response: Response, user: User, csrf_token: str) -> None:
    settings = get_settings()
    age = settings.access_token_expire_minutes * 60
    response.set_cookie(ACCESS_COOKIE, create_access_token(str(user.id)), max_age=age, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/")
    response.set_cookie(CSRF_COOKIE, csrf_token, max_age=age, httponly=False, secure=settings.secure_cookies, samesite="lax", path="/")

@router.get("/csrf", status_code=204)
def issue_csrf(response: Response) -> None:
    settings = get_settings()
    response.set_cookie(CSRF_COOKIE, new_csrf_token(), httponly=False, secure=settings.secure_cookies, samesite="lax", path="/")

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
    set_session(response, user, new_csrf_token())
    return user

@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response, csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE), csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"), db: Session = Depends(get_db)) -> User:
    check_csrf(csrf_cookie, csrf_header)
    user = db.scalar(select(User).where(User.email == str(payload.email)))
    matches = verify_password(payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if user is None or not matches or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    set_session(response, user, new_csrf_token())
    db.add(AuditLog(actor_user_id=user.id, action="login", resource_type="user", resource_id=str(user.id)))
    db.commit()
    return user

@router.get("/me", response_model=UserResponse)
def who_am_i(user: User = Depends(get_current_user)) -> User:
    return user

@router.post("/logout", status_code=204)
def logout(response: Response, csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE), csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"), user: User = Depends(get_current_user)) -> None:
    check_csrf(csrf_cookie, csrf_header)
    response.delete_cookie(ACCESS_COOKIE, path="/", samesite="lax")
    response.delete_cookie(CSRF_COOKIE, path="/", samesite="lax")

@router.get("/patient", response_model=UserResponse)
def patient_access(user: User = Depends(require_role(UserRole.PATIENT))) -> User:
    return user

@router.get("/doctor", response_model=UserResponse)
def doctor_access(user: User = Depends(require_role(UserRole.DOCTOR))) -> User:
    return user

@router.get("/admin", response_model=UserResponse)
def admin_access(user: User = Depends(require_role(UserRole.ADMIN))) -> User:
    return user
