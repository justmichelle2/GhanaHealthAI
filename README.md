# Ghana Health Assistant

Design and Development of an AI-Powered Voice-Enabled Multilingual Health Assistant PWA for Health Information, Triage and Human-in-the-Loop Doctor Support.

> **Health service status.** This application is not clinically validated. It does not provide diagnosis, treatment, emergency response, or automated medical answers.

## What currently works

- PostgreSQL-backed patient registration and sign-in, hashed passwords, and expiring HttpOnly session cookies.
- Patient profile with display name and preference for English, Twi, Ewe, Ga, or Hausa.
- Patient-owned persistent conversations with consent, search, open, rename, delete, and expiring, revocable read-only share links.
- Email-based password recovery when an SMTP provider is configured; recovery secrets are single-use and hashed at rest.
- System, light, and dark themes with saved preference and operating-system tracking.
- Verified clinician review queue, internal review note, review history, and audit events.
- Administrator overview, user activation, clinician verification, and recent audit log.
- Responsive React interface with role-specific workspaces.
- Installable PWA shell with offline caching for the interface only; API responses are never cached.

Messages are saved for clinician review. The application does not generate AI answers, transcribe speech, synthesize speech, or perform triage.

## Local setup

Requirements: Windows, Python 3.11+, Node.js 20.19+ or 22.12+, PostgreSQL 18, and PowerShell.

### 1. Start and check PostgreSQL

In PowerShell, check the PostgreSQL 18 service and local listener:

~~~powershell
Get-Service postgresql-x64-18
Test-NetConnection 127.0.0.1 -Port 5432
~~~

If the service is stopped, open PowerShell as Administrator and run `Start-Service postgresql-x64-18`. Keep PostgreSQL bound to localhost for local development.

Create the application role/database only on a fresh PostgreSQL installation. Connect as the PostgreSQL administrator, set the role password interactively with `\password`, then create the database:

~~~powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -p 5432 -U postgres -d postgres
~~~

At the `psql` prompt:

~~~sql
CREATE ROLE gha_app LOGIN;
\password gha_app
CREATE DATABASE ghana_health OWNER gha_app;
\q
~~~

Skip this step if the role and database already exist. Never paste a real database password into source files, chat, or shell history.

### 2. Configure the backend

Copy `backend/.env.example` to `backend/.env` and edit the local values. Set `DATABASE_URL` to the PostgreSQL URL for your local role/database, `SECRET_KEY` to a fresh random value of at least 32 characters, and keep `APP_ENV=development`. Passwords containing URL-reserved characters must be percent-encoded. The example has placeholders only; do not commit `.env`.

From PowerShell in the project root:

~~~powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
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

`/health/ready` must return `{"status":"ready","database":"available"}` before sign-in. SQL connection details stay in server logs; the patient UI displays a short retry message. The API uses connection pre-ping, a 30-minute connection recycle, and a five-second connection timeout.

### 3. Configure password recovery email (optional locally)

Automated tests stub email and never send real mail. For manual recovery testing, use a local Mailpit instance on a private development machine, then set `SMTP_HOST`, `SMTP_PORT=1025`, and `SMTP_SENDER` in `backend/.env`. Production requires an authenticated TLS SMTP provider; see `docs/PASSWORD_RECOVERY.md`.

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

Alembic revisions are additive and preserve existing accounts and submissions. Apply new revisions with `alembic upgrade head`; do not reset or drop the database. Current schema revision is `0008_recovery_and_shares`.

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
- Email recovery needs SMTP configuration before it can send messages.
- English is the only complete interface resource; Twi, Ewe, Ga and Hausa strings need competent-speaker and clinical review. The interface falls back to English for missing translations.
- Production deployment still needs HTTPS, deployment secrets, reviewed consent/privacy policy, clinical governance, backup/restore operations, and security review.

Speech model coverage, licensing, device constraints, and evaluation recommendations are in docs/SPEECH_EVALUATION.md.
