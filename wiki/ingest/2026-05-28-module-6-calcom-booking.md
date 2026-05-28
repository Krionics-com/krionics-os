# Ingest Record: Module 6 — Cal.com Booking Webhook

Date: 2026-05-28
Branch: feat/module-6-calcom-booking

## Actions taken

1. Created `apps/dashboard/app/api/webhooks/calcom/route.ts`:
   - HMAC-SHA256 signature verification via `x-cal-signature-256` header (optional when CALCOM_WEBHOOK_SECRET not set).
   - Handles BOOKING_CREATED, BOOKING_RESCHEDULED, BOOKING_CANCELLED events.
   - On BOOKING_CREATED: upserts meeting into `meetings` table, updates lead status to `meeting_booked`, enqueues CRM sync, schedules 3 booking reminder jobs (24h, 72h, 5d before meeting) as BullMQ delayed jobs.
   - On BOOKING_CANCELLED: marks meeting as cancelled with reason.
   - Lead lookup by attendee email to link meeting to client/lead/campaign.

2. Created `packages/workers/src/workers/booking-reminder.ts`:
   - Processes delayed reminder jobs fired by the webhook handler.
   - Checks meeting status before sending — skips if cancelled.
   - Updates `meetings.metadata` with reminder timestamps.
   - Emits `booking_reminder_triggered` event.
   - Template messages for 24h, 72h, 5d reminder types.

## Reminder scheduling

Reminders are scheduled as BullMQ delayed jobs (not cron):
- `delay = scheduledAt - reminderOffset - now`
- Only scheduled when delay > 0 (i.e. meeting is in the future)
- Cancellation check in worker prevents sending reminders for cancelled meetings

## Touched files

- `apps/dashboard/app/api/webhooks/calcom/route.ts` (new)
- `packages/workers/src/workers/booking-reminder.ts` (new)
- `packages/workers/src/index.ts`

## Sources

- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §8 Conversion Events, §13 Booking Recovery
