# Wiki Conventions

Purpose
- The wiki is the maintained knowledge layer derived from raw sources.
- Raw sources live in raw/ and are immutable.

Folder conventions
- wiki/sources/: LLM summaries of raw sources (one per source).
- wiki/concepts/: Reusable ideas, patterns, and frameworks.
- wiki/entities/: People, orgs, products, systems.
- wiki/architecture/: Architecture docs per system or project.
- wiki/workflows/: Repeatable operating procedures.
- wiki/ingest/: Records of each ingest run.
- wiki/projects/: Project-specific pages and research threads.
- wiki/templates/: Optional templates for consistent page creation.

Naming
- Kebab-case for all files and links.
- Use date prefixes for time-based files: YYYY-MM-DD-name.md.

Citations
- Every wiki page includes a "Sources" section with links to raw sources.
- Use raw sources as primary evidence.

Maintenance
- Update wiki/index.md for any new or updated wiki page.
- Append to wiki/log.md for ingests, saved query results, and lint passes.
