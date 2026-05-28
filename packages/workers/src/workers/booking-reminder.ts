import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { bookingReminderQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";
import { getFeatureFlag } from "../config.js";

const BookingReminderJobSchema = z.object({
  meetingId: z.string().uuid(),
  leadId: z.string().uuid(),
  clientId: z.string().uuid(),
  reminderType: z.enum(["24h", "72h", "5d"]),
  scheduledAt: z.string(),
  attendeeEmail: z.string().email()
});

type BookingReminderJob = z.infer<typeof BookingReminderJobSchema>;

const REMINDER_MESSAGES: Record<string, { subject: string; body: string }> = {
  "24h": {
    subject: "See you tomorrow — a quick reminder",
    body: "Just a friendly reminder that we have a meeting scheduled for tomorrow. Looking forward to connecting!"
  },
  "72h": {
    subject: "Your meeting is in 3 days",
    body: "This is a reminder that we have a meeting scheduled in 3 days. Please let me know if you need to reschedule."
  },
  "5d": {
    subject: "Meeting reminder — 5 days away",
    body: "Looking forward to our upcoming meeting! Please feel free to reach out if you have any questions beforehand."
  }
};

export function createBookingReminderWorker(): Worker<BookingReminderJob> {
  return new Worker(
    bookingReminderQueue.name,
    async (job) => {
      const payload = BookingReminderJobSchema.parse(job.data);

      const remindersEnabled = await getFeatureFlag(payload.clientId, "booking_reminders");
      if (!remindersEnabled) {
        return { status: "skipped", reason: "booking_reminders_disabled" };
      }

      // Check meeting still exists and is scheduled (not cancelled)
      const [meeting] = await sql<{ id: string; status: string }[]>`
        SELECT id, status FROM meetings
        WHERE id = ${payload.meetingId}::uuid
      `;

      if (!meeting || meeting.status === "cancelled") {
        return { status: "skipped", reason: "meeting_cancelled_or_missing" };
      }

      const template = REMINDER_MESSAGES[payload.reminderType];
      if (!template) {
        return { status: "skipped", reason: "unknown_reminder_type" };
      }

      // Record the reminder in meeting metadata
      await sql`
        UPDATE meetings
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'),
          ARRAY['reminders_sent', ${payload.reminderType}],
          ${JSON.stringify(new Date().toISOString())}::jsonb
        )
        WHERE id = ${payload.meetingId}::uuid
      `;

      await emitEvent({
        clientId: payload.clientId,
        leadId: payload.leadId,
        eventType: "booking_reminder_triggered",
        metadata: {
          meeting_id: payload.meetingId,
          reminder_type: payload.reminderType,
          attendee_email: payload.attendeeEmail,
          scheduled_at: payload.scheduledAt
        }
      });

      return {
        status: "sent",
        reminderType: payload.reminderType,
        subject: template.subject
      };
    },
    { connection: bookingReminderQueue.opts.connection }
  );
}
