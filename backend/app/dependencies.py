from uuid import UUID
import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User, UserRole

def get_current_user(access_token: str | None = Cookie(default=None, alias="gha_access"), db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not access_token:
        raise unauthorized
    try:
        claims = decode_access_token(access_token)
        user_id = UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, RuntimeError):
        raise unauthorized from None
    user = db.get(User, user_id)
    if user is None or not user.is_active or claims.get("ver", 0) != user.session_version:
        raise unauthorized
    return user

def require_role(role: UserRole):
    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role != role.value:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        if role == UserRole.DOCTOR and (not user.doctor_profile or not user.doctor_profile.is_verified):
            raise HTTPException(status_code=403, detail="Verified doctor access required")
        return user
    return role_dependency
