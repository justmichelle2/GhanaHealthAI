from types import SimpleNamespace
from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password, verify_password
from app.dependencies import get_current_user, require_role
from app.models import AuditLog, Conversation, ConversationMessage, ConversationShare, DoctorProfile, PasswordResetToken, User, UserRole
from app.routers.auth import check_csrf
from app.schemas import ConversationCreate, RegisterRequest
import main as api_main
from main import app


client = TestClient(app)


def test_registration_requires_patient_details_and_keeps_role_server_owned():
    payload = RegisterRequest(full_name="  Ama   Mensah ", email="AMA@example.com", password="a-long-unique-password", preferred_language="tw")
    assert payload.full_name == "Ama Mensah"
    assert str(payload.email) == "ama@example.com"
    with pytest.raises(ValueError):
        RegisterRequest(full_name="A", email="a@example.com", password="a-long-unique-password", role="admin")


def test_conversation_requires_explicit_consent_and_nonblank_text():
    with pytest.raises(ValueError):
        ConversationCreate(message="A health question", preferred_language="en")
    with pytest.raises(ValueError):
        ConversationCreate(message="     ", preferred_language="en", consent_to_store=True)
    payload = ConversationCreate(message="  Sample health question  ", preferred_language="gaa", consent_to_store=True)
    assert payload.message == "Sample health question"


def test_password_hash_is_not_plaintext_and_verifies():
    password = "a-long-test-password"
    encoded = hash_password(password)
    assert encoded != password
    assert verify_password(password, encoded)
    assert not verify_password("incorrect-password", encoded)


def test_csrf_requires_matching_cookie_and_header():
    check_csrf("same-token", "same-token")
    with pytest.raises(HTTPException) as error:
        check_csrf("cookie-token", "other-token")
    assert error.value.status_code == 403


def test_verified_doctor_role_gate():
    doctor_guard = require_role(UserRole.DOCTOR)
    verified = SimpleNamespace(role="doctor", doctor_profile=SimpleNamespace(is_verified=True))
    assert doctor_guard(user=verified) is verified
    unverified = SimpleNamespace(role="doctor", doctor_profile=SimpleNamespace(is_verified=False))
    with pytest.raises(HTTPException) as error:
        doctor_guard(user=unverified)
    assert error.value.status_code == 403


