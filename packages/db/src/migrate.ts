/**
 * Migration runner.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node --import tsx/esm src/migrate.ts
 *
 * DATABASE_URL is the direct PostgreSQL connection string from:
 *   Supabase Dashboard → Settings → Database → Connection string → URI
 *   Format: postgresql://postgres.[project-ref]:[password]@...supabase.com:5432/postgres
 *
 * The service role key alone cannot run DDL via the REST API — a direct
 * PostgreSQL connection is required for migrations.
 */

import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "../../../supabase/migrations");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "\n❌  DATABASE_URL is not set.\n\n" +
    "    Get it from: Supabase Dashboard → Settings → Database → URI\n" +
    "    It looks like: postgresql://postgres.[ref]:[password]@...supabase.com:5432/postgres\n" +
    "    Add it to .env as DATABASE_URL=...\n"
  );
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: "require",
  max: 1,
  onnotice: () => {},
});

async function ensureMigrationsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL      PRIMARY KEY,
      filename    TEXT        UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function appliedMigrations(): Promise<Set<string>> {
  const rows = await sql<{ filename: string }[]>`
    SELECT filename FROM _migrations ORDER BY id
  `;
  return new Set(rows.map((r) => r.filename));
}

async function runMigrations(): Promise<void> {
  console.log("📦  Krionics OS — database migrations\n");

  await ensureMigrationsTable();
  const applied = await appliedMigrations();

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("✅  All migrations already applied — nothing to do.");
    await sql.end();
    return;
  }

  console.log(`🔄  ${pending.length} migration(s) to apply:\n`);

  for (const filename of pending) {
    const filepath = join(MIGRATIONS_DIR, filename);
    const content = await readFile(filepath, "utf8");

    process.stdout.write(`  → ${filename} ... `);

    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO _migrations (filename) VALUES (${filename})
        `;
      });
      console.log("✅");
    } catch (err) {
      console.log("❌");
      console.error(`\n    Error in ${filename}:\n    ${(err as Error).message}\n`);
      await sql.end();
      process.exit(1);
    }
  }

  console.log(`\n✅  Applied ${pending.length} migration(s) successfully.`);
  await sql.end();
}

runMigrations().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
