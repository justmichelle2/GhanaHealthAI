from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import require_role
from app.models import AuditLog, Conversation, DoctorProfile, PatientProfile, User, UserRole
from app.schemas import AdminUserSummary, AuditLogResponse, UserStatusUpdate

router = APIRouter(prefix="/admin", tags=["administration"])


@router.get("/overview")
def overview(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    return {
        "users": db.scalar(select(func.count()).select_from(User)) or 0,
        "patients": db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.PATIENT.value)) or 0,
        "doctors_pending_verification": db.scalar(select(func.count()).select_from(DoctorProfile).where(DoctorProfile.is_verified.is_(False))) or 0,
        "submissions_pending_review": db.scalar(select(func.count()).select_from(Conversation).where(Conversation.status == "pending_review")) or 0,
    }


@router.get("/users", response_model=list[AdminUserSummary])
def list_users(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=200),
) -> list[dict]:
    statement = select(User).order_by(User.created_at.desc()).limit(limit)
    output = []
    for user in db.scalars(statement).all():
        doctor_profile = db.get(DoctorProfile, user.id)
        patient_profile = db.get(PatientProfile, user.id) if user.role == UserRole.PATIENT.value else None
        output.append({
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "display_name": doctor_profile.display_name if doctor_profile else patient_profile.full_name if patient_profile else None,
            "is_verified": doctor_profile.is_verified if doctor_profile else None,
            "professional_details": doctor_profile.professional_details if doctor_profile else None,
        })
    return output


@router.post("/doctors/{user_id}/verify", response_model=AdminUserSummary)
def verify_doctor(
    user_id: UUID,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    profile = db.get(DoctorProfile, user_id)
    if user is None or user.role != UserRole.DOCTOR.value or profile is None:
        raise HTTPException(status_code=404, detail="Doctor account not found")
    if not profile.is_verified:
        profile.is_verified = True
        db.add(AuditLog(actor_user_id=admin.id, action="doctor_verified", resource_type="user", resource_id=str(user.id)))
        db.commit()
        db.refresh(profile)
    return {"id": user.id, "email": user.email, "role": user.role, "is_active": user.is_active, "created_at": user.created_at, "display_name": profile.display_name, "is_verified": profile.is_verified, "professional_details": profile.professional_details}


@router.patch("/users/{user_id}/status", response_model=AdminUserSummary)
def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.id == admin.id and not payload.is_active:
        raise HTTPException(status_code=409, detail="Administrators cannot suspend their own account")
    if user.role == UserRole.ADMIN.value and user.is_active and not payload.is_active:
        active_admins = db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value, User.is_active.is_(True))) or 0
        if active_admins <= 1:
            raise HTTPException(status_code=409, detail="The last active administrator cannot be deactivated")
    user.is_active = payload.is_active
    db.add(AuditLog(actor_user_id=admin.id, action="user_activated" if user.is_active else "user_deactivated", resource_type="user", resource_id=str(user.id)))
    db.commit()
    db.refresh(user)
    profile = db.get(DoctorProfile, user.id)
    return {"id": user.id, "email": user.email, "role": user.role, "is_active": user.is_active, "created_at": user.created_at, "display_name": profile.display_name if profile else None, "is_verified": profile.is_verified if profile else None, "professional_details": profile.professional_details if profile else None}


@router.get("/audit-logs", response_model=list[AuditLogResponse])
def read_audit_logs(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=200),
) -> list[AuditLog]:
    return db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
