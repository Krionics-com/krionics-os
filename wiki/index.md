# Wiki Index

Root docs
- [AGENTS.md](../AGENTS.md) - Universal AI operating manual and schema.

Core operations
- [wiki/log.md](log.md) - Append-only timeline of ingests, queries, and lint passes.
- [wiki/README.md](README.md) - Folder conventions and naming rules.
- [wiki/workflows/standards.md](workflows/standards.md) - Workflow documentation standard.

Sources
- [wiki/sources/2026-05-20-llm-wiki-idea.md](sources/2026-05-20-llm-wiki-idea.md) - Summary of the LLM Wiki pattern idea.
- [wiki/sources/2026-05-20-krionics-os-architecture.md](sources/2026-05-20-krionics-os-architecture.md) - Summary of the Krionics OS architecture document.
- [wiki/sources/2026-05-20-krionics-os-blueprint.md](sources/2026-05-20-krionics-os-blueprint.md) - Summary of the Krionics OS implementation blueprint.
- [wiki/sources/2026-05-20-krionics-os-reply-subsystem.md](sources/2026-05-20-krionics-os-reply-subsystem.md) - Summary of the reply ingestion and review subsystem.
- [wiki/sources/2026-05-21-supabase-schema-migration.md](sources/2026-05-21-supabase-schema-migration.md) - Detailed record of the 17-migration Supabase schema build and packages/db runner.
- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](sources/2026-05-23-krionics-os-architecture-v1.md) - Full summary of Master System Architecture Document v1.0 (canonical reference). Covers all 17 sections including state machine, event catalog, queue definitions, AI invocation points, automation levels, prompt engineering, and implementation status.

Concepts
- [wiki/concepts/llm-wiki.md](concepts/llm-wiki.md) - Concept page for the LLM Wiki pattern.

Architecture
- [wiki/architecture/standards.md](architecture/standards.md) - Architecture documentation standard.
- [wiki/architecture/database-schema.md](architecture/database-schema.md) - PostgreSQL schema overview: table groups, RICR subsystem, partitioned tables, key design decisions.
- [wiki/architecture/ai-provider.md](architecture/ai-provider.md) - AI Provider strategy pattern: 6-method AIProvider interface, ClaudeProvider/OpenAIProvider, PromptBuilder 6-layer architecture, per-client provider override.

