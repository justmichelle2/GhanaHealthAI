from datetime import datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=12, max_length=128)
    preferred_language: Literal["en", "tw", "ee", "gaa", "ha"] = "en"
    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("Enter your full name")
        return normalized

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

class PasswordResetConfirm(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=12, max_length=128)

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime


class PatientProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str | None
    preferred_language: str | None
    message_storage_consent: bool


class PatientProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    preferred_language: Literal["en", "tw", "ee", "gaa", "ha"]


class PatientConsentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message_storage_consent: bool

class ConversationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=4000)
    preferred_language: Literal["en", "tw", "ee", "gaa", "ha"]
    consent_to_store: Literal[True]
    consent_to_ai: Literal[True]
    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be blank")
        return value

class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    preferred_language: str
    status: str
    created_at: datetime
    updated_at: datetime

class ConversationMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    sender_role: str
    body: str
    created_at: datetime

class ConversationDetail(ConversationSummary):
    messages: list[ConversationMessageResponse]

class ConversationRename(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=160)
    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Title cannot be blank")
        return normalized

class ConversationShareCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmed: Literal[True]
    expires_in_hours: Literal[1, 24, 168] = 24

class ShareLinkSummary(BaseModel):
    id: UUID
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    active: bool

class SharedMessage(BaseModel):
    sender_role: Literal["patient", "assistant", "doctor"]
    body: str
    created_at: datetime

class SharedConversation(BaseModel):
    preferred_language: str
    created_at: datetime
    messages: list[SharedMessage]

class ShareTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=32, max_length=128)

class ConversationMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=4000)
    consent_to_store: Literal[True]
    consent_to_ai: Literal[True]
    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be blank")
        return value

class DoctorReviewItem(BaseModel):
    id: UUID
    preferred_language: str
    status: str
    message: str
    created_at: datetime
    reviewed_at: datetime | None = None
    review_note: str | None = None

class DoctorReviewUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    review_note: str = Field(default="", max_length=2000)

class DoctorReviewResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    reviewed_at: datetime | None

class AdminUserSummary(BaseModel):
    id: UUID
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime
    display_name: str | None = None
    is_verified: bool | None = None
    professional_details: str | None = None

class UserStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    actor_user_id: UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    created_at: datetime
