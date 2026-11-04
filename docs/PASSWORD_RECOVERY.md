# Password recovery configuration

The API exposes `POST /auth/password-reset/request` and `POST /auth/password-reset/confirm`. Request requires a CSRF cookie/header pair and always gives the same success response for a known or unknown account. The API creates no reset link unless SMTP host and sender are configured. Tokens contain 256 bits of randomness, are sent once, expire after `PASSWORD_RESET_MINUTES` (clamped to 5–60 minutes), and only a SHA-256 digest is stored. A successful reset hashes the new password through the existing Argon2 helper, consumes the token, increments the account's session version, and queues a password-change notification.

## Environment variables

Configure `FRONTEND_URL`, `SMTP_HOST`, `SMTP_PORT` (`587` for STARTTLS or `465` for implicit TLS), `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SENDER`, and `PASSWORD_RESET_MINUTES` in `backend/.env` for local work or a secret manager in production. Never use a `VITE_*` name for SMTP or database secrets. See `backend/.env.example` for safe placeholders.

For local manual testing without delivering real mail, run a local Mailpit instance bound to loopback or a private development network, then configure `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `SMTP_SENDER=gha@example.test`, and no authentication. Do not expose the Mailpit inbox to the internet. Automated tests replace the email sender with an in-memory stub; they do not contact an SMTP service.

Production must use an authenticated TLS email provider, a controlled sender domain and verified SPF/DKIM/DMARC records. Confirm provider retention, region, access controls and processor terms with the data controller and counsel. An SMTP delivery failure returns no account-specific response; the event is logged only by failure class without recipient or token.
