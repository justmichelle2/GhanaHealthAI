# Health Data Handling Policy (draft for review)

**Approval:** not approved · **Hosting and subprocessors:** not selected

Health messages and clinician-review notes can contain sensitive health information. With separate per-message consent, the current message is sent to Dahl Inference to generate an AI reply; prior conversation content is not sent. The application stores messages and replies in PostgreSQL; uses role-based patient, verified-clinician and administrator routes; requires a patient account for normal conversation access; and audits selected account, review, and sharing events. Conversation deletion cascades to its messages and share records. Password-reset and share secrets are stored as SHA-256 digests; raw values are returned/sent once. The public share view contains message text and timestamps but omits user/conversation IDs and profile data.

The code does not establish encryption at rest, managed key rotation, backup encryption, production TLS, data residency, provider contracts, database least-privilege deployment, or a security operations process. TLS and protected infrastructure must be configured and externally verified. Application logs must never include health message bodies, passwords, cookies, reset tokens or share tokens.

Before launch, document approved purposes, access approval/removal, staff confidentiality, provider/subprocessor agreements, data locations, encryption and key management, backup controls, retention, export/deletion, incident escalation and periodic access reviews. Confirm Ghana Data Protection Act 2012 (Act 843) obligations with qualified counsel and the Data Protection Commission.
