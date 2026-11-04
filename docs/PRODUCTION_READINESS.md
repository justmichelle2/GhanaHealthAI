# Production readiness runbook (draft)

**Status:** preparation only. No production host, domain, HTTPS endpoint, SMTP provider, database, backup target, or operational team has been configured or verified.

## Current deployment shape

- React/Vite static frontend; FastAPI API; PostgreSQL database through SQLAlchemy and Alembic.
- Keep the frontend and API on the same site (for example, `app.example.gh` and `api.example.gh`) so the `SameSite=Lax` session cookie works. Set `VITE_API_BASE_URL` to the HTTPS API base URL at frontend build time.
- Terminate TLS at a managed HTTPS load balancer or a maintained reverse proxy such as Caddy/Nginx. Redirect HTTP to HTTPS there, enable HSTS only after the HTTPS domain and all subdomains are ready, and prevent direct public access to the API service port.
- Use a private PostgreSQL network endpoint with TLS verification. Never expose PostgreSQL publicly. Use a dedicated least-privilege application role and separate migration credentials.

## Required environment configuration

Set these on the host's secret/configuration manager, never in frontend variables or committed files:

`APP_ENV=production`, `DATABASE_URL` (TLS enabled), a unique random `SECRET_KEY` of at least 32 characters, `ACCESS_TOKEN_EXPIRE_MINUTES`, HTTPS `CORS_ORIGINS`, HTTPS `FRONTEND_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SENDER`, and `PASSWORD_RESET_MINUTES`.

The SMTP provider must support authenticated TLS. Do not expose `SMTP_*`, `DATABASE_URL`, or `SECRET_KEY` through `VITE_*` variables. Use a real email domain with SPF/DKIM/DMARC configured by its owner. Local tests stub email; local manual email testing can use Mailpit on `127.0.0.1:1025` with authentication disabled only on a private development machine/network.

## Release procedure

1. Provision separate staging and production services and secrets. Restrict administrative access and record who has access.
2. Configure DNS and HTTPS at the selected host/proxy. Verify HTTP redirects, certificate renewal, TLS on the API and database links, secure cookies, CORS, and security headers from an external client.
3. Take and verify a restorable database backup before migrations. In `backend`, run `alembic upgrade head` with the migration credential; inspect `alembic current` and `alembic heads`.
4. Build the frontend with the correct public API URL. Run backend tests, frontend lint/build, dependency scanning, and the release checklist in `SECURITY_REVIEW.md`.
5. Deploy a versioned release, check `/health` and `/health/ready`, then exercise registration, sign-in/out, recovery email, reset, conversation retention/deletion, consent, and sharing/revocation using non-production data.
6. Confirm monitoring is access-controlled and excludes request bodies, cookies, authorization data, reset tokens, share tokens, message content, and patient identifiers. Alert on readiness failures, unusual reset/share attempts, and storage/backup failures.

## Backup and recovery

The application does not currently configure or verify backups. Before launch, choose an encrypted backup service and retention schedule with the data controller and counsel; restrict keys and operators; document recovery objectives; and perform a restore drill into an isolated environment. Backups contain health conversations and audit records, so apply the same access controls and retention rules as the primary database. Do not test restoration over production data.

## Health checks and limitations

`GET /health` checks process availability. `GET /health/ready` checks PostgreSQL connectivity. They do not verify SMTP delivery, migrations beyond connectivity, backups, model safety, clinical review staffing, or regulatory approval. Current service is not clinically validated and automated health answers are unavailable. Deployment requires those operational decisions and approvals separately.
