# Ingest Record: Module 3 — Response Scheduling with Business Hours

Date: 2026-05-28
Branch: feat/module-3-response-scheduling

## Actions taken

1. Created `packages/workers/src/scheduling.ts` with `calculateSendTime()`:
   - Loads `timing_rules` row for `(client_id, intent)` from DB.
   - Picks a random delay uniformly in `[delay_min_minutes, delay_max_minutes]`.
   - If `delay_min_minutes == 0 && delay_max_minutes == 0` (suppress intents), returns `new Date()` immediately.
   - If `enforce_business_hours`, passes candidate time through `enforceBusinessHours()`.
   - Falls back to `fallbackDelayMinutes` (default 15) when no timing rule exists.

2. `enforceBusinessHours()`:
   - Uses `Intl.DateTimeFormat` to get local hour/minute in the target IANA timezone.
   - Selects timezone from: prospect's timezone (if `send_in_prospect_timezone` and available) OR client's timezone from the timing rule.
   - Handles three cases: before business hours today (advance to start), after business hours (jump to next day start), weekend (skip to Monday).
   - Loop guard of 7 iterations prevents infinite loops.

3. Updated `review-dispatch.ts`:
   - Imports `calculateSendTime` (removed direct `addMinutes` for scheduling).
   - Fetches lead's `timezone` field alongside other queries.
   - Replaces `addMinutes(new Date(), sendDelayMinutes)` with `await calculateSendTime(clientId, intent, leadTimezone, sendDelayMinutes)`.
   - `sendDelayMinutes` from config is now used as `calculateSendTime`'s fallback parameter.
   - Updated `auto_send_queued` event metadata to include `scheduled_at` ISO string.

## Scheduling algorithm summary

```
1. Load timing_rule(client_id, intent)
2. if no rule → now + fallbackMinutes
3. if min=0 && max=0 → now (suppress, immediate)
4. delay = random(min, max)
5. candidate = now + delay
6. if enforce_business_hours:
     tz = prospect_tz ?? client_tz
     candidate = enforce(candidate, tz, start, end)
7. return candidate
```

## Touched files

- `packages/workers/src/scheduling.ts` (new)
- `packages/workers/src/workers/review-dispatch.ts`
- `wiki/index.md` (updated)
- `wiki/log.md` (updated)

## Sources

- [supabase/migrations/20260523000010_create_timing_rules.sql](../../supabase/migrations/20260523000010_create_timing_rules.sql) — timing_rules schema
- [supabase/migrations/20260528000001_seed_default_policies.sql](../../supabase/migrations/20260528000001_seed_default_policies.sql) — default timing windows
- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §12.5 response delay windows, business hours enforcement
