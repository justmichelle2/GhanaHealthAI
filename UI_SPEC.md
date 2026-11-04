# Ghana Health Assistant UI Specification

**Status:** Source of truth for the UI/UX implementation.  
**Product boundary:** Patient-submitted health questions are saved for clinician review. The service is not clinically validated and does not provide diagnosis, treatment, emergency response, automated answers, triage, or speech processing.

## A. Product direction

Create a professional, calm, human-centred health-information service for Ghana. Use a recognisable teal identity, warm-neutral accents, slate text, quiet surfaces and clear privacy language. Avoid generic AI imagery, code-like decoration, glow effects, redundant cards and unsupported healthcare claims. The visual system supports patients, verified clinicians and administrators without implying that all three roles have the same tasks.

## B. Design principles

1. **Clarity first:** each screen has one clear heading and a visible next action.
2. **Plain language:** explain what is saved, who can see it, and what the service cannot do.
3. **Consistency:** shared tokens and controls keep roles and pages visually related.
4. **Readable by default:** 16px body copy, 13px minimum supporting copy, 12px uppercase eyebrows, 44px minimum touch targets.
5. **Accessible interaction:** semantic controls, associated labels, keyboard operation, visible focus, announced errors/status, reduced-motion support.
6. **Responsive without feature loss:** navigation becomes a drawer on narrow screens; content reflows rather than shrinking into illegible columns.
7. **Privacy and trust:** consent appears at the point of message storage; external share links disclose access and expiry.
8. **Honest multilingual support:** English is the fallback. Non-English text remains marked for review until competent speakers and, for health/privacy copy, appropriate professionals approve it.
9. **No fabricated health functionality:** unavailable AI and speech states remain explicit.

## C. Typography

- **Font stack:** `Inter, "Segoe UI", Arial, sans-serif`; system fallbacks cover English and Latin characters used by Twi, Ewe, Ga and Hausa. Do not load a remote font at runtime.
- **Body:** 16px / 1.55–1.7, regular weight.
- **Supporting copy:** 13–15px / 1.45–1.6; never use below 13px for meaningful content.
- **Form labels and buttons:** 15px, 600–700 weight.
- **Eyebrows:** 12px, 700–800 weight, letter spacing no more than 1.2px.
- **Headings:** responsive `clamp()` sizes; page title 30–48px desktop and 26–36px mobile; section headings 20–28px.
- **Message text:** 16px / 1.6; metadata 13px.
- Use normal sentence case except short section eyebrows and status labels.

## D. Spacing and layout

Spacing tokens use a 4px base: `space-1` 4px, `space-2` 8px, `space-3` 12px, `space-4` 16px, `space-5` 20px, `space-6` 24px, `space-8` 32px, `space-10` 40px, `space-12` 48px, `space-16` 64px.

- Public pages share a centered 1440px maximum container with 16–64px fluid gutters.
- Signed-in shell fills `100dvh`: 72px desktop header, 280px desktop navigation, remaining width for the main panel. Only the main panel scrolls.
- Tablet breakpoint: 768–1100px; navigation may reduce to 260px, content padding 24px.
- Mobile breakpoint: up to 768px; header 64px, full-width main panel, navigation drawer up to `min(86vw, 320px)`.
- Patient dashboard uses a flexible content column; action cards stretch to available height without forcing empty space on short viewports.
- Chat is a single-column card: header, independently scrolling message area, composer and consent. History stays in the application sidebar and opens as the same mobile drawer.
- Forms use one column; desktop authentication uses a brand panel plus a 480–520px form panel. Mobile forms stack.
- Controls have 44px minimum height; icons retain visible focus and accessible names.

## E. Semantic design tokens

The semantic token names are the API for page and component styles. Do not add one-off theme colors to page rules.

| Token | Light | Dark |
|---|---|---|
| `page-bg` | `#F6F8F5` | `#0B1220` |
| `surface` | `#FFFFFF` | `#111C2C` |
| `surface-raised` | `#F9FBF8` | `#162033` |
| `border` | `#DCE6E1` | `#2A3A52` |
| `text-primary` | `#183A38` | `#F8FAFC` |
| `text-secondary` | `#526866` | `#CBD5E1` |
| `text-muted` | `#667875` | `#ADBACB` |
| `accent` | `#087F70` | `#2DD4BF` |
| `accent-hover` | `#06685D` | `#5EEAD4` |
| `accent-contrast` | `#FFFFFF` | `#0B1220` |
| `warning-surface` | `#FFF7E8` | `#332C1E` |
| `warning-text` | `#A15C07` | `#FFE9B2` |
| `danger` | `#B42318` | `#FECACA` |
| `success` | `#16794A` | `#BBF7D0` |
| `focus-ring` | `#087F70` | `#5EEAD4` |

Secondary buttons remain white with a slate label in both themes. Color combinations used for body and control text target WCAG AA (4.5:1); verify contrast when changing token values.

Additional tokens cover typography sizes/weights/line heights, the 4px spacing scale, 8/12/16px radii, restrained surface shadows, 44px controls, 1440px content width, 72/64px headers, and 150–200ms transitions. Respect `prefers-reduced-motion`.

## F. Component standards

