# Krionics Operator Dashboard (Phase 1)

Next.js 14 App Router dashboard for operators to review, approve, and reject reply drafts.

## Setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Run migrations (adds operator password hash column + seed admin):

```bash
node --env-file=.env --import tsx/esm ../../packages/db/src/migrate.ts
```

3. Start dev server:

```bash
npm run dev -- --port 3001
```

Open http://localhost:3001.

## Default Operator

- Email: admin@krionics.com
- Password: admin123

## Key Pages

- /login — operator login
- /dashboard — stats overview
- /dashboard/review — pending review queue
- /dashboard/review/[replyItemId] — detail + approve/reject

## Notes

- Authentication uses JWT stored in `kos_session` httpOnly cookie.
- API routes are protected via middleware and server-side JWT validation.
