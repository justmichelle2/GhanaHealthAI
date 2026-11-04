# Ghana Health Assistant UI/UX Audit

**Audit date:** 2026-11-04  
**Scope:** Existing React/TypeScript application in `frontend/src/App.tsx`, `index.css`, `share.css`, `responsive-dark.css`, and the current locale resources. The audit describes the checked-in implementation; it does not treat planned AI, speech, or clinical functionality as present.

## Summary

The application already has real patient authentication, account recovery, profile preferences, consented patient submissions, clinician review, administrator controls, conversation history, and expiring share links. The most serious UI weakness is the gap between that working product and a consistent, fully translated experience: most copy is embedded directly in one large component, while the translation files contain only a small set of account recovery and sharing labels. Non-English resource files are intentionally blank and correctly fall back to English.

## Findings

| Area | Observed weakness | User impact | Improvement |
|---|---|---|---|
| Frontend structure | `App.tsx` contains route state, API calls, form handling, dialogs and all role screens in one component. | Changes are hard to review and repeated interaction patterns drift. | Extract shared presentational controls and page sections without changing API ownership or role checks. |
| Design system | `index.css` and `responsive-dark.css` contain layered overrides and repeated literal colors. `share.css` has fallback colors of its own. | Theme changes can miss a component and later rules can silently override earlier ones. | Keep one semantic token layer for colors, spacing, typography, radii, shadows and control sizes; consume it in shared component styles. |
| Landing page | The visual includes the internal label “GH · 01”; the header and page content use separate width rules. Content is short on product information. | Internal-looking decoration and unclear service boundaries reduce trust. | Remove the code-like marker, align the content container, and explain the real language and clinician-review workflow without claiming clinical validation. |
| Registration | The form asks for name, language, email and password, but does not ask the user to acknowledge data storage/privacy terms. Password confirmation is present; accessible inline guidance and strength feedback are limited. | Patients may not understand what account creation entails; errors are harder to correct. | Use clear labels, password guidance, explicit acknowledgement tied to existing consent/privacy text, accessible errors, and a privacy link. Do not collect health details at registration. |
| Login and recovery | Recovery is implemented, but most page copy is hardcoded. The request helper can expose raw backend detail, including an authentication-configuration message. | Language switching is incomplete and infrastructure details can confuse patients. | Translate user-facing copy through keys and map infrastructure failures to a short retry message while retaining server-side diagnostics. |
| Patient dashboard | Dashboard, notices and action cards use small supporting text and fixed visual sizing. The dashboard has limited recent-activity context. | Patients may have difficulty scanning their next step, particularly on small screens. | Increase text sizing, use available height sensibly, and keep actions and status information clear without inventing metrics. |
| Patient chat | The existing patient profile language is used for conversation requests; it is not the same setting as interface language, though the UI labels do not explain that distinction consistently. | Patients may assume a language change translates the whole application or activates speech/AI. | Label interface language and health-conversation language separately. State that automated answers and speech are unavailable. |
| Conversation history | Rename uses `window.prompt`; delete uses `window.confirm`. These are browser dialogs, not app-styled accessible dialogs, and their text is hardcoded. | Dialog appearance varies by browser and keyboard/screen-reader context. | Replace with a small accessible, keyboard-operable app dialog; retain owner checks and existing APIs. |
| Profile | Interface language is saved in local storage; the patient's health-conversation language is saved to the backend profile. The distinction needs clearer labels. | Users may not know which preference follows their account to another browser. | Explain the two settings. Preserve backend persistence for conversation language and browser-local persistence for interface language unless a reviewed account-level schema change is approved. |
| Clinician workspace | Queue, review status and notes are functional, but many labels and action messages are inline English strings. | Clinicians receive inconsistent terminology and the locale selector only translates a few shared labels. | Extract role labels and feedback strings; keep patient content and clinician notes unchanged. |
| Administrator workspace | User management, verification and audit events are functional, but page copy is inline and administrative actions lack a common interaction language. | Repeated actions and success/error feedback are harder to understand consistently. | Use shared buttons, confirmation patterns, alerts and translation keys while preserving authorization checks. |
| Dialogs and notifications | The share dialog has semantic dialog attributes, but no demonstrated focus trap, Escape close, or focus return. Several success/error states use inline strings. | Keyboard users may lose their place; visual and spoken feedback can differ. | Implement focus entry/return and Escape handling for dialogs, and use shared status/alert components with `role=status`/`role=alert`. |
| Multilingual support | `resources.ts` has English plus 4 blank resources. Only 18 keys exist; most page content is hardcoded. | Selecting Twi, Ewe, Ga or Hausa mostly leaves the interface in English. | Build the complete English key catalog first; use English fallback for pending translations and maintain a speaker/clinical review matrix. Do not claim reviewed translations. |
| Responsive/accessibility | Previous fixes define responsive breakpoints and focus rings, but no automated browser matrix is installed. Some old helper text remains below 13px and several dialogs/forms need a keyboard audit. | Layout quality and accessible contrast cannot be inferred from a successful build. | Keep the documented 360–1920 layout contract, use 44px controls, and run visual checks at the requested sizes whenever a browser harness is available. |
| Service boundary | The assistant saves messages for clinician review; there is no model response, speech recognition, text-to-speech, or triage engine. | A chat interface can otherwise imply automated medical guidance. | Keep unavailable states explicit and do not add fabricated answers or health claims. |

## Existing capabilities confirmed in code

- Patient-only public registration; backend assigns roles and enforces role checks.
- HttpOnly cookie authentication, CSRF protection, password recovery, and session handling.
- Patient profile stores full name and preferred health-conversation language.
- Patients can create, search, open, rename and delete conversations, submit consented messages, and manage expiring share links.
- Verified clinicians can review patient submissions and save internal notes.
- Administrators can manage account status, clinician verification and audit metadata.
- Theme choice persists in local storage and system mode listens for OS theme changes.
- Interface language persists in local storage, but only a small subset of strings currently uses it.

## Not implemented and not to be implied by the UI

- Automated health answers, approved document retrieval, diagnosis, triage, transcription, or speech synthesis.
- Professionally reviewed Twi, Ewe, Ga or Hausa interface copy.
- A production clinical governance, privacy/legal approval, or real-device validation program.

## Implementation follow-up (2026-11-04)

- The landing page now includes About, workflow, language, privacy, FAQ and patient-account sections. The internal-looking `GH · 01` decoration is removed, and non-English interface selections show that untranslated content falls back to English.
- Primary registration/login copy uses the English translation catalog. Registration has an account-data acknowledgement disclosure, a separate health-conversation language setting, and a reminder that message consent is requested separately at submission time. This acknowledgement is not sent to or persisted by the backend.
- API failures shown in the UI use safe retry/validation text rather than raw server details. Conversation rename/delete now use an in-app keyboard-operable dialog instead of native browser prompts.
- The expanded English catalog and sparse locale fallback compile and pass the locale tests. Twi/Ewe/Ga/Hausa translations remain empty pending speaker review; dashboard, clinician and administrator pages still contain untranslated literals. The audit is therefore still open for full multilingual completion, the share dialog's focus lifecycle, and visual review of authenticated role screens at phone/tablet sizes.

