from datetime import datetime, timezone
from datetime import timedelta
import secrets
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import require_role
from app.models import AuditLog, Conversation, ConversationMessage, ConversationShare, PatientProfile, User, UserRole
from app.schemas import ConversationCreate, ConversationDetail, ConversationMessageCreate, ConversationRename, ConversationShareCreate, ConversationSummary, ConsentUpdate, PatientProfileResponse, PatientProfileUpdate, ShareTokenRequest, SharedConversation
from app.routers.auth import token_digest, enforce_limit
from app.services.dahl import DahlProviderError, generate_reply


router = APIRouter(prefix="/patient", tags=["patient profile"])


@router.post("/conversations/{conversation_id}/shares", status_code=201)
def create_share_link(conversation_id: UUID, payload: ConversationShareCreate,
                      user: User = Depends(require_role(UserRole.PATIENT)),
                      db: Session = Depends(get_db)) -> dict[str, Any]:
    conversation = owned_conversation(db, user, conversation_id)
    now = datetime.now(timezone.utc)
    if not enforce_limit(db, "share-create:" + str(user.id), maximum=10, window=timedelta(hours=1), now=now):
        db.commit()
        raise HTTPException(status_code=429, detail="Too many share links. Please try again later.")
    raw_token = secrets.token_urlsafe(32)
    share = ConversationShare(conversation_id=conversation.id, created_by_user_id=user.id,
                              token_hash=token_digest(raw_token),
                              created_at=now, expires_at=now + timedelta(hours=payload.expires_in_hours))
    db.add(share)
    db.add(AuditLog(actor_user_id=user.id, action="conversation_share_created", resource_type="conversation", resource_id=str(conversation.id)))
    db.commit()
    db.refresh(share)
    return {"id": share.id, "token": raw_token, "created_at": share.created_at, "expires_at": share.expires_at}


