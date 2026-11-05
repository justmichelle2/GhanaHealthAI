# Frontend Refactor

**Date:** 2026-11-05  
**Scope:** `frontend/src` styling, chat workspace, icons, reusable primitives, and automated UI tests.  
**Contract:** `UI_SPEC.md` was not weakened. The product still stores patient messages for clinician review and does **not** provide automated answers, diagnosis, triage, speech recognition or text-to-speech.

## Why the refactor happened

The frontend had accumulated three competing style layers and duplicated dark themes:

- `index.css` — 712 lines mixing tokens, layout and legacy dead rules.
- `responsive-dark.css` — 645 lines containing two merged iterations (a `--dark-*` block plus a later semantic-token block).
- `share.css` — modal rules with their own fallback colours.

`App.tsx` was a 974-line monolith, icons were text glyphs (`☰ ✎ ↗ × ＋ ◷ ▦ →`), the chat screen repeated its heading and wasted vertical space, and the only tests covered the i18n catalog.

## What changed

### 1. One stylesheet, one theme

The old files are deleted. Styles now live in three ordered layers imported by `main.tsx`:

| File | Responsibility |
|---|---|
| `styles/tokens.css` | Semantic colour tokens for light and `html[data-theme='dark']`, spacing/type/radii/shadow/layout tokens, reset, `:focus-visible`, `.sr-only`, `.skip-link`, spinner, reduced-motion rules. |
| `styles/components.css` | The single component layer: buttons, alerts, forms, header/footer, landing, auth, workspace/sidebar, conversation list, chat, settings, clinician/admin tables, dialogs. |
| `styles/responsive.css` | Breakpoints at 1100, 900, 768, 640 and 420 px, including the mobile sidebar drawer and full-height chat. |

Dark mode is now defined only once, via semantic tokens, instead of two parallel variable systems. Production CSS fell from **91.3 kB to 38.7 kB**.

### 2. Compact chat workspace

- Removed the duplicated `.chat-page-heading` (eyebrow, `h1`, subtitle).
- The compact `.chat-header` now holds the mobile menu button, title, review status, conversation-language selector and share action.
- Empty state is a small icon with one heading and one sentence (`.chat-empty-state`).
- Removed the large `.assistant-unavailable` card, the `.voice-note` paragraph and the permanently disabled `.mic-button`.
- The “saved for review” message is now a single `.chat-notice` line shown only when a conversation contains patient messages and no clinician reply.
- The composer is a two-column grid (`textarea`, send) with the consent control spanning the full width below it, so the conversation area keeps the remaining height.

### 3. Accessible icon and primitive layer

- `components/ui/Icon.tsx` — stroke SVG icons sized from the current colour. Decorative by default (`aria-hidden`, no `role`); exposes `role="img"` and an accessible name only when `label` is passed.
- `components/ui/Button.tsx` — variants (`primary`, `outline`, `quiet`, `danger`), sizes, full width, loading state and optional leading icon; used in the chat composer and conversation dialogs.
- `components/ui/Alert.tsx` — tone-driven feedback (`info`, `success`, `warning`, `error`) with an icon and the appropriate `role` (`status` or `alert`); replaces repeated alert markup.
- Text glyphs in navigation, conversation actions, dialogs, status cards and empty states were replaced with `<Icon>`.

### 4. Landing cleanup

The decorative orbit (`landing-visual`, `orbit-ring`, `orbit-label`, `visual-*`) was removed. The landing aside is now a compact `.landing-summary` card describing the language choice, clinician review and health-information boundary. This removes internal-looking decoration and keeps the service boundary explicit.

### 5. Automated UI tests

- Added `vitest.config.ts` (jsdom environment) and `tests/setup.ts` (`@testing-library/jest-dom` plus a `matchMedia` polyfill).
- Added `tests/ui.test.tsx`:
  - `Icon` is decorative by default and labelled when a label is supplied.
  - The patient chat workspace renders one compact header, the empty state, the composer textarea and the conversation-language selector.
  - The removed voice/unavailable-answer copy is absent.
  - `jest-axe` reports zero detectable accessibility violations in the rendered chat workspace.
- `npm test` runs the Vitest suite **and** the existing `node:test` i18n suite. Added `test:ui` and `test:i18n` shortcuts.

## Verification

Run from `frontend/`:

```powershell
npm test        # 4 Vitest UI tests + 4 i18n tests
npm run build   # tsc -b && vite build
npm run lint    # eslint .
```

Last run: **8 tests passed**, production build succeeded (CSS 38.8 kB, JS 211.6 kB), ESLint reported no problems. A scripted check confirmed every static class name used in `App.tsx` has a selector in the new stylesheets.

## Not done / still open

- **No real-browser visual verification.** Playwright is not installed, so the 360/390/768/1024/1280/1440 screenshot matrix and rendered contrast still need to be checked in a browser.
- **No further component extraction.** `App.tsx` still owns routing state, data fetching and role screens. This pass changed styling, chat markup, icons and small primitives; splitting the monolith into page modules is a separate, larger change.
- **Translations remain intentionally empty** for Twi, Ewe, Ga and Hausa. The new `chatNotice` key was added to English only; copying English into the other catalogs would be false coverage.
- **AI/speech remain unimplemented.** No answer, transcription or synthesis behaviour was added.
