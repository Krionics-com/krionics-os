# LLM Wiki Pattern

Definition
A workflow where an LLM maintains a persistent, interlinked wiki derived from immutable raw sources, updating pages during ingest and saving reusable query outputs back into the wiki.

Why it helps
- Compiles knowledge once, reducing repeated synthesis cost.
- Keeps cross-references, contradictions, and summaries current.
- Creates a durable memory layer across agents and sessions.

Core layers
- Raw sources: immutable evidence.
- Wiki: LLM-maintained summaries and concept pages.
- Schema: the operating manual (AGENTS.md).

Core operations
- Ingest: read a source and update multiple wiki pages.
- Query: answer from the wiki and save reusable outputs.
- Lint: periodic health checks for drift and gaps.

Sources
- [raw/sources/2026-05-20-llm-wiki-idea.md](../../raw/sources/2026-05-20-llm-wiki-idea.md)
