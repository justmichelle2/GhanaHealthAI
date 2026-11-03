from datetime import datetime, timezone
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import require_role
from app.models import AuditLog, Conversation, ConversationMessage, PatientProfile, User, UserRole
from app.schemas import ConversationCreate, ConversationDetail, ConversationMessageCreate, ConversationRename, ConversationSummary, PatientProfileResponse, PatientProfileUpdate


router = APIRouter(prefix="/patient", tags=["patient profile"])


@router.get("/profile", response_model=PatientProfileResponse)
def read_profile(
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> PatientProfile:
    profile = db.get(PatientProfile, user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return profile


@router.patch("/profile", response_model=PatientProfileResponse)
def update_profile(
    payload: PatientProfileUpdate,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> PatientProfile:
    profile = db.get(PatientProfile, user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    if payload.full_name is not None:
        profile.full_name = " ".join(payload.full_name.split())
    profile.preferred_language = payload.preferred_language
    db.add(AuditLog(
        actor_user_id=user.id,
        action="patient_language_updated",
        resource_type="patient_profile",
        resource_id=str(user.id),
    ))
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    search: str | None = Query(default=None, max_length=100),
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> Any:
    statement = select(Conversation).where(Conversation.patient_user_id == user.id)
    if search and search.strip():
        statement = statement.where(Conversation.title.ilike(f"%{search.strip()}%"))
    statement = statement.order_by(Conversation.updated_at.desc()).limit(100)
    return db.scalars(statement).all()

@router.post("/conversations", response_model=ConversationSummary, status_code=201)
def create_conversation(
    payload: ConversationCreate,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> Conversation:
    conversation = Conversation(
        patient_user_id=user.id,
        # Keep message text out of sidebar titles to reduce accidental shoulder-surfing.
        title=f"Conversation {datetime.now(timezone.utc).date().isoformat()}",
        preferred_language=payload.preferred_language,
        status="pending_review",
        consented_at=datetime.now(timezone.utc),
    )
    conversation.messages.append(ConversationMessage(body=payload.message, sender_role="patient"))
    db.add(conversation)
    db.flush()
    db.add(AuditLog(actor_user_id=user.id, action="patient_message_submitted", resource_type="conversation", resource_id=str(conversation.id)))
    db.commit()
    db.refresh(conversation)
    return conversation

def owned_conversation(db: Session, user: User, conversation_id: UUID) -> Conversation:
    conversation = db.scalar(select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.patient_user_id == user.id,
    ))
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def read_conversation(
    conversation_id: UUID,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> Conversation:
    conversation = owned_conversation(db, user, conversation_id)
    conversation.messages.sort(key=lambda item: item.created_at)
    return conversation

@router.post("/conversations/{conversation_id}/messages", response_model=ConversationDetail)
def add_conversation_message(
    conversation_id: UUID,
    payload: ConversationMessageCreate,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> Conversation:
    conversation = owned_conversation(db, user, conversation_id)
    conversation.messages.append(ConversationMessage(body=payload.message, sender_role="patient"))
    conversation.updated_at = datetime.now(timezone.utc)
    conversation.status = "pending_review"
    conversation.reviewed_at = None
    conversation.reviewed_by_user_id = None
    conversation.review_note = None
    db.add(AuditLog(actor_user_id=user.id, action="patient_message_submitted", resource_type="conversation", resource_id=str(conversation.id)))
    db.commit()
    db.refresh(conversation)
    conversation.messages.sort(key=lambda item: item.created_at)
    return conversation

@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
def rename_conversation(
    conversation_id: UUID,
    payload: ConversationRename,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> Conversation:
    conversation = owned_conversation(db, user, conversation_id)
    conversation.title = payload.title
    conversation.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(actor_user_id=user.id, action="patient_conversation_renamed", resource_type="conversation", resource_id=str(conversation.id)))
    db.commit()
    db.refresh(conversation)
    return conversation

@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: UUID,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> Response:
    conversation = owned_conversation(db, user, conversation_id)
    conversation_id_text = str(conversation.id)
    db.add(AuditLog(actor_user_id=user.id, action="patient_conversation_deleted", resource_type="conversation", resource_id=conversation_id_text))
    db.delete(conversation)
    db.commit()
    return Response(status_code=204)
