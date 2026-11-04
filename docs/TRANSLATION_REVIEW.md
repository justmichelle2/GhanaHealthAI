# Translation Review Matrix

**Release gate: NOT READY.** English is the only complete and reviewed resource. Twi (`tw`), Ewe (`ee`), Ga (`gaa`) and Hausa (`ha`) resource files intentionally contain blank values, so the application falls back to English. No machine-generated or unreviewed Ghanaian-language text is presented as verified. The current change localizes the account-recovery and conversation-sharing strings; other existing screens still contain English UI literals and require key extraction before the interface can be called fully translated.

Each non-English entry needs translation by a competent speaker, independent review by another speaker, and clinical/legal review where the text concerns health, consent, safety, or privacy. Medical terminology and emergency notices must not be translated by guesswork.

| Translation key | English source | Twi | Ewe | Ga | Hausa | Review status |
|---|---|---|---|---|---|---|
| languageLabel | Interface language | Pending | Pending | Pending | Pending | Awaiting speaker review |
| signIn | Sign in | Pending | Pending | Pending | Pending | Awaiting speaker review |
| createAccount | Create account | Pending | Pending | Pending | Pending | Awaiting speaker review |
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
| loading | Loading… | Pending | Pending | Pending | Pending | Awaiting speaker review |

The interface language is stored separately in `gha-interface-language`; the health-conversation language remains a patient profile/conversation value. English is the fallback for a missing or blank key.
