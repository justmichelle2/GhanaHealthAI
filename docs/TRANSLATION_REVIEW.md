# Translation Review Matrix

**Release gate: NOT READY.** English is the complete source catalog in `frontend/src/i18n/locales/en.ts` (183 keys). Twi (`tw`), Ewe (`ee`), Ga (`gaa`) and Hausa (`ha`) use sparse resources and currently have no reviewed entries, so the application falls back to English. Every patient, authentication, recovery, clinician and administrator screen now uses translation keys, so reviewed strings will appear without further code changes. This interface must not be described as fully translated.

The translated interface is incomplete by design: the four non-English catalogs are intentionally empty until a competent speaker supplies reviewed text. The language selector shows a coverage notice whenever a non-English interface language is selected, and the safety-critical text falls back to English rather than being guessed.

Each non-English entry needs translation by a competent speaker, independent review by another speaker, and clinical/legal review where the text concerns health, consent, safety, or privacy. Medical terminology and emergency notices must not be translated by guesswork.

| Translation key | English source | Twi | Ewe | Ga | Hausa | Review status |
|---|---|---|---|---|---|---|
| languageLabel | Interface language | Pending | Pending | Pending | Pending | Awaiting speaker review |
| conversationLanguage | Health conversation language | Pending | Pending | Pending | Pending | Awaiting speaker review |
| signIn | Sign in | Pending | Pending | Pending | Pending | Awaiting speaker review |
| createAccount | Create account | Pending | Pending | Pending | Pending | Awaiting speaker review |
| heroHeadline | Healthcare information, understood in your language. | Pending | Pending | Pending | Pending | Awaiting speaker review |
| heroLead | A health information service shaped for Ghana’s languages. Messages you choose to send are saved for clinician review. | Pending | Pending | Pending | Pending | Health/privacy review required |
| registrationAcknowledgement | I understand that account details are stored and that each message is stored only if I consent before sending it. | Pending | Pending | Pending | Pending | Privacy/legal review required |
| accountDataNotice | Your account details are stored to provide this service. A message is stored only after you give consent before sending it. | Pending | Pending | Pending | Pending | Privacy/legal review required |
| consentToStoreMessage | I consent to storing this message for clinician review. Do not include details about emergencies; contact local emergency services. | Pending | Pending | Pending | Pending | Clinical/privacy review required |
| chatNotice | Saved for clinician review. Automated answers are unavailable. | Pending | Pending | Pending | Pending | Clinical review required |
| healthServiceNotice | This application is not clinically validated and does not provide diagnosis or treatment. Contact a qualified health professional for care. | Pending | Pending | Pending | Pending | Clinical review required |
| healthInfoTitle | Health information | Pending | Pending | Pending | Pending | Clinical review required |
| howStepMessageBody | Before sending, review the storage notice and give consent for that message. | Pending | Pending | Pending | Pending | Privacy/legal review required |
| howStepReviewBody | Messages are routed for authorized clinician review; no automated reply is generated. | Pending | Pending | Pending | Pending | Clinical/privacy review required |
| privacyBody | Only include information needed for your question. Messages you submit are stored and visible to authorized reviewers. Do not use this service for emergencies. | Pending | Pending | Pending | Pending | Clinical/privacy review required |
| faqAnswerEmergency | No. Contact local emergency services or a qualified health professional. | Pending | Pending | Pending | Pending | Clinical review required |
| forgotPassword | Forgot password? | Pending | Pending | Pending | Pending | Awaiting speaker review |
| resetPassword | Reset password | Pending | Pending | Pending | Pending | Awaiting speaker review |
| sendResetLink | Send reset link | Pending | Pending | Pending | Pending | Awaiting speaker review |
| newPassword | New password | Pending | Pending | Pending | Pending | Awaiting speaker review |
| confirmPassword | Confirm new password | Pending | Pending | Pending | Pending | Awaiting speaker review |
| passwordGuidance | Use at least 12 characters. | Pending | Pending | Pending | Pending | Awaiting speaker review |
| resetUnavailable | This reset link is invalid or expired. Request a new one. | Pending | Pending | Pending | Pending | Awaiting speaker review |
| shareConversation | Share conversation | Pending | Pending | Pending | Pending | Awaiting speaker review |
| shareWarning | Anyone with this link may view the conversation until it expires or you revoke it. The link does not show your account profile. | Pending | Pending | Pending | Pending | Privacy/legal review required |
| confirmSharing | I understand and want to create this read-only link. | Pending | Pending | Pending | Pending | Privacy/legal review required |
| createShareLink | Create share link | Pending | Pending | Pending | Pending | Awaiting speaker review |
| copyLink | Copy link | Pending | Pending | Pending | Pending | Awaiting speaker review |
| revokeLink | Revoke link | Pending | Pending | Pending | Pending | Awaiting speaker review |
| sharedReadOnly | This conversation is shared read-only. Do not rely on it for emergency care. | Pending | Pending | Pending | Pending | Clinical/legal review required |
| unavailable | This link is unavailable or has expired. | Pending | Pending | Pending | Pending | Awaiting speaker review |
| consentRequired | Please give consent before sending this message. | Pending | Pending | Pending | Pending | Privacy/legal review required |
| replyToPatient | Reply to patient (visible to the patient) | Pending | Pending | Pending | Pending | Clinical/privacy review required |
| replyToPatientHint | This reply is added to the conversation as a clinician message. Do not include information the patient should not see. | Pending | Pending | Pending | Pending | Clinical/privacy review required |
| internalOnly | (internal, not sent to patient) | Pending | Pending | Pending | Pending | Clinical/privacy review required |
| reviewRecordedWithReply | Review recorded and the reply was added to the conversation. | Pending | Pending | Pending | Pending | Clinical review required |
| errorCredentials | The email or password is not correct. | Pending | Pending | Pending | Pending | Awaiting speaker review |
| errorGeneric | The request could not be completed. Please try again shortly. | Pending | Pending | Pending | Pending | Awaiting speaker review |
| loading | Loading… | Pending | Pending | Pending | Pending | Awaiting speaker review |

The catalog in `en.ts` is the source text for all keys, including keys not yet listed in this prioritized review table. A full translation pass should export every catalog key into this matrix before translation begins. The interface language is stored separately in `gha-interface-language`; the health-conversation language remains a patient profile/conversation value. English is the fallback for a missing or blank key. No machine-generated health or safety translation is accepted as reviewed.
