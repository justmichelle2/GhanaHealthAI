from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password, verify_password
from app.dependencies import get_current_user, require_role
from app.models import User, UserRole
from app.routers.auth import check_csrf
from app.schemas import ConversationCreate, RegisterRequest
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


def test_health_and_auth_routes_are_reachable_without_mutating_accounts():
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
