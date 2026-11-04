# UI-SPEC.md — Ghana Health Assistant

**Status:** Draft  
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui primitives  
**Target:** PWA (installable), desktop + mobile, five locales (en, tw, ee, gaa, ha)  
**Accessibility target:** WCAG 2.2 AA

---

## 1. Design Principles

| Principle | Requirement |
|-----------|-------------|
| **Trust first** | Patients are sharing health info in a non-clinically-validated service. The UI must look official, calm, and never confusing. No developer error strings (e.g., "Authentication is not configured") visible to users. |
| **Ghana-first** | Colors, imagery, and copy should signal Ghana and West African community health, not a generic SaaS starter template. |
| **Multilingual by default** | Five languages are equal citizens. The language switcher must be prominent and persistent, not buried in settings. |
| **Mobile-first** | Primary users are on low-to-mid-range Android devices on variable networks. Touch targets ≥ 44×44 CSS px, legible at 375px width. |
| **Role-aware** | Patient, clinician, and admin workspaces differ. Never show role-inappropriate actions. |
| **Accessible** | WCAG 2.2 AA contrast (4.5:1 normal text, 3:1 large text), focus-visible states, screen-reader labels on all interactive elements. |

---

## 2. Design Tokens

### 2.1 Color palette

Use semantic tokens (not raw hex in components). Recommended HSL-based Tailwind config:

| Token | Purpose | Suggested value | Notes |
|-------|---------|-----------------|-------|
| `--primary` | Primary brand, CTAs, active states | `hsl(20, 85%, 50%)` — warm terracotta / clay | Evokes Ghanaian earth and laterite soil; distinct from default medical blue. |
| `--primary-foreground` | Text on primary | `#ffffff` | |
| `--secondary` | Subtle surfaces, chips, borders | `hsl(210, 40%, 96%)` | Light gray-blue. |
| `--secondary-foreground` | Text on secondary | `hsl(222, 47%, 11%)` | Near-black. |
| `--muted` | Captions, disabled text | `hsl(210, 40%, 96%)` | |
| `--muted-foreground` | Muted text | `hsl(215, 16%, 47%)` | |
| `--accent` | Highlights, language chips | `hsl(45, 90%, 55%)` — warm gold / ochre | Accent only; never for primary actions. |
| `--accent-foreground` | Text on accent | `#000000` | |
| `--destructive` | Errors, deletions | `hsl(0, 72%, 51%)` | Red, but not for branding. |
| `--destructive-foreground` | Text on destructive | `#ffffff` | |
| `--border` | Input borders, dividers | `hsl(214, 32%, 91%)` | |
| `--input` | Input backgrounds | `#ffffff` | |
| `--ring` | Focus ring | `--primary` | 2px offset, 2px width. |
| `--background` | App background | `#ffffff` | |
| `--foreground` | Body text | `hsl(222, 47%, 11%)` | |

**Avoid:** Default Tailwind blue (`#2563eb`) as primary. It reads as generic fintech/SaaS, not Ghana health.

### 2.2 Typography

| Token | Usage | Size | Weight | Line-height |
|-------|-------|------|--------|-------------|
| `--text-heading` | H1 page titles | `2.25rem` / 36px | 700 | 1.2 |
| `--text-section-heading` | H2 section titles | `1.5rem` / 24px | 600 | 1.3 |
| `--text-body` | Paragraphs, form labels | `1rem` / 16px | 400 | 1.5 |
| `--text-small` | Captions, helper text | `0.875rem` / 14px | 400 | 1.4 |
| `--text-xs` | Legal disclaimers, timestamps | `0.75rem` / 12px | 400 | 1.4 |

**Font stack:** System-ui fallback is acceptable for MVP. For production, license a legible web font with strong Twi/Ewe/Ga/Hausa diacritic support (e.g., a Google Font such as *Inter* or *Plus Jakarta Sans* with extended Latin subsets).

### 2.3 Spacing

Use Tailwind spacing scale consistently:
- Section padding: `px-6 py-12` (desktop), `px-4 py-8` (mobile)
- Card padding: `p-6`
- Component gaps: `gap-4`, `gap-6`
- Border radius: `rounded-md` (6px) for cards/inputs, `rounded-lg` (8px) for modals

---

## 3. Layout & Grid

### 3.1 Breakpoints
| Name | Width | Use |
|------|-------|-----|
| `sm` | 640px | Small phones |
| `md` | 768px | Tablets / small laptops |
| `lg` | 1024px | Desktops |