Projects
- [wiki/projects/2026-05-21-monorepo-scaffold.md](projects/2026-05-21-monorepo-scaffold.md) - Monorepo scaffold and AI provider DIP implementation.
- [wiki/projects/2026-05-22-supabase-pooler-migration-fix.md](projects/2026-05-22-supabase-pooler-migration-fix.md) - Supabase session pooler migration fix and RLS policy correction.
- [wiki/projects/2026-05-22-ricr-queue-workers.md](projects/2026-05-22-ricr-queue-workers.md) - BullMQ workers for RICR ingest/classify/draft/review dispatch with bug fixes and scheduled send worker.
- [wiki/projects/2026-05-22-operator-dashboard-phase1.md](projects/2026-05-22-operator-dashboard-phase1.md) - Operator dashboard Phase 1 (auth, queue list, approve/reject).
- [wiki/projects/2026-05-22-operator-dashboard-phase2.md](projects/2026-05-22-operator-dashboard-phase2.md) - Operator dashboard Phase 2 (settings, admin, real-time, responsive mobile, markdown editor, e2e, error boundaries).
- [wiki/projects/2026-05-23-dashboard-phase1-foundation.md](projects/2026-05-23-dashboard-phase1-foundation.md) - Dashboard Phase 1 — Design Foundation.
- [wiki/projects/2026-05-23-dashboard-phase2-review-system.md](projects/2026-05-23-dashboard-phase2-review-system.md) - Dashboard Phase 2 — Reply Review System.
- [wiki/projects/2026-05-23-dashboard-phase3-global-ops.md](projects/2026-05-23-dashboard-phase3-global-ops.md) - Dashboard Phase 3 — Global Ops Dashboard.
- [wiki/projects/2026-05-23-dashboard-phase4-queue-monitoring.md](projects/2026-05-23-dashboard-phase4-queue-monitoring.md) - Dashboard Phase 4 — Queue Monitoring & DLQ Inspector.
- [wiki/projects/2026-05-23-dashboard-phase5-client-management.md](projects/2026-05-23-dashboard-phase5-client-management.md) - Dashboard Phase 5 — Client Management & Profiles.
- [wiki/projects/2026-05-23-dashboard-phase6-campaign-management.md](projects/2026-05-23-dashboard-phase6-campaign-management.md) - Dashboard Phase 6 — Campaign Management.
- [wiki/projects/2026-05-23-dashboard-phase7-ai-operations.md](projects/2026-05-23-dashboard-phase7-ai-operations.md) - Dashboard Phase 7 — AI Operations.
- [wiki/projects/2026-05-23-dashboard-phase8-infrastructure.md](projects/2026-05-23-dashboard-phase8-infrastructure.md) - Dashboard Phase 8 — Infrastructure Health & Domain Reputation.
- [wiki/projects/2026-05-23-dashboard-phase9-analytics.md](projects/2026-05-23-dashboard-phase9-analytics.md) - Dashboard Phase 9 — Analytics & Reporting.
- [wiki/projects/2026-05-23-dashboard-phase10-alerts.md](projects/2026-05-23-dashboard-phase10-alerts.md) - Dashboard Phase 10 — Alerts Center & Rules Configurations.
- [wiki/projects/2026-05-23-dashboard-phase11-audit.md](projects/2026-05-23-dashboard-phase11-audit.md) - Dashboard Phase 11 — Immutable Audit Logs.
- [wiki/projects/2026-05-23-dashboard-phase12-voice-agents.md](projects/2026-05-23-dashboard-phase12-voice-agents.md) - Dashboard Phase 12 — Voice Agents Call Monitoring.
- [wiki/projects/2026-05-23-dashboard-phase13-admin-config.md](projects/2026-05-23-dashboard-phase13-admin-config.md) - Dashboard Phase 13 — Global Configurations & Feature Flags.
- [wiki/projects/2026-05-23-dashboard-phase14-search.md](projects/2026-05-23-dashboard-phase14-search.md) - Dashboard Phase 14 — Command Palette & Global Search.
- [wiki/projects/2026-05-23-reply-orchestration-phase1-3.md](projects/2026-05-23-reply-orchestration-phase1-3.md) - Reply Orchestration System Phase 1-3: DB migrations (enriched_leads, events, lead_state_history, reply_policies, timing_rules, response_queue), Instantly webhook handler, lead state machine. Merged to main via PR #4.

Ingest records
- [wiki/ingest/2026-05-20-llm-wiki-idea.md](ingest/2026-05-20-llm-wiki-idea.md) - First ingest example and actions taken.
- [wiki/ingest/2026-05-20-krionics-os-architecture.md](ingest/2026-05-20-krionics-os-architecture.md) - Ingest record for the Krionics OS architecture document.
- [wiki/ingest/2026-05-20-krionics-os-blueprint.md](ingest/2026-05-20-krionics-os-blueprint.md) - Ingest record for the implementation blueprint.
- [wiki/ingest/2026-05-20-krionics-os-reply-subsystem.md](ingest/2026-05-20-krionics-os-reply-subsystem.md) - Ingest record for the reply subsystem spec.
- [wiki/ingest/2026-05-21-supabase-schema-migration.md](ingest/2026-05-21-supabase-schema-migration.md) - Ingest record for the Supabase schema migration build session.
- [wiki/ingest/2026-05-28-module-0-ai-provider-strategy.md](ingest/2026-05-28-module-0-ai-provider-strategy.md) - Module 0: AI Provider strategy pattern — extended to 6 AI invocation points, PromptBuilder, factory fix, worker callsite fixes.
