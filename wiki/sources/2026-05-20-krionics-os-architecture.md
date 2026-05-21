# Source Summary: Krionics OS Architecture

Summary
- Defines Krionics OS as a multi-tenant, AI-orchestrated outbound infrastructure platform with a state-driven, event-based core.
- Establishes architectural principles: explicit lead state machine, immutable events, queue-based async processing, and config-driven workflows.
- Documents the end-to-end operational pipeline, service boundaries, and multi-tenant isolation rules.

Key points
- Supabase is the operational source of truth; HubSpot is a sales visibility layer only.
- Workflows are modular, event-triggered, and do not call each other directly.
- Reply orchestration uses AI classification with automation levels and human-in-the-loop gates.
- Observability is first-class: event history, queues, logs, and dashboard metrics are core system features.

Sources
- [raw/sources/2026-05-20-krionics-os-architecture.md](../../raw/sources/2026-05-20-krionics-os-architecture.md)
