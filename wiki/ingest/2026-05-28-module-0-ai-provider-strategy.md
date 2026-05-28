# Ingest Record: Module 0 — AI Provider Strategy Pattern

Date: 2026-05-28
Branch: feat/module-0-ai-provider-strategy

## Actions taken

1. Read AGENTS.md, wiki/index.md, wiki/log.md, and both standards files.
2. Read all existing ai-provider source files to understand current state.
3. Added 4 new Zod schema pairs to `packages/schema/src/index.ts`:
   - `SignalExtractionInput/Output` (AI invocation point 1)
   - `SequenceInput/Output` (AI invocation point 2)
   - `ObjectionInput/Output` (AI invocation point 5)
   - `AnalyticsInput/Output` (AI invocation point 6)
4. Extended `AIProvider` interface with 4 new methods: `extractSignals`, `generateSequence`, `analyzeObjection`, `analyzePerformance`.
5. Created `packages/ai-provider/src/prompt-builder.ts` — 6-layer composable prompt architecture with per-operation factories for all 6 AI invocation points.
6. Rewrote `ClaudeProvider` to implement all 6 methods using shared `call()` helper and prompt-builder.
7. Rewrote `OpenAIProvider` with same structure.
8. Fixed `factory.ts` signature: removed silently-ignored params; added clean `CreateAIProviderOptions` with optional `providerOverride` for per-client provider selection.
9. Fixed `packages/workers/src/workers/classify.ts` callsite: removed wrong params from `createAIProvider()`.
10. Fixed `packages/workers/src/workers/draft.ts` callsite: same fix.
11. Updated `packages/ai-provider/src/index.ts` exports.
12. Confirmed `packages/schema` and `packages/ai-provider` compile with zero TypeScript errors.

## Touched files

- `packages/schema/src/index.ts`
- `packages/ai-provider/src/types.ts`
- `packages/ai-provider/src/factory.ts`
- `packages/ai-provider/src/claude.ts`
- `packages/ai-provider/src/openai.ts`
- `packages/ai-provider/src/index.ts`
- `packages/ai-provider/src/prompt-builder.ts` (new)
- `packages/workers/src/workers/classify.ts`
- `packages/workers/src/workers/draft.ts`
- `wiki/architecture/ai-provider.md` (new)
- `wiki/index.md` (updated)
- `wiki/log.md` (updated)

## Pre-existing issues not introduced by this module

- `packages/workers/src/workers/classify.ts` lines 135, 168: pre-existing SQL template type errors (sql<...>[] generic and passing complex object to sql param). Not related to AI provider changes.
- Other worker files (ingest.ts, review-dispatch.ts) have pre-existing null safety and ioredis constructor errors.

## Sources

- [packages/ai-provider/src/](../../packages/ai-provider/src/) — primary implementation
- [packages/schema/src/index.ts](../../packages/schema/src/index.ts) — schema definitions
- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §11 AI Invocation Points, §12 Prompt Engineering
