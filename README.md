# Krionics OS

Internal orchestration platform for managing multi-tenant client pipeline systems.

## Stack
- **Database:** Supabase (PostgreSQL)
- **Queue:** Upstash Redis
- **Workflows:** n8n (self-hosted)
- **Dashboard:** Next.js
- **Types:** TypeScript + Zod

## Setup

### 1. Clone and install
```bash
git clone https://github.com/YOUR_ORG/krionics-os.git
cd krionics-os
pnpm install
```

### 2. Environment variables
```bash
cp .env.example .env.local
# Fill in your Supabase + Upstash credentials
```

### 3. Run Supabase migrations
Go to your Supabase project → SQL Editor, and run each migration file in order:
```
supabase/migrations/001_enums.sql
supabase/migrations/002_clients.sql
supabase/migrations/003_campaigns.sql
supabase/migrations/004_leads.sql
supabase/migrations/005_email_events.sql
supabase/migrations/006_reply_pipeline.sql
supabase/migrations/007_meetings_audit_suppression.sql
supabase/migrations/008_config.sql
supabase/migrations/009_rls.sql
supabase/migrations/010_seed.sql
```

### 4. Build schema package
```bash
cd packages/schema
pnpm build
```

### 5. Next steps
See `.claude/CLAUDE.md` for architecture context and current build status.
