# Wiki Log

## [2026-05-20] setup | initialize wiki structure and schema
- Created AGENTS.md and wiki base folders.
- Added index.md and log.md.

## [2026-05-20] ingest | LLM Wiki idea
- Added raw source and summary pages.
- Created concept page and ingest record.
- Updated index.

## [2026-05-20] ingest | Krionics OS architecture
- Added raw source and summary page.
- Added ingest record and updated index.

## [2026-05-20] ingest | Krionics OS implementation blueprint
- Added raw source and summary page.
- Added ingest record and updated index.

## [2026-05-20] ingest | Krionics OS reply subsystem
- Added raw source and summary page.
- Added ingest record and updated index.

## [2026-05-21] build | Supabase schema migration
- Wrote 17 SQL migration files covering enums, all core tables, RICR subsystem, partitioned tables, RLS policies, and triggers.
- Created packages/db migration runner (migrate.ts, postgres npm package, DATABASE_URL direct connection).
- Added db:migrate script to root package.json and DATABASE_URL to .env.example.
- Committed 25 files as 83de6af on branch claude/hopeful-planck-q4WyA.
- Added wiki/sources/2026-05-21-supabase-schema-migration.md and wiki/architecture/database-schema.md.
- Updated wiki/index.md and wiki/log.md.
