# AGENTS - Universal AI Operating Manual

Purpose
- This repository is a persistent, AI-readable second brain and engineering memory system.
- The wiki is the compiled knowledge base. Raw sources are the immutable evidence.
- All agents must follow this file to keep the wiki consistent and low-hallucination.

Quick start for any agent
1. Read this file.
2. Read wiki/index.md and wiki/log.md.
3. If you are ingesting a new source, follow the ingest workflow below.
4. If you are answering a question, use the query workflow below.

Compatibility targets
- GitHub Copilot, Cursor, Antigravity IDE, and future agents.
- Use plain Markdown. Avoid vendor-specific features.
- Keep text ASCII unless a source requires non-ASCII.

System layers (do not blur)
- raw/: Immutable sources. Never edit existing files in raw/.
- wiki/: LLM-maintained knowledge base. This is what evolves.
- AGENTS.md: The schema and operating manual.

Folder map (wiki)
- wiki/index.md: Catalog of all wiki pages with one-line summaries.
- wiki/log.md: Append-only timeline of ingests, queries, and lint passes.
- wiki/sources/: LLM summaries of raw sources, one file per source.
- wiki/concepts/: Reusable concepts and patterns.
- wiki/entities/: People, orgs, products, systems, codebases.
- wiki/architecture/: System and project architecture docs.
- wiki/workflows/: Repeatable operating procedures.
- wiki/ingest/: Records of each ingest run.
- wiki/projects/: Project-specific pages.
- wiki/templates/: Optional templates for new pages.

File naming rules
- Use kebab-case.
- Include ISO date prefixes for time-based files: YYYY-MM-DD-name.md.
- Do not rename or move raw sources after ingest.

Evidence and citations
- Every factual claim in wiki pages must cite at least one raw source.
- Add a "Sources" section with Markdown links to raw source files.
- Do not cite other wiki pages as primary evidence.

Index and log rules
- Update wiki/index.md whenever a wiki page is created or changed.
- Append to wiki/log.md for every ingest, query result saved, or lint pass.
- Log entry format: "## [YYYY-MM-DD] type | short description".

Ingest workflow (single source)
1. Add source to raw/sources/ with a stable filename.
2. Create or update wiki/sources/<source>.md with a summary and key points.
3. Update or create related concept/entity/project pages.
4. Record the ingest in wiki/ingest/ with actions and touched files.
5. Update wiki/index.md and append to wiki/log.md.
6. Confirm with the user if any interpretation is ambiguous.

Query workflow (answer and retain)
1. Read wiki/index.md, then the relevant pages.
2. Synthesize an answer with citations to raw sources.
3. If the answer is reusable, save it as a new wiki page.
4. Update wiki/index.md and wiki/log.md.

Lint workflow (periodic health check)
- Check for contradictions, orphan pages, missing concept pages, and stale claims.
- Propose fixes or new sources to resolve gaps.
- Save the lint report in wiki/workflows/ or wiki/projects/ and log it.

Workflow documentation standards
- Defined in wiki/workflows/standards.md.

Architecture documentation standards
- Defined in wiki/architecture/standards.md.

Change control
- Prefer small, explicit edits.
- If a change could delete knowledge, ask for confirmation first.
