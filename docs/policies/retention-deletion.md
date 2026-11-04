# Data Retention and Deletion Policy (draft for review)

**Approval:** not approved · **Retention periods:** undecided

The application currently keeps user profiles, conversations, messages and audit events until an administrator performs database operations or a patient deletes an individual conversation. There is no account deletion endpoint, retention scheduler, automatic purge of expired/used password-reset records, rate-limit bucket cleanup, or backup lifecycle configured. Expired and revoked share links stop granting access but their metadata remains in the database until conversation deletion or administrator maintenance. Audit rows are not deleted with a conversation because their resource reference is stored as text.

Before launch, the data controller must define and publish retention periods by record type, legal holds, deletion and export procedures, backup expiry, reset/share/rate-limit cleanup, audit minimization, and response timelines. Test deletion against backups and restores. Do not describe automatic erasure until a scheduled process and backup policy have been implemented and verified.
