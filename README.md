# Ghana Health Assistant

Design and Development of an AI-Powered Voice-Enabled Multilingual Health Assistant PWA for Health Information, Triage and Human-in-the-Loop Doctor Support.

> **Health service status.** This application is not clinically validated. It does not provide diagnosis, treatment, emergency response, or automated medical answers.

## What currently works

- PostgreSQL-backed patient registration and sign-in, hashed passwords, and expiring HttpOnly session cookies.
- Patient profile with display name and preference for English, Twi, Ewe, Ga, or Hausa.
- Patient-owned persistent conversations with consent, search, open, rename, delete, and clipboard sharing.
- System, light, and dark themes with saved preference and operating-system tracking.
- Verified clinician review queue, internal review note, review history, and audit events.
- Administrator overview, user activation, clinician verification, and recent audit log.
- Responsive React interface with role-specific workspaces.
- Installable PWA shell with offline caching for the interface only; API responses are never cached.

Messages are saved for clinician review. The application does not generate AI answers, transcribe speech, synthesize speech, or perform triage.

## Run locally

Requirements: Windows, Python 3.11+, Node.js 20.19+ or 22.12+, PostgreSQL 18, and the project virtual environment.

The local database is configured in backend/.env. Never paste or commit that file. It must contain a PostgreSQL URL using the postgresql+psycopg scheme and a unique SECRET_KEY (at least 32 characters). A PostgreSQL password containing reserved URL characters must be percent-encoded in the URL.

From PowerShell in the project root:

~~~powershell
cd backend
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
~~~

Open a second PowerShell window:

~~~powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
~~~

- Frontend: http://localhost:5173
- API readiness (includes PostgreSQL connection): http://127.0.0.1:8000/health/ready
- API documentation: http://127.0.0.1:8000/docs

The API returns HTTP 503 when PostgreSQL is missing or unavailable; it never reports a failed database as ready. Readiness logs the exception class without logging connection strings or credentials.

## Accounts and roles

Public registration always creates a patient. The browser cannot choose administrator or clinician roles.

To create the first local administrator, run from backend:

~~~powershell
.venv\Scripts\python.exe manage_accounts.py create-admin
~~~

The script prompts for the email and password without echoing the password. It only works if the database has no administrator yet.

An active administrator can create an unverified clinician account from a trusted local terminal:

~~~powershell
.venv\Scripts\python.exe manage_accounts.py create-doctor
~~~

This prompts for administrator authentication, clinician details, and an initial password. Verify the clinician’s professional credentials independently before using the administrator dashboard to approve the account. Verification is audited. Only active, verified clinician accounts can open the review API.

Patient messages are stored with explicit consent and may be viewed by authorized clinicians. Clinician review notes are internal and do not create a patient reply. Do not use this service for emergencies or as a substitute for care from a qualified professional.

## Database changes

Alembic revisions are additive and preserve existing accounts and submissions. Apply new revisions using upgrade head; do not reset or drop the database. Current schema revision is 0007_conversation_updated_at.

## Quality checks

From frontend:

~~~powershell
npm run build
npx tsc -b --pretty false
npm run lint
~~~

From backend:

~~~powershell
.venv\Scripts\python.exe -m pytest -q
~~~

## Current limitations and next work

- No approved health-document ingestion or retrieval system is connected.
- No AI model, speech recognition, or text-to-speech is installed.
- Automated health answers and microphone input are unavailable; messages can be sent for clinician review.
- Triage rules have not been specified or clinically approved.
- Administrator and clinician access require local trusted-operator provisioning.
- Recovery email/password reset and translated interface strings are not implemented.
- Production deployment still needs HTTPS, deployment secrets, reviewed consent/privacy policy, clinical governance, and security review.
- Conversation sharing copies readable text to the clipboard only. No public share links are created.

Speech model coverage, licensing, device constraints, and evaluation recommendations are in docs/SPEECH_EVALUATION.md.
