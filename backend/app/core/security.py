from datetime import datetime, timedelta, timezone
import secrets
import jwt
from pwdlib import PasswordHash
from app.core.config import get_settings

password_hash = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = password_hash.hash("not-a-real-user-password")

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        return password_hash.verify(password, encoded_hash)
    except Exception:
        return False
def create_access_token(subject: str, session_version: int = 0) -> str:
    settings = get_settings()
    if not settings.secret_key or len(settings.secret_key) < 32 or settings.secret_key.startswith(("replace-", "change-me")):
        raise RuntimeError("Set SECRET_KEY to a unique random value of at least 32 characters")
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": subject, "ver": session_version, "iat": now, "exp": now + timedelta(minutes=settings.access_token_expire_minutes)}, settings.secret_key, algorithm="HS256")


def create_refresh_token(subject: str, session_version: int = 0) -> str:
    settings = get_settings()
    if not settings.secret_key or len(settings.secret_key) < 32 or settings.secret_key.startswith(("replace-", "change-me")):
        raise RuntimeError("Set SECRET_KEY to a unique random value of at least 32 characters")
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": subject, "ver": session_version, "typ": "refresh", "iat": now, "exp": now + timedelta(days=settings.refresh_token_expire_days)}, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    if not settings.secret_key or len(settings.secret_key) < 32 or settings.secret_key.startswith(("replace-", "change-me")):
        raise RuntimeError("SECRET_KEY is not configured securely")
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])


def decode_refresh_token(token: str) -> dict:
    settings = get_settings()
    if not settings.secret_key or len(settings.secret_key) < 32 or settings.secret_key.startswith(("replace-", "change-me")):
        raise RuntimeError("SECRET_KEY is not configured securely")
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    if payload.get("typ") != "refresh":
        raise jwt.InvalidTokenError("not a refresh token")
    return payload

def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)