### 3.2 Shell
- Top banner: logo (left), theme switcher + language switcher (center), Sign in / Create account (right).
- Main content area: max-width `7xl` (896px), centered, `mx-auto`.
- Footer: brand name + one-line disclaimer ("Not clinically validated. For health information only.").

### 3.3 Mobile behavior
- Below `md`, top banner collapses: logo left, hamburger menu right revealing language/theme/auth.
- Forms stack full-width; no side-by-side fields on mobile.

---

## 4. Component Specifications

### 4.1 Button
Use shadcn `Button` as base.

| Variant | Use | Token |
|---------|-----|-------|
| Default | Primary action (Create account, Save) | `--primary` bg, `--primary-foreground` text |
| Outline | Secondary action (Back to home, Cancel) | `--border` border, `--foreground` text |
| Destructive | Delete, revoke | `--destructive` bg, `--destructive-foreground` text |
| Ghost | Language/theme chips | transparent bg, `--muted-foreground` text |

All buttons: `rounded-md`, `px-4 py-2`, `font-medium`, focus-visible ring (`--ring`).

### 4.2 Form controls
- **Input:** `--input` bg, `--border` border, `rounded-md`, `py-2 px-3`, focus ring `--ring`, error state uses `--destructive` border.
- **Label:** `--foreground`, `text-sm font-medium`, `mb-1`, `block`.
- **Helper text:** `--muted-foreground`, `text-xs`, `mt-1`.
- **Error message:** `--destructive` text, `text-xs`, `mt-1`, `role="alert"`.
- **Select / Combobox:** shadcn `Select`, same border/focus tokens as Input.
- **Show password toggle:** ghost button inside input suffix.

### 4.3 Alert / status banner
| Variant | Token | Use |
|---------|-------|-----|
| Info | `--primary` bg (10% opacity), `--primary` text | Feature notices |
| Warning | `--accent` bg (10% opacity), `--accent-foreground` text | Consent reminders |
| Error | `--destructive` bg (10% opacity), `--destructive` text | Form validation errors |
| Success | Green (`hsl(142, 70%, 45%)`) | Confirmation toasts |

Never show raw stack traces or "Authentication is not configured."

### 4.4 Cards & containers
- Card: `--background` bg, `--border` border, `rounded-lg`, `p-6`, shadow `0 1px 2px 0 rgb(0 0 0 / 0.05)`.
- Section: heading (`--text-section-heading`) + intro paragraph + content grid.

### 4.5 Language & theme switchers
- Language combobox: label "Interface language", options English / Twi / Ewe / Ga / Hausa. Default English. Persist selection to `localStorage` key `gha-interface-language`.
- Theme combobox: options System / Light / Dark. Default System.
- Both: shadcn `Select`, compact height (`h-9`), clear labels, visible selected value.

---

## 5. Page-by-Page Specs

### 5.1 Landing page (public)
**Sections (top to bottom):**

1. **Banner / Nav** — logo left, language/theme switches center, auth buttons right.
2. **Hero** —
   - Badge: "HEALTH INFORMATION · GHANA"
   - H1: "Care starts with being understood."
   - Subhead: "A health information service shaped for Ghana’s languages, with access to clinician review."
   - Primary CTA: "Create a patient account →" (button, default variant)
   - Secondary CTA: "Sign in" (outline)
3. **Designed for** — horizontal list of five languages with labels (English, Twi, Ewe, Ga, Hausa).
4. **Feature articles (3 cards):**
   - Card 1: "English · Twi · Ewe · Ga · Hausa" — Choose your preferred language.
   - Card 2: "Clinician review" — Patient messages can be routed for human review.
   - Card 3: "Health information" — AI-generated answers are not available yet.
5. **Complementary info block** — Replace cryptic "GH · 01" with a clear label (e.g., "Country code +233 · Ghana") or remove.
6. **Disclaimer (contentinfo)** — "This application is not clinically validated and does not provide diagnosis or treatment. Contact a qualified health professional for care." Icon (info circle) + text, not hidden.

### 5.2 Patient registration (modal or dedicated route)
**Fields (single column, stacked):**
1. Full name (textbox, placeholder "Your name", required, min 2 chars)
2. Preferred language (combobox, default English)
3. Email address (textbox, type=email, required)
4. Password (textbox, type=password, min 12 chars, "Show password" toggle)
5. Confirm password (textbox, type=password)
6. Helper: "Use at least 12 characters. Choose a unique password."
7. Submit: "Create patient account →" (default button, full-width on mobile)
8. Link: "Already have an account? Sign in"

