from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.dependencies import require_role
from app.models import AuditLog, Conversation, User, UserRole
from app.schemas import DoctorReviewItem, DoctorReviewResult, DoctorReviewUpdate

router = APIRouter(prefix="/doctor", tags=["clinician review"])


@router.get("/conversations", response_model=list[DoctorReviewItem])
def pending_conversations(
    doctor: User = Depends(require_role(UserRole.DOCTOR)),
    db: Session = Depends(get_db),
    status: str = "pending_review",
) -> list[dict]:
    if status not in {"pending_review", "reviewed"}:
        raise HTTPException(status_code=422, detail="Unsupported review status")
    statement = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.status == status)
        .order_by(Conversation.created_at.asc())
        .limit(100)
    )
    conversations = db.scalars(statement).all()
    return [
        {
            "id": conversation.id,
            "preferred_language": conversation.preferred_language,
            "status": conversation.status,
            "message": "\n\n".join(message.body for message in sorted(conversation.messages, key=lambda item: item.created_at)),
            "created_at": conversation.created_at,
            "reviewed_at": conversation.reviewed_at,
            "review_note": conversation.review_note,
        }
        for conversation in conversations
    ]


@router.patch("/conversations/{conversation_id}/review", response_model=DoctorReviewResult)
def mark_reviewed(
    conversation_id: UUID,
    payload: DoctorReviewUpdate,
    doctor: User = Depends(require_role(UserRole.DOCTOR)),
    db: Session = Depends(get_db),
) -> Conversation:
    conversation = db.scalar(
        update(Conversation)
        .where(Conversation.id == conversation_id, Conversation.status == "pending_review")
        .values(status="reviewed", reviewed_at=datetime.now(timezone.utc), reviewed_by_user_id=doctor.id, review_note=payload.review_note.strip() or None)
        .returning(Conversation)
    )
    if conversation is None and db.get(Conversation, conversation_id) is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if conversation is None:
        raise HTTPException(status_code=409, detail="Submission is no longer pending review")
    db.add(AuditLog(
        actor_user_id=doctor.id,
        action="patient_message_reviewed",
        resource_type="conversation",
        resource_id=str(conversation.id),
    ))
    db.commit()
    db.refresh(conversation)
    return conversation