@router.get("/conversations/{conversation_id}/shares")
def list_share_links(conversation_id: UUID, user: User = Depends(require_role(UserRole.PATIENT)),
                      db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    owned_conversation(db, user, conversation_id)
    now = datetime.now(timezone.utc)
    shares = db.scalars(select(ConversationShare).where(ConversationShare.conversation_id == conversation_id)
                        .order_by(ConversationShare.created_at.desc())).all()
    return [{"id": item.id, "created_at": item.created_at, "expires_at": item.expires_at,
             "revoked_at": item.revoked_at, "active": item.revoked_at is None and (item.expires_at if item.expires_at.tzinfo else item.expires_at.replace(tzinfo=timezone.utc)) > now}
            for item in shares]


@router.delete("/conversations/{conversation_id}/shares/{share_id}", status_code=204)
def revoke_share_link(conversation_id: UUID, share_id: UUID,
                      user: User = Depends(require_role(UserRole.PATIENT)),
                      db: Session = Depends(get_db)) -> Response:
    owned_conversation(db, user, conversation_id)
    share = db.scalar(select(ConversationShare).where(ConversationShare.id == share_id,
                          ConversationShare.conversation_id == conversation_id))
    if share is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    if share.revoked_at is None:
        share.revoked_at = datetime.now(timezone.utc)
        db.add(AuditLog(actor_user_id=user.id, action="conversation_share_revoked", resource_type="conversation", resource_id=str(conversation_id)))
        db.commit()
    return Response(status_code=204)


@router.post("/public/shares/resolve", response_model=SharedConversation)
def resolve_share_link(payload: ShareTokenRequest, request: Request, response: Response,
                       db: Session = Depends(get_db)) -> SharedConversation:
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    ip = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    if not enforce_limit(db, "share-ip:" + ip, maximum=30, window=timedelta(minutes=10), now=now):
        db.commit()
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    share = db.scalar(select(ConversationShare).where(ConversationShare.token_hash == token_digest(payload.token),
                              ConversationShare.revoked_at.is_(None), ConversationShare.expires_at > now))
    if share is None:
        db.commit()
        raise HTTPException(status_code=404, detail="This share link is unavailable or has expired")
    conversation = db.get(Conversation, share.conversation_id)
    if conversation is None:
        db.commit()
        raise HTTPException(status_code=404, detail="This share link is unavailable or has expired")
    conversation.messages.sort(key=lambda item: item.created_at)
    db.commit()
    return SharedConversation(preferred_language=conversation.preferred_language, created_at=conversation.created_at,
                              messages=[{"sender_role": message.sender_role, "body": message.body, "created_at": message.created_at}
                                        for message in conversation.messages])


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


@router.patch("/profile/consent", response_model=PatientProfileResponse)
def update_message_consent(
    payload: ConsentUpdate,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> PatientProfile:
    profile = db.get(PatientProfile, user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    profile.messages_consent_given_at = datetime.now(timezone.utc) if payload.consent else None
    db.add(AuditLog(
        actor_user_id=user.id,
        action="patient_message_consent_updated",
        resource_type="patient_profile",
        resource_id=str(user.id),
    ))
    db.commit()
    db.refresh(profile)
    return profile


@router.patch("/profile/ai-consent", response_model=PatientProfileResponse)
def update_ai_provider_consent(
    payload: ConsentUpdate,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> PatientProfile:
    profile = db.get(PatientProfile, user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    profile.ai_provider_consent_given_at = datetime.now(timezone.utc) if payload.consent else None
    db.add(AuditLog(
        actor_user_id=user.id,
        action="patient_ai_provider_consent_given" if payload.consent else "patient_ai_provider_consent_withdrawn",
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
async def create_conversation(
    payload: ConversationCreate,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> Conversation:
    profile = db.get(PatientProfile, user.id)
    if profile is None or profile.ai_provider_consent_given_at is None:
        raise HTTPException(status_code=403, detail="Consent to send messages to the AI provider is required")
    now = datetime.now(timezone.utc)
    if not enforce_limit(db, "patient-ai:" + str(user.id), maximum=10, window=timedelta(minutes=1), now=now):
        db.commit()
        raise HTTPException(status_code=429, detail="Too many AI requests. Please wait a moment and try again.")
    db.commit()
    try:
        reply = await generate_reply(payload.message, payload.preferred_language)
    except DahlProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None
    conversation = Conversation(
        patient_user_id=user.id,
        # Keep message text out of sidebar titles to reduce accidental shoulder-surfing.
        title=f"Conversation {datetime.now(timezone.utc).date().isoformat()}",
        preferred_language=payload.preferred_language,
        status="pending_review",
        consented_at=datetime.now(timezone.utc),
    )
    conversation.messages.append(ConversationMessage(body=payload.message, sender_role="patient"))
    conversation.messages.append(ConversationMessage(body=reply, sender_role="assistant"))
    db.add(conversation)
    db.flush()
    db.add(AuditLog(actor_user_id=user.id, action="patient_message_submitted", resource_type="conversation", resource_id=str(conversation.id)))
    db.add(AuditLog(actor_user_id=user.id, action="patient_ai_message_consent_given", resource_type="conversation", resource_id=str(conversation.id)))
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
    now = datetime.now(timezone.utc)
    if not enforce_limit(db, "patient-ai:" + str(user.id), maximum=10, window=timedelta(minutes=1), now=now):
        db.commit()
        raise HTTPException(status_code=429, detail="Too many AI requests. Please wait a moment and try again.")
    db.commit()
    conversation.messages.sort(key=lambda item: item.created_at)
    return conversation

@router.post("/conversations/{conversation_id}/messages", response_model=ConversationDetail)
async def add_conversation_message(
    conversation_id: UUID,
    payload: ConversationMessageCreate,
    user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
) -> Conversation:
    conversation = owned_conversation(db, user, conversation_id)
    profile = db.get(PatientProfile, user.id)
    if profile is None or profile.ai_provider_consent_given_at is None:
        raise HTTPException(status_code=403, detail="Consent to send messages to the AI provider is required")
    try:
        reply = await generate_reply(payload.message, conversation.preferred_language)
    except DahlProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None
    conversation.messages.append(ConversationMessage(body=payload.message, sender_role="patient"))
    conversation.messages.append(ConversationMessage(body=reply, sender_role="assistant"))
    conversation.updated_at = datetime.now(timezone.utc)
    conversation.status = "pending_review"
    conversation.reviewed_at = None
    conversation.reviewed_by_user_id = None
    conversation.review_note = None
    db.add(AuditLog(actor_user_id=user.id, action="patient_message_submitted", resource_type="conversation", resource_id=str(conversation.id)))
    db.add(AuditLog(actor_user_id=user.id, action="patient_ai_message_consent_given", resource_type="conversation", resource_id=str(conversation.id)))
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