**Validation messages (localized):**
- Name too short → "Full name must be at least 2 characters."
- Invalid email → "Enter a valid email address."
- Password too short → "Password must be at least 12 characters."
- Mismatch → "Passwords do not match."
- Backend error → Friendly message, never "503" or raw SQL errors.

### 5.3 Sign in
Minimal: email, password, "Sign in" button, "Create account" link. CSRF token handled silently via cookie; user never sees CSRF errors.

### 5.4 Patient workspace (post-login)
- Conversation list: search, open, rename, delete, share.
- Conversation detail: messages, consent toggle, message composer.
- Empty state: friendly illustration + "No conversations yet. Start one by sending a health question."

### 5.5 Clinician workspace
- Review queue table: patient, language, message preview, status.
- Review note editor, history, audit events.
- Role gate: unverified doctors see a pending state, not the queue.

### 5.6 Admin workspace
- Overview stats, user activation, clinician verification, recent audit log.
- All actions require admin role; clinician creation requires admin authentication.

---

## 6. States & Empty States

| State | Requirement |
|-------|-------------|
| Loading | Skeleton shimmer or spinner; never a blank white page. |
| Empty | Illustration + headline + primary CTA (e.g., "Create your first conversation"). |
| Error | Friendly headline ("Something went wrong"), plain-language explanation, retry or "Back" action. |
| Forbidden (403) | "You don’t have permission to view this page." + Sign in link. |
| Not found (404) | "Page not found." + Home link. |

No `console.error` strings, no "Authentication is not configured", no raw HTTP status codes in UI.

---

## 7. Accessibility Checklist (WCAG 2.2 AA)

- [ ] Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text.
- [ ] Focus-visible rings on all interactive elements (`--ring`, 2px).
- [ ] Touch targets ≥ 44×44 CSS px (buttons, inputs, switches).
- [ ] All form inputs have visible `<label>` or `aria-label`.
- [ ] Error announcements use `role="alert"` or `aria-live="polite"`.
- [ ] Language switcher announces current language to screen readers.
- [ ] Skip-to-content link at top of page.
- [ ] No color-only information (icons + text for status).
- [ ] Respect `prefers-reduced-motion` (no auto-playing animations).
- [ ] Zoom to 200% without loss of content or functionality.

---

## 8. Online References for Implementation

Use these free resources to execute the spec without sugarcoating gaps:

| Topic | Resource | Why it matters here |
|-------|----------|---------------------|
| Health service UI tone & forms | **NHS Service Manual** (service-manual.nhs.uk) | Gold standard for public health UI patterns, plain language, and accessibility. |
| Accessibility baseline | **WCAG 2.2** (w3.org/WAI/WCAG22/) | Contrast, focus, touch targets; required for a health app handling sensitive data. |
| Accessible components | **Radix UI** (radix-ui.com) | Headless accessible dialog, select, toggle primitives matching your React stack. |
| Copy/paste component library | **shadcn/ui** (ui.shadcn.com) | Pre-built accessible buttons, forms, selects, alerts on Tailwind — accelerates consistent UI. |
| Utility CSS | **Tailwind CSS** (tailwindcss.com) | Consistent spacing/scale system instead of ad-hoc layout. |
| Form UX research | **Baymard Institute** (baymard.com) | Registration/login/password error-message patterns. |
| Health communication clarity | **CDC Clear Communication Index** (cdc.gov) | Making disclaimers and health info readable and trustworthy. |
| Government design system | **U.S. Web Design System** (designsystem.digital.gov) | Federal health site form patterns and plain-language disclaimers. |
| Multilingual mobile patterns | **Google Material Design** (material.io — localization, adaptive layouts) | Five-language switching and responsive mobile layouts. |
| Color contrast testing | **WebAIM Contrast Checker** (webaim.org/resources/contrastchecker/) | Verify your `--primary` and `--foreground` meet AA before shipping. |

---

## 9. Out of Scope (MVP)

- AI-generated health answers (explicitly not available per project constraints).
- Speech recognition / synthesis.
- Public share links beyond clipboard copy.
- Password reset email flow (SMTP not configured).
- Dark-mode illustrations or illustrations of any kind (text-only hero acceptable for MVP).
- Clinician/admin dashboards beyond role-gated tables.

---

**Owner:** Frontend lead  
**Review:** Product + accessibility stakeholder  
**Next step:** Implement Tailwind token config + shadcn/ui button/input/select, then rebuild landing page and registration modal per Sections 5.1–5.2.
