# Supabase Pooler Migration Fix

Summary
- Switched the migration runner to a Supabase session pooler URI to avoid IPv4 direct connection costs.
- Diagnosed and fixed a PostgreSQL RLS policy error in `20260521000016_rls_policies.sql`.
- Confirmed the migration runner now applies successfully with `node --env-file=.env --import tsx/esm packages/db/src/migrate.ts`.

Key points
- Session pooler connections can work when direct IPv4 access is unavailable or expensive.
- Postgres `uuid[]` array comparison must use containment semantics, not `uuid = uuid[]`.
- The fix uses:
  - `(SELECT client_access FROM operators WHERE email = auth.email()) @> ARRAY[client_id]::uuid[]`
- `DATABASE_URL` values containing `@` in the password must be URL-encoded if used in a URI.

Sources
- [wiki/ingest/2026-05-21-supabase-schema-migration.md](../ingest/2026-05-21-supabase-schema-migration.md) - Original migration build and environment setup.
- [supabase/migrations/20260521000016_rls_policies.sql](../../supabase/migrations/20260521000016_rls_policies.sql) - Updated RLS policy.