def test_health_and_auth_routes_are_reachable_without_mutating_accounts(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(api_main, "get_session_factory", lambda: sessionmaker(bind=engine))
    test_sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    def test_db():
        with test_sessions() as session:
            yield session
    app.dependency_overrides[get_db] = test_db
    assert client.get("/health").status_code == 200
    assert client.get("/health/ready").status_code == 200
    assert client.get("/auth/me").status_code == 401
    assert client.get("/patient/conversations").status_code == 401
    assert client.get("/doctor/conversations").status_code == 401
    assert client.get("/admin/overview").status_code == 401
    assert client.post("/auth/register", json={
        "full_name": "Test Person",
        "email": "no-write@example.com",
        "password": "this-is-a-long-test-password",
        "preferred_language": "en",
    }).status_code == 403
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_patient_conversations_persist_and_enforce_owner_on_every_operation():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    test_sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with test_sessions() as session:
        owner = User(email="owner@example.com", password_hash="not-used", role="patient", is_active=True)
        other = User(email="other@example.com", password_hash="not-used", role="patient", is_active=True)
        session.add_all([owner, other])
        session.commit()

    def test_db():
        with test_sessions() as session:
            yield session

    app.dependency_overrides[get_db] = test_db
    app.dependency_overrides[get_current_user] = lambda: owner
    try:
        response = client.post("/patient/conversations", json={
            "message": "I have a question about sleep.",
            "preferred_language": "en",
            "consent_to_store": True,
        })
        assert response.status_code == 201
        conversation_id = response.json()["id"]
        assert response.json()["title"].startswith("Conversation ")

        detail = client.get(f"/patient/conversations/{conversation_id}")
        assert detail.status_code == 200
        assert detail.json()["messages"][0]["body"] == "I have a question about sleep."

        appended = client.post(f"/patient/conversations/{conversation_id}/messages", json={
            "message": "This is a follow-up question.", "consent_to_store": True,
        })
        assert appended.status_code == 200
        assert len(appended.json()["messages"]) == 2

        renamed = client.patch(f"/patient/conversations/{conversation_id}", json={"title": "Sleep questions"})
        assert renamed.status_code == 200
        assert renamed.json()["title"] == "Sleep questions"
        assert client.get("/patient/conversations?search=sleep").json()[0]["title"] == "Sleep questions"

        app.dependency_overrides[get_current_user] = lambda: other
        assert client.get(f"/patient/conversations/{conversation_id}").status_code == 404
        assert client.patch(f"/patient/conversations/{conversation_id}", json={"title": "Stolen"}).status_code == 404
        assert client.delete(f"/patient/conversations/{conversation_id}").status_code == 404

        app.dependency_overrides[get_current_user] = lambda: owner
        assert client.delete(f"/patient/conversations/{conversation_id}").status_code == 204
        assert client.get(f"/patient/conversations/{conversation_id}").status_code == 404
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def isolated_application_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with sessions() as session:
        owner = User(email="owner@example.com", password_hash=hash_password("original-password-123"), role="patient", is_active=True)
        other = User(email="other@example.com", password_hash=hash_password("original-password-123"), role="patient", is_active=True)
        session.add_all([owner, other])
        session.flush()
        conversation = Conversation(patient_user_id=owner.id, title="Private title", preferred_language="en", status="pending_review")
        conversation.messages.append(ConversationMessage(sender_role="patient", body="A private health message."))
        session.add(conversation)
        session.commit()
        owner_id, other_id, conversation_id = owner.id, other.id, conversation.id

    def test_db():
        with sessions() as session:
            yield session

    client.cookies.clear()
    app.dependency_overrides[get_db] = test_db
    app.dependency_overrides.pop(get_current_user, None)
    try:
        yield {"engine": engine, "sessions": sessions, "owner_id": owner_id, "other_id": other_id, "conversation_id": conversation_id}
    finally:
        app.dependency_overrides.clear()
        client.cookies.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_password_recovery_generic_response_rate_limit_hashed_tokens_and_session_invalidation(isolated_application_db, monkeypatch, caplog):
    import app.core.security as security
    import app.routers.auth as auth

    sent = []
    monkeypatch.setattr(auth, "get_settings", lambda: SimpleNamespace(email_configured=True, frontend_url="http://localhost:5173", password_reset_minutes=30, access_token_expire_minutes=30, secure_cookies=False))
    monkeypatch.setattr(auth, "send_email", lambda recipient, subject, body: sent.append((recipient, subject, body)))
    monkeypatch.setattr(security, "get_settings", lambda: SimpleNamespace(secret_key="s" * 48, access_token_expire_minutes=30))
    assert client.get("/auth/csrf").status_code == 204
    csrf = client.cookies.get("gha_csrf")
    headers = {"X-CSRF-Token": csrf}

    known = client.post("/auth/password-reset/request", json={"email": "owner@example.com"}, headers=headers)
    unknown = client.post("/auth/password-reset/request", json={"email": "missing@example.com"}, headers=headers)
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(sent) == 1
    raw_token = sent[0][2].split("#reset/", 1)[1].split()[0]
    with isolated_application_db["sessions"]() as session:
        saved = session.query(PasswordResetToken).one()
        assert saved.token_hash == auth.token_digest(raw_token)
        assert raw_token not in saved.token_hash

    old_access = security.create_access_token(str(isolated_application_db["owner_id"]), 0)
    client.cookies.set("gha_access", old_access)
    invalid = client.post("/auth/password-reset/confirm", json={"token": "x" * 43, "password": "new-unique-password-123"})
    assert invalid.status_code == 400
    changed = client.post("/auth/password-reset/confirm", json={"token": raw_token, "password": "new-unique-password-123"})
    assert changed.status_code == 200
    assert client.get("/auth/me").status_code == 401
    reused = client.post("/auth/password-reset/confirm", json={"token": raw_token, "password": "another-new-password-123"})
    assert reused.status_code == 400
    with isolated_application_db["sessions"]() as session:
        owner = session.get(User, isolated_application_db["owner_id"])
        assert owner.session_version == 1
        assert verify_password("new-unique-password-123", owner.password_hash)
        assert len(session.query(AuditLog).filter(AuditLog.action == "password_changed").all()) == 1
    assert len(sent) == 2  # reset link plus password-changed notification
    assert raw_token not in caplog.text

    for _ in range(3):
        assert client.post("/auth/password-reset/request", json={"email": "throttled@example.com"}, headers=headers).status_code == 202
    assert client.post("/auth/password-reset/request", json={"email": "throttled@example.com"}, headers=headers).status_code == 429


def test_expired_password_reset_token_is_rejected(isolated_application_db):
    from app.routers.auth import token_digest

    raw = "expired-test-token-012345678901234567890123456789"
    with isolated_application_db["sessions"]() as session:
        session.add(PasswordResetToken(user_id=isolated_application_db["owner_id"], token_hash=token_digest(raw),
                                       expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
        session.commit()
    response = client.post("/auth/password-reset/confirm", json={"token": raw, "password": "new-unique-password-123"})
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]


def test_conversation_share_owner_expiry_revocation_and_read_only_privacy(isolated_application_db):
    from app.routers.auth import token_digest

    owner = isolated_application_db["sessions"]
    with owner() as session:
        owner_user = session.get(User, isolated_application_db["owner_id"])
        other_user = session.get(User, isolated_application_db["other_id"])
    app.dependency_overrides[get_current_user] = lambda: owner_user
    conversation_id = isolated_application_db["conversation_id"]
    unconfirmed = client.post(f"/patient/conversations/{conversation_id}/shares", json={"confirmed": False, "expires_in_hours": 24})
    assert unconfirmed.status_code == 422
    created = client.post(f"/patient/conversations/{conversation_id}/shares", json={"confirmed": True, "expires_in_hours": 24})
    assert created.status_code == 201
    raw_token = created.json()["token"]
    share_id = created.json()["id"]
    with owner() as session:
        share = session.get(ConversationShare, UUID(share_id))
        assert share.token_hash == token_digest(raw_token)
        assert raw_token not in share.token_hash

    public = client.post("/patient/public/shares/resolve", json={"token": raw_token})
    assert public.status_code == 200
    assert public.headers["cache-control"].startswith("no-store")
    assert public.headers["x-robots-tag"] == "noindex, nofollow, noarchive"
    assert public.json()["messages"][0]["body"] == "A private health message."
    assert "id" not in public.json() and "patient_user_id" not in public.json()

    app.dependency_overrides[get_current_user] = lambda: other_user
    assert client.post(f"/patient/conversations/{conversation_id}/shares", json={"confirmed": True, "expires_in_hours": 24}).status_code == 404
    assert client.get(f"/patient/conversations/{conversation_id}").status_code == 404
    app.dependency_overrides.pop(get_current_user, None)
    assert client.post(f"/patient/conversations/{conversation_id}/messages", json={"message": "Attempt to modify this shared thread.", "consent_to_store": True}).status_code == 401

    app.dependency_overrides[get_current_user] = lambda: owner_user
    assert client.delete(f"/patient/conversations/{conversation_id}/shares/{share_id}").status_code == 204
    assert client.post("/patient/public/shares/resolve", json={"token": raw_token}).status_code == 404
    with owner() as session:
        share = session.get(ConversationShare, UUID(share_id))
        assert share.revoked_at is not None
        assert len(session.query(AuditLog).filter(AuditLog.action == "conversation_share_created").all()) == 1
        assert len(session.query(AuditLog).filter(AuditLog.action == "conversation_share_revoked").all()) == 1

    expiring = client.post(f"/patient/conversations/{conversation_id}/shares", json={"confirmed": True, "expires_in_hours": 1})
    assert expiring.status_code == 201
    with owner() as session:
        share = session.get(ConversationShare, UUID(expiring.json()["id"]))
        share.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.commit()
    assert client.post("/patient/public/shares/resolve", json={"token": expiring.json()["token"]}).status_code == 404


def test_share_resolution_is_rate_limited_by_client(isolated_application_db):
    for _ in range(30):
        assert client.post("/patient/public/shares/resolve", json={"token": "x" * 43}).status_code == 404
    assert client.post("/patient/public/shares/resolve", json={"token": "x" * 43}).status_code == 429


def test_clinician_review_sends_patient_visible_reply_and_keeps_note_internal(isolated_application_db):
    sessions = isolated_application_db["sessions"]
    with sessions() as session:
        doctor = User(email="doctor@example.com", password_hash=hash_password("a-long-doctor-password"), role="doctor", is_active=True)
        doctor.doctor_profile = DoctorProfile(is_verified=True)
        session.add(doctor)
        session.commit()
        doctor_id = doctor.id

    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=doctor_id, role="doctor", doctor_profile=SimpleNamespace(is_verified=True))
    conversation_id = isolated_application_db["conversation_id"]
    reviewed = client.patch(f"/doctor/conversations/{conversation_id}/review", json={
        "review_note": "Internal clinical note.",
        "patient_response": "A clinician reply visible to the patient.",
    })
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "reviewed"

    with sessions() as session:
        conversation = session.get(Conversation, conversation_id)
        assert conversation.review_note == "Internal clinical note."
        messages = session.query(ConversationMessage).filter(ConversationMessage.conversation_id == conversation_id).all()
        reply = [message for message in messages if message.sender_role == "doctor"]
        assert len(reply) == 1
        assert reply[0].body == "A clinician reply visible to the patient."
        assert len(session.query(AuditLog).filter(AuditLog.action == "patient_reply_sent").all()) == 1
