# Phase 7 — AI Operations

This document covers the Phase 7 implementation details of the Krionics Operator Dashboard, focusing on AI Prompt Management, Sandbox Test Runner, Invocation Logs Auditing, and performance analytics.

## Database Schema

### 1. `ai_prompts`
Represents prompts stored globally or scoped per client.
*   `id`: `UUID` (Primary Key)
*   `client_id`: `UUID` (References `clients(id)`, NULL represents global prompts)
*   `name`: `TEXT`
*   `slug`: `TEXT`
*   `version`: `INTEGER` (Auto-incremented on edit updates)
*   `invocation_type`: `ai_invocation_type` (Enum values: `reply_classification`, `draft_generation`, etc.)
*   `system_prompt`: `TEXT`
*   `user_template`: `TEXT`
*   `model`: `TEXT`
*   `max_tokens`: `INTEGER`
*   `temperature`: `NUMERIC`
*   `is_active`: `BOOLEAN`
*   `is_global`: `BOOLEAN`

### 2. `ai_invocations`
Partitioned operational log tracing execution metrics.
*   `id`: `UUID` (Primary Key combined with `invoked_at`)
*   `client_id`: `UUID`
*   `prompt_id`: `UUID` (References `ai_prompts(id)`)
*   `prompt_version`: `INTEGER`
*   `invocation_type`: `ai_invocation_type`
*   `latency_ms`: `INTEGER`
*   `input_tokens`: `INTEGER`
*   `output_tokens`: `INTEGER`
*   `success`: `BOOLEAN`
*   `cost_usd_micro`: `INTEGER` (Cost in micro-dollars, $0.000001 units)
*   `invoked_at`: `TIMESTAMPTZ` (Partitioning range key)

---

## Technical Flow Overview

### 1. Prompt Sandbox & Test Runner Flow
1. **Handlebars Extraction:** The prompt detail interface automatically extracts dynamic parameter keys (e.g. `{{message}}`) from the `user_template` using dynamic regular expression matching.
2. **Mock Inputs:** The operator enters test parameter mock-ups within standard fields.
3. **Execution Sandbox:** The `POST /api/dashboard/ai/prompts/[id]/test` endpoint replaces placeholders, measures request start timers, and calls Claude API via `@anthropic-ai/sdk` (with a clean mock fallback if `ANTHROPIC_API_KEY` is not present).
4. **Token Cost Tracking:** Ingestion and Output completion tokens are multiplied against model weights to calculate cost in micro-dollars (`cost_usd_micro`) and written to the `ai_invocations` table before returning responses to the UI.
5. **Validation Panel:** Evaluates return strings against specific criteria (response length, tone matches, and duplication).

---

## API Endpoints Built

*   `GET /api/dashboard/ai/prompts` - Lists all template prompts joining client company names.
*   `GET /api/dashboard/ai/prompts/[id]` - Returns complete prompt details.
*   `PATCH /api/dashboard/ai/prompts/[id]` - Updates prompt configurations and increments prompt `version` by 1.
*   `POST /api/dashboard/ai/prompts/[id]/toggle` - Inverts `is_active` status flags.
*   `POST /api/dashboard/ai/prompts/[id]/test` - Renders templates, invokes Claude, and records the logs.
*   `GET /api/dashboard/ai/logs` - Returns paginated, filtered invocation streams.
*   `GET /api/dashboard/ai/logs/[id]` - Fetches complete log detail metadata.
*   `GET /api/dashboard/ai/analytics` - Aggregates spending trends, percentile distributions, and token ratios.

---

## UI Components & Routing
1. **AI Prompts Management (`/dashboard/ai/prompts`):** Listing view with search, type tags, version badges, scopes, and direct toggles.
2. **AI Sandbox Detail (`/dashboard/ai/prompts/[id]`):** Left column contains monospace code editors, models, and sliders. Right column contains the Sandboxed Test Runner and validation cards.
3. **AI Invocation Logs (`/dashboard/ai/logs`):** Paginated table showing time agos, latencies, tokens, and micro-billing costs. Clicking rows opens a slide-over details drawer.
4. **AI Performance Analytics (`/dashboard/ai/analytics`):** Grid displaying 6 live operational metrics cards, alongside Recharts area spending trends, latency percentile bar charts, and token distributions.
