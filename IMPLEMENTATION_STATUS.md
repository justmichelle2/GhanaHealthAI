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
| Multilingual UI | PARTIALLY COMPLETE | `frontend/src/i18n/*`, `frontend/src/App.tsx` | English catalog covers every screen with 183 keys. Twi/Ewe/Ga/Hausa catalogs remain intentionally empty pending competent-speaker and clinical/legal review, so reviewed text can later be added without code changes. |
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

## Frontend refactor (2026-11-05)

- Replaced the three competing stylesheets (`index.css`, `responsive-dark.css`, `share.css`) with one layered system under `frontend/src/styles/`: `tokens.css` (semantic light/dark tokens, reset, focus, skip link), `components.css` (single component layer), and `responsive.css` (1100/900/768/640/420 breakpoints). Production CSS fell from 91.3 kB to 38.7 kB.
- Removed the duplicate dark-theme definitions and legacy dead CSS. Theme changes are now driven only by `html[data-theme='dark']`.
- Simplified the chat workspace: deleted the duplicated page heading, merged the status title/language/share controls into one compact header, replaced the large empty-state and unavailable-answer cards with a small icon empty state and a one-line notice, removed the unavailable microphone/voice note, and widened the composer so the conversation owns the available space.
- Replaced text glyphs (`☰ ✎ ↗ × ＋ → ◷ ▦`) with the accessible SVG `Icon` component; added `Button` and `Alert` primitives and reused them in the chat composer, dialogs and feedback banners.
- Replaced the decorative landing orbit with a compact `.landing-summary` card so the landing markup matches the new stylesheet.
- Added Vitest + Testing Library + jsdom. `npm test` now runs the UI suite and the existing i18n suite.

## Verification commands

```powershell
# backend (from GhanaHealthAI/backend)
..\..\backend\.venv\Scripts\python.exe -m pytest -q

# frontend (from GhanaHealthAI/frontend)
npm test
npm run build
npm run lint
```

Last run: backend **12 passed**; frontend **8 passed** (4 Vitest UI + 4 `node:test` i18n), production build succeeded, ESLint reported no problems.

## Remaining work

- Competent-speaker and clinical/legal review of every non-English string (`docs/TRANSLATION_REVIEW.md`).
- Browser screenshot matrix at 360/390/768/1024/1280/1440 widths. jsdom tests cover structure and behaviour, but no Playwright/browser harness is installed, so rendered layout and contrast have not been verified in a real browser.
- A designed, clinician-approved AI answer pipeline and speech models; currently blocked.
- Production infrastructure, HTTPS, SMTP, backups, monitoring and emergency escalation ownership.
