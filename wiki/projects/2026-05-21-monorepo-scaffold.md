# Monorepo Scaffold

Summary
- Scaffolded the Krionics OS monorepo with `packages/schema`, `packages/ai-provider`, `apps/dashboard`, `supabase/migrations`, `n8n/workflows`, and `prompts/v1.0`.
- Implemented the Dependency Inversion Principle for AI provider integrations.
- Verified build success with `npm install` and `npm run build`.

Key points
- `@krionics/schema` defines shared branded ID types and Zod schemas.
- `@krionics/ai-provider` exposes a single `AIProvider` interface and a factory for Claude/OpenAI providers.
- The repo is set up for npm workspaces and strict TypeScript.

Sources
- [raw/sources/2026-05-20-krionics-os-architecture.md](../../raw/sources/2026-05-20-krionics-os-architecture.md)
- [raw/sources/2026-05-20-krionics-os-blueprint.md](../../raw/sources/2026-05-20-krionics-os-blueprint.md)
