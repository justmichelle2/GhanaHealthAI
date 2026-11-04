# Implementation Status

**Last updated:** 2026-11-04  
**Repository:** https://github.com/justmichelle2/GhanaHealthAI (branch `main`)  
**Canonical checkout:** `GhanaHealthAI/` inside the outer working folder. The outer `backend/`, `frontend/` and `docs/` folders are an older local scaffold and are not the Git repository; they were left untouched.

## Service boundary (do not overstate)

The product stores patient messages for clinician review. It does **not** provide automated AI answers, diagnosis, triage, speech recognition or text-to-speech. Those capabilities are blocked by the absence of an approved model, credentials, clinical governance and a consented speech benchmark. The UI must state this honestly.

## Feature classification

| Area | Status | Files | Notes |
|---|---|---|---|
| Registration, login, logout, session cookies | COMPLETE | `backend/app/routers/auth.py`, `backend/app/core/security.py`, `frontend/src/App.tsx` | HttpOnly JWT cookie, session version, CSRF double-submit, generic errors. |
| Password recovery | COMPLETE | `backend/app/routers/auth.py`, `backend/migrations/versions/0008_recovery_and_shares.py`, `docs/PASSWORD_RECOVERY.md` | Hashed single-use tokens, expiry, rate limiting, generic response, SMTP optional. |
| Patient profile / conversation language | COMPLETE | `backend/app/routers/patient.py`, `frontend/src/App.tsx` | Interface language is browser-local; conversation language is account-stored. |
| Conversations, history, rename, delete | COMPLETE | `backend/app/routers/patient.py`, `frontend/src/App.tsx` | Owner checks on every operation; accessible in-app dialog. |
| Clinician review queue | COMPLETE | `backend/app/routers/doctor.py`, `frontend/src/App.tsx` | Verified-doctor gate; internal notes. |
| Patient-visible clinician reply | COMPLETE (new) | `backend/app/routers/doctor.py`, `frontend/src/App.tsx` | Reviewer can add a patient-visible reply; it is appended as a `doctor` message. Internal notes stay private. |
| Administrator controls | COMPLETE | `backend/app/routers/admin.py`, `frontend/src/App.tsx` | Activation, clinician verification, audit log, last-admin protection. |
| Secure read-only sharing | COMPLETE | `backend/app/routers/patient.py`, `frontend/src/App.tsx` | Random token, hashed at rest, expiry, revocation, no-store/noindex, rate limited. |
| PWA shell | PARTIALLY COMPLETE | `frontend/public/*`, `frontend/src/main.tsx` | Installable shell; production SW caching only, API never cached. Icons are SVG only. |
| Multilingual UI | PARTIALLY COMPLETE | `frontend/src/i18n/*`, `frontend/src/App.tsx` | English catalog covers every screen with 182 keys. Twi/Ewe/Ga/Hausa catalogs remain intentionally empty pending competent-speaker and clinical/legal review, so reviewed text can later be added without code changes. |
| Automated AI health answers | BLOCKED BY EXTERNAL DEPENDENCY | — | No approved model/provider, credentials, source corpus, safeguards or clinical sign-off. |
| Speech recognition / TTS | BLOCKED BY EXTERNAL DEPENDENCY | `docs/SPEECH_EVALUATION.md` | No installed model or rights-cleared benchmark. Controls disabled honestly. |
| Clinical triage rules | BLOCKED BY EXTERNAL DEPENDENCY | — | No clinically approved rules. |
| Production deployment | NOT DONE | `docs/PRODUCTION_READINESS.md` | No host, domain, HTTPS, SMTP, backups or monitoring configured. |

## Problems found and corrected

1. The chat page rendered a second conversation-history column inside the chat card even though the design specification says history must live only in the application sidebar. The dead panel was removed from the DOM; history remains in the sidebar and opens as the mobile drawer.
2. The message composer sent `consent_to_store: true` regardless of the consent checkbox. Submission now requires the checkbox and refuses to send without it.
3. The share dialog had no focus trap, no Escape handling and no focus return. It now follows the same keyboard pattern as the rename/delete dialog.
4. Many user-facing strings were hardcoded English despite existing translation keys. Patient, authentication, recovery, dashboard, chat, clinician and administrator copy now uses the catalog.
5. The interface palette did not match the requested health-service tokens. Semantic tokens now use the specified values while retaining the existing semantic names.
6. The clinician review flow had no way to send a reply the patient could read. A patient-visible reply was added; internal notes remain internal.
7. Login had no brute-force throttling. A per-email/per-IP limit was added.
8. `manifest.webmanifest` and `index.html` used an old background colour. They now use the design token colour.

## Verification commands

```powershell
# backend (from GhanaHealthAI/backend)
..\..\backend\.venv\Scripts\python.exe -m pytest -q

# frontend (from GhanaHealthAI/frontend)
npm test
npm run build
npm run lint
```

Last run: backend **12 passed**; frontend **4 passed**, production build succeeded, ESLint reported no problems.

## Remaining work

- Competent-speaker and clinical/legal review of every non-English string (`docs/TRANSLATION_REVIEW.md`).
- Browser screenshot matrix at 360/390/768/1024/1280/1440 widths (no automated browser harness is installed in this repo).
- A designed, clinician-approved AI answer pipeline and speech models; currently blocked.
- Production infrastructure, HTTPS, SMTP, backups, monitoring and emergency escalation ownership.
