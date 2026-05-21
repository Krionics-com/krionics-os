# Source Summary: Krionics OS Reply Subsystem

Summary
- Detailed subsystem spec for reply ingestion, classification, review queue, and auto-send flow.
- Defines reply state machine, data schema, queue contracts, webhook contracts, and retries.
- Documents Claude prompt structure, validation rules, and idempotency handling.

Key points
- Ingestion validates HMAC, enforces idempotency, writes raw replies, and enqueues classification.
- Classification output routes to draft generation, review, suppression, or nurture paths by intent and confidence.
- Review queue uses SLA-based prioritization and operator locks to prevent concurrent edits.
- Scheduling enforces business hours and delay windows before sending via Instantly.

Sources
- [raw/sources/2026-05-20-krionics-os-reply-subsystem.md](../../raw/sources/2026-05-20-krionics-os-reply-subsystem.md)
