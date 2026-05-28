# Architecture: AI Provider Strategy Pattern

## Context

Krionics OS orchestrates outbound B2B email sales. Six discrete AI invocation points exist across the pipeline. Each invocation must be capable of routing to either Anthropic Claude or OpenAI-compatible APIs at runtime, selected globally via `AI_PROVIDER` env var and overridden per-client via `clients.config->>'ai_provider'`.

## Goals and non-goals

Goals
- Single `AIProvider` interface that abstracts all 6 invocation points.
- Zero-config swap between Claude and OpenAI without touching business logic.
- Per-client provider override without re-reading env vars on every call.
- Composable, layered prompts with a consistent structure across all methods.
- Strict Zod validation of all AI inputs and outputs.

Non-goals
- Streaming responses (not needed for batch reply processing).
- Model fine-tuning or embedding generation.
- Prompt caching / semantic deduplication.

## Constraints

- Providers must accept API keys from env vars only (never from DB or request payloads).
- `max_tokens` is bounded per operation to control cost.
- All outputs must pass schema validation before being returned to callers.
- Temperature 0 for classification/signal tasks; 0.3-0.4 for creative tasks (draft/sequence).

## Overview

A strategy pattern implemented in `packages/ai-provider/`:

```
createAIProvider(options?)  ←  factory
       │
       ├── ClaudeProvider   implements AIProvider (Anthropic Messages API)
       └── OpenAIProvider   implements AIProvider (OpenAI Chat Completions API)

buildPrompt(layers)  ←  prompt-builder (shared by both providers)
```

The factory reads `AI_PROVIDER` env var by default. Callers may pass `{ providerOverride }` to select a different provider for a specific client.

## Components

### `packages/schema/src/index.ts`
Zod schemas for all 6 AI invocation points. Each invocation point has a validated Input and Output type. Schemas are shared across packages.

| Invocation Point | Input Schema | Output Schema |
|---|---|---|
| 1. Signal extraction | `SignalExtractionInputSchema` | `SignalExtractionOutputSchema` |
| 2. Sequence generation | `SequenceInputSchema` | `SequenceOutputSchema` |
| 3. Reply classification | `ClassifyInputSchema` | `ClassificationOutputSchema` |
| 4. Draft generation | `DraftInputSchema` | `DraftOutputSchema` |
| 5. Objection intelligence | `ObjectionInputSchema` | `ObjectionOutputSchema` |
| 6. Analytics intelligence | `AnalyticsInputSchema` | `AnalyticsOutputSchema` |

### `packages/ai-provider/src/types.ts`
`AIProvider` interface with all 6 methods.

### `packages/ai-provider/src/prompt-builder.ts`
6-layer composable prompt assembly:
1. **System role** — Who the AI is (persistent persona).
2. **Task instruction** — What to do for this invocation.
3. **Client context** — Tenant-specific knowledge (company, ICP, service).
4. **Conversation context** — The concrete data (reply body, lead data, metrics).
5. **Knowledge context** — Supplementary info (objection playbook, past signals).
6. **Output rules** — Strict JSON format contract, always last.

Each provider-specific method calls a named prompt factory (`classifyPrompt`, `draftPrompt`, etc.) that wires the 6 layers for its operation. `buildPrompt()` splits layers into `{ system, user }` for provider API calls.

### `packages/ai-provider/src/claude.ts`
`ClaudeProvider` — wraps Anthropic Messages API. Implements all 6 methods via a shared private `call(system, user, maxTokens)` helper.

### `packages/ai-provider/src/openai.ts`
`OpenAIProvider` — wraps OpenAI Chat Completions API. Same 6 methods via a shared private `call(system, user, temperature, maxTokens)` helper.

### `packages/ai-provider/src/factory.ts`
`createAIProvider(options?)` — reads `AI_PROVIDER` env var; accepts optional `{ providerOverride }` for per-client overrides. API keys always come from env vars.

## Data flows

Signal extraction (point 1):
```
enriched_leads row → SignalExtractionInput → extractSignals() → SignalExtractionOutput → enriched_leads.signals
```

Sequence generation (point 2):
```
SignalExtractionOutput → SequenceInput → generateSequence() → SequenceOutput → Instantly campaign steps
```

Reply classification (point 3):
```
raw_replies row → ClassifyInput → classify() → ClassificationOutput → reply_classifications row
```

Draft generation (point 4):
```
ClassificationOutput + raw_replies → DraftInput → generateDraft() → DraftOutput → reply_drafts row
```

Objection intelligence (point 5):
```
reply_classifications (OBJECTION intent) → ObjectionInput → analyzeObjection() → ObjectionOutput → routing/escalation decision
```

Analytics intelligence (point 6):
```
events aggregation → AnalyticsInput → analyzePerformance() → AnalyticsOutput → analytics_snapshots row
```

## Interfaces

`createAIProvider(options?: { providerOverride?: string }): AIProvider`

`AIProvider` interface:
```typescript
classify(input: ClassifyInput): Promise<ClassificationOutput>
generateDraft(input: DraftInput): Promise<DraftOutput>
extractSignals(input: SignalExtractionInput): Promise<SignalExtractionOutput>
generateSequence(input: SequenceInput): Promise<SequenceOutput>
analyzeObjection(input: ObjectionInput): Promise<ObjectionOutput>
analyzePerformance(input: AnalyticsInput): Promise<AnalyticsOutput>
```

## Storage

No AI output is stored by the provider layer. Callers (workers) persist outputs to:
- `reply_classifications` (classify)
- `reply_drafts` (generateDraft)
- `enriched_leads.signals` (extractSignals)
- `response_queue` or Instantly (generateSequence)
- `reply_classifications.routing_decision` (analyzeObjection)
- `analytics_snapshots` (analyzePerformance, Module 8)

## Security and privacy

- API keys stored in env vars, never in code or DB.
- Per-client `providerOverride` is a string label only; keys still come from env.
- Reply bodies and lead PII are sent to the selected AI provider. Data processing agreements with Anthropic and OpenAI cover this.
- No caching of AI responses containing PII.

## Observability

Workers record `model_used`, `prompt_version`, `generation_ms`, and `raw_model_output` in their respective DB rows. `AIProviderError` carries `provider`, `code`, and `retryable` fields for structured logging.

## Failure modes

| Failure | Handling |
|---|---|
| `API_ERROR` (retryable=true) | BullMQ retries with exponential backoff |
| `EMPTY_RESPONSE` (retryable=false) | Job fails, moves to DLQ |
| `INVALID_JSON` (retryable=false) | Job fails, moves to DLQ |
| `VALIDATION_FAILED` (retryable=false) | Job fails, moves to DLQ |
| `MISSING_ENV` (retryable=false) | Process crashes at startup |
| `UNSUPPORTED_PROVIDER` (retryable=false) | Process crashes at startup |

## Decisions

- Strategy pattern over adapter wrapping so both providers implement identical contracts.
- Shared `PromptBuilder` so prompt structure never diverges between Claude and OpenAI.
- Factory reads env vars at invocation time (not singleton) so workers can hot-reload provider via restart.

## Change log

- 2026-05-28: Initial version. Extended from 2-method to 6-method AIProvider interface. Added PromptBuilder with 6-layer architecture. Fixed factory signature mismatch in classify and draft workers.
