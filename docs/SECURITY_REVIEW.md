# Security Review

**Scope:** source review of the current development application, including authentication, patient/doctor/admin routes, recovery, sharing, SQL/data handling, frontend exposure, and deployment assumptions. This is not a penetration test, dependency scan certification, privacy impact assessment, or production sign-off.

## Implemented controls

- Passwords use the existing Argon2-backed password-hashing helper. Recovery secrets and share secrets are cryptographically random and only SHA-256 digests are persisted. Reset tokens expire and are single-use; password change increments a user session version so previously issued access tokens are rejected.
- Recovery returns the same success message for known and unknown addresses. It rate-limits by hashed normalized email and hashed client address. SMTP delivery errors are logged by exception class only, with no address or token.
- Patient conversation routes check ownership. Share creation/revocation is owner-only; creation requires explicit confirmation. Links are read-only, expire within seven days, can be revoked, and public payloads omit account and conversation IDs. Public resolution is rate-limited and returns no-store/noindex/referrer headers.
- JWT authentication remains in HttpOnly cookies, CSRF validation protects authenticated writes, role dependencies gate patient/doctor/admin operations, and security headers are added. SQLAlchemy query expressions are parameterized; user text is rendered as React text, not HTML.
- The current application contains no file-upload routes. No secret is intentionally embedded in frontend source; frontend API URL is a public build-time setting.

## Remaining risks and required work

- PostgreSQL rate-limit updates use an atomic upsert; the SQLite-only test fallback uses a row lock that SQLite does not enforce. The rate-limit table has no cleanup job, so configure bounded retention/maintenance before launch.
- SMTP is synchronous in the request worker. Configure bounded provider timeouts and preferably move delivery to a managed queue with retry controls. Failure remains generic to avoid account enumeration.
- The public share API receives the raw token in a POST body. Ensure APM, reverse-proxy, tracing, and request-body logging are disabled or scrubbed for this route. Tokens are removed from the browser fragment on page load; never include them in support tickets.
- Old/used/expired reset records and rate-limit rows are retained until maintenance. There is no account deletion flow, scheduled data retention, backup system, incident/on-call service, or security monitoring in this repository.
- Production HTTPS, trusted proxy configuration, database TLS/at-rest encryption, secret management/rotation, network isolation, WAF/bot controls, backups/restore, and deployment hardening are infrastructure work and have not been verified.
- Clinician verification is an administrator-set flag, not external credential verification. There is no clinical validation, response engine, review SLA, or emergency-care workflow.
- Twi, Ewe, Ga, and Hausa translation resources are unreviewed and blank. The rest of the interface has not yet been extracted into translation keys.
- `npm audit` found 12 moderate advisories in development tooling (ESLint/minimatch dependency chain); the audited production set had five dependencies and no listed advisories. A semver-safe `npm audit fix` did not complete within the registry timeout; no forced major override was applied because compatibility is unverified. Python dependencies were not scanned with `pip-audit` in this environment.
- Ghana-specific privacy, health-service, professional-practice, licensing, consent, cross-border transfer, and breach-response requirements need Ghana-qualified legal/clinical review. The policy documents are drafts only.

## Pre-release checklist

1. Configure secrets, HTTPS, CORS, SMTP and TLS PostgreSQL as described in `PRODUCTION_READINESS.md`.
2. Run migrations and all automated tests against isolated databases; run dependency scanners and resolve findings.
3. Verify rate-limit concurrency and cleanup; configure request-body redaction in all infrastructure logs.
4. Restore a backup in an isolated environment; complete an incident exercise and access-control review.
5. Obtain policy, consent, clinical workflow and Ghana legal review; complete speaker-reviewed translation and accessibility checks.
6. Perform an independent penetration test and verify the public share/recovery flows from outside the hosting network.
