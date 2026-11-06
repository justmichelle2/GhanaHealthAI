# Ghana Health Assistant Architecture

## Product boundary

This React, TypeScript, and FastAPI application provides patient accounts, multilingual preferences, persistent messages, and clinician review workflows in Ghana. Target languages are English, Twi, Ewe, Ga, and Hausa. It is not clinically validated and must not be used for diagnosis or treatment.

## Implemented components

### Frontend

- React 18, TypeScript, Vite, responsive CSS design tokens.
- Landing, sign-in, and patient registration screens.
- Cookie-backed authenticated patient, clinician, and administrator workspaces.
- Patient profile, language preference, searchable conversation history, System/Light/Dark theme, and safety notices.
- Patient messages can be saved to owned conversations; patients can open, rename, delete, and copy a conversation to clipboard. No public share links are created.
- The chat composer stores messages for clinician review. With separate per-message opt-in, the current message is sent to Dahl Inference and its generated reply is stored in the conversation. AI replies are not clinician-reviewed or clinically validated.
- Doctor queue shows only pending or reviewed requests; clinician notes are internal and not sent to patients.
- Admin user state, clinician verification action, overview counts, and audit log.
- No frontend role choice or account data is hardcoded.
- Installable manifest and service worker cache static app-shell files only; API requests are excluded.

### Backend

- FastAPI, SQLAlchemy, Alembic, PostgreSQL through psycopg.
- Argon2 password hashing through pwdlib.
- Signed short-lived JWT in an HttpOnly cookie; CSRF double-submit cookie for state-changing requests.
- Exact-origin CORS configuration loaded from backend/.env.
- Patient-only public registration; role checks run on every protected API.
- Doctors require an active account and a verified DoctorProfile.
- Administrators use a dedicated role gate.
- Database readiness executes SELECT 1 and returns 503 when PostgreSQL is unavailable.
- Audit records cover account creation, profile changes, message submission, clinician review, verification, and account state changes.
- No passwords, message bodies, or connection strings are written to audit events or readiness logs.

### Data model

- users, patient_profiles, doctor_profiles, audit_logs.
- conversations include patient owner, selected language, consent timestamp, status, and reviewer metadata.
- conversation_messages store patient messages and generated assistant replies.
- Conversation title and updated_at support patient search and recent activity ordering. Automatic titles do not repeat message text.
- clinician review notes are distinct from patient messages and are not shown to patients.
- Patient endpoints filter by authenticated owner. Clinician endpoints require verified clinician role. Admin endpoints require administrator role.

## Migrations

Alembic revisions 0001 through 0007 add authentication, profiles, patient messages, reviewer tracking, profile names, internal review notes, conversation titles, and activity timestamps. All changes are additive. Existing database and user data must be preserved; never reset the database during normal upgrades.

## Current request flow

1. A patient registers; server assigns the patient role and stores only the password hash.
2. Patient profile stores display name and language preference.
3. A patient message requires explicit storage consent. Only the owning patient can retrieve, rename, or delete their conversation. A clinician can review message content when the account is verified.
4. With separate explicit consent for each message, the current message is sent to Dahl Inference; prior conversation content is not sent. The generated reply is saved alongside the patient message.
5. The conversation remains pending_review and is visible only to its owner and a verified clinician. AI output is not a clinician response and is not clinically validated.
6. A clinician can review the conversation, record an internal note, and mark it reviewed. New patient messages reopen the review status.
7. Admin can inspect accounts, verify clinician profiles after independent credential checks, manage active status, and inspect audit metadata.

## Planned architecture — not implemented

### Approved health information and retrieval

- Establish a clinician-approved source registry with publication, jurisdiction, language, date, and version metadata.
- Ingest documents with provenance and integrity hashes.
- Split content into attributed passages and retrieve only from approved, in-date sources.
- A response service must return passage references and explicit uncertainty; no answer should be synthesized when evidence is inadequate.
- Define source update, withdrawal, and review processes before enabling the patient assistant.
- No embedding service, vector database, or source ingestion pipeline is currently configured.

### Clinician-approved triage

- Separate deterministic, versioned, clinician-approved urgency rules from any language model.
- Define structured symptom intake and emergency escalation with Ghana-based clinical stakeholders.
- Require clinician review for any case outside approved rules.
- Do not diagnose or produce treatment instructions without governance and validation.

### Speech integration

- Define provider-neutral transcription and text-to-speech interfaces before connecting a model.
- Evaluate English, Twi, Ewe, Ga, and Hausa independently for accuracy, bias, latency, licensing, and hardware needs.
- Do not assume model language coverage or accuracy based on a model name.
- 8 GB RAM constraint: no large speech or language model is installed or downloaded.

## Security and operational limits

- Development secrets stay in ignored backend/.env; production requires HTTPS, rotated secrets, backups, monitoring, and threat review.
- Public registration cannot create a doctor or administrator.
- First admin and unverified clinician onboarding are local operator commands; clinician credentials must be verified independently before approval.
- User suspension, verification, and review actions are audited.
- No approved medical knowledge retrieval, clinical validation, emergency triage rules, speech processing, or source citations are implemented. AI replies are general information only.