- **Buttons:** one shared `.button` family (`primary`, `outline`, `quiet`, `danger`, `small`, `large`, `full`). Consistent 44px height, clear disabled state, hover and focus. Do not use color alone for status.
- **Inputs/selects/textareas:** shared 44px minimum height, 15–16px text, visible border, tokenized placeholder, label, error description and focus ring. Textarea grows up to eight rows in chat.
- **Forms:** labels remain visible; validation is adjacent to its field or announced as a form error. Use autocomplete and correct input types.
- **Surfaces:** white/neutral cards with a 1px border and light shadow; use spacing before adding another card.
- **Alerts:** semantic success, warning and error tokens; status and error roles are announced.
- **Dialogs:** `role=dialog`, `aria-modal`, labelled title, focus moves inside, Escape closes where safe, close returns focus to opener. Destructive actions name the target.
- **Navigation:** full labels in expanded navigation; icon has fixed 20px width, label grows. Collapse is explicit on desktop; mobile uses a backdrop drawer and closes on navigation.
- **Tables/lists:** readable row density, responsive stacking where needed, status labels as text.
- **Chat:** patient messages right, clinician/system messages left, 75% desktop and 90% mobile maximum width, long words wrap. Message area scrolls independently; composer remains visible.
- **Loading/empty/error:** show a concise status and a real next action; never show raw stack traces, DB URLs or internal migration numbers.

## G. Page-specific standards

- **Landing:** aligned 1440px container, concise purpose statement, honest language support, how submission and clinician review work, privacy/limitations, FAQ and account CTA. No unsupported clinical claims or internal code labels.
- **Login/recovery:** focused form card, password visibility, reset link, safe error feedback. Do not add remember-me unless secure server support exists.
- **Registration:** patient role only; full name, email, password/confirmation, interface language via global selector, separate health-conversation language, privacy/consent acknowledgement and password guidance. Do not ask for medical details.
- **Patient overview:** account greeting, review status, recent conversation access, profile/language controls and one safety notice. Avoid decorative statistics without user value.
- **Chat/history:** keep list in application sidebar; support new, search, open, rename, delete and secure share using existing APIs. Clearly say that saved messages go to clinician review and no automated health answer is available.
- **Profile:** identify browser-local interface language separately from account-stored health-conversation language.
- **Clinician:** focus on pending queue, message, review action, internal note and review history; keep patient text access role-protected.
- **Administrator:** focus on user activation, clinician verification and audit metadata; confirm sensitive actions and avoid unnecessary patient data.

## H. Theme behavior

- `light`, `dark`, and `system` are available in the header and patient settings.
- System follows `prefers-color-scheme` live. Explicit choices override it.
- Theme choice persists in `localStorage` under `gha-theme` and is applied before React mounts to avoid a flash.
- All component colors consume semantic tokens. Inputs, disabled buttons, alerts, selection and focus remain legible in each mode.

## I. Responsive standards

- Breakpoints: 420px (small phone), 768px (mobile/tablet transition), 1100px (tablet/desktop density), 1440px (content max width).
- Verify widths 360, 390, 768, 1024, 1280, 1440 and 1920px; target screenshots include 1440×900, 1280×720, 1024×768, 768×1024, 390×844 and 360×800.
- At 360–768px, single-column public/auth pages, drawer navigation, no horizontal scrolling, touch controls >=44px, chat composer visible above the dynamic viewport edge.
- At 1024px and above, desktop shell retains a labelled sidebar; content and chat use the remaining width without a second history column.
- Longer translated strings may wrap; controls may grow; navigation labels do not truncate in expanded mode.

## J. Multilingual standards

- Supported language codes: `en` English, `tw` Twi, `ee` Ewe, `gaa` Ga, `ha` Hausa. Display names, not flags, identify languages.
- **Interface language** changes labels immediately and persists per browser in `gha-interface-language`.
- **Health-conversation language** is a separate patient profile/conversation field stored by the backend. It does not activate ASR or TTS.
- Speech recognition and text-to-speech are separate capabilities and currently unavailable.
- Every UI string uses a stable translation key. English is the complete fallback. Blank or absent translations fall back to English.
- Non-English keys are not considered complete until translated and reviewed by competent speakers; health, consent, privacy and safety strings also require appropriate professional review. Unreviewed text must never be described as clinically verified.

## K. Component-library decision

The frontend is a small React 18/TypeScript app with Vite and CSS, and has no Tailwind setup. Adding shadcn/ui would introduce Tailwind, Radix and build/configuration changes while duplicating existing CSS components. It is not justified for this pass. Reuse the existing semantic CSS classes and extract small React controls where that reduces duplication. Revisit a library if the app adopts a supported component architecture and dialog/form behavior cannot be maintained in-house.

## Implementation coverage

The current pass applies the token layer, public landing structure, interface-language fallback notice, primary authentication labels, account-data disclosure and keyboard-operable conversation rename/delete dialog. Existing theme persistence, responsive shell and authenticated APIs remain in use. The English catalog is the translation source of truth; non-English catalogs are intentionally sparse until competent-speaker review. The remaining patient dashboard/chat copy, clinician/admin pages and share-dialog focus lifecycle still need migration to shared keys and full keyboard review before this specification can be considered completely implemented.

