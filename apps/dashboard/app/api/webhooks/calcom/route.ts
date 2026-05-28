import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { crmSyncQueue, bookingReminderQueue } from "@/lib/queues";

function verifyCalcomSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

interface CalcomBookingPayload {
  triggerEvent: string;
  payload: {
    uid?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    attendees?: Array<{
      email: string;
      name?: string;
      timeZone?: string;
    }>;
    organizer?: { email: string; name?: string };
    metadata?: Record<string, unknown>;
    status?: string;
    cancellationReason?: string;
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.CALCOM_WEBHOOK_SECRET;

  if (secret) {
    const sig = req.headers.get("x-cal-signature-256");
    if (!verifyCalcomSignature(rawBody, sig, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: CalcomBookingPayload;
  try {
    body = JSON.parse(rawBody) as CalcomBookingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { triggerEvent, payload: booking } = body;

  // Only handle booking-related events
  if (!["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"].includes(triggerEvent)) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  if (!booking.uid || !booking.startTime) {
    return NextResponse.json({ error: "Missing booking uid or startTime" }, { status: 400 });
  }

  const attendee = booking.attendees?.[0];
  if (!attendee?.email) {
    return NextResponse.json({ error: "No attendee email" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the lead by email to get client_id
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, campaign_id")
    .eq("email", attendee.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (triggerEvent === "BOOKING_CANCELLED") {
    await supabase
      .from("meetings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: booking.cancellationReason ?? "Cal.com cancellation"
      })
      .eq("cal_booking_id", booking.uid);

    return NextResponse.json({ status: "cancelled" }, { status: 200 });
  }

  const meetingData = {
    cal_booking_id: booking.uid,
    status: triggerEvent === "BOOKING_RESCHEDULED" ? "rescheduled" : "scheduled",
    scheduled_at: booking.startTime,
    attendee_email: attendee.email,
    attendee_name: attendee.name ?? null,
    source: "cold_email" as const,
    meeting_type: "discovery" as const,
    ...(lead
      ? {
          client_id: lead.client_id,
          lead_id: lead.id,
          campaign_id: lead.campaign_id
        }
      : {})
  };

  const { data: meeting, error: upsertError } = await supabase
    .from("meetings")
    .upsert(meetingData, { onConflict: "cal_booking_id" })
    .select("id, client_id, lead_id")
    .single();

  if (upsertError || !meeting) {
    console.error("[calcom-webhook] meeting upsert failed", upsertError);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (lead && triggerEvent === "BOOKING_CREATED") {
    // Update lead status to meeting_booked
    await supabase
      .from("leads")
      .update({
        lead_status: "meeting_booked",
        meeting_booked_at: new Date().toISOString()
      })
      .eq("id", lead.id);

    // Enqueue CRM sync
    await crmSyncQueue
      .add("crm_sync", {
        clientId: lead.client_id,
        leadId: lead.id,
        meetingId: meeting.id,
        triggerEvent: "meeting_booked"
      })
      .catch((err: unknown) => console.error("[calcom-webhook] CRM sync enqueue failed", err));

    // Enqueue booking reminders (24h, 72h, 5d before meeting)
    const scheduledAt = new Date(booking.startTime).getTime();
    const now = Date.now();
    const reminderOffsets = [
      { label: "24h", offsetMs: 24 * 60 * 60 * 1000 },
      { label: "72h", offsetMs: 72 * 60 * 60 * 1000 },
      { label: "5d", offsetMs: 5 * 24 * 60 * 60 * 1000 }
    ];

    for (const { label, offsetMs } of reminderOffsets) {
      const sendAt = scheduledAt - offsetMs;
      const delay = sendAt - now;
      if (delay > 0) {
        await bookingReminderQueue
          .add(
            "booking_reminder",
            {
              meetingId: meeting.id,
              leadId: lead.id,
              clientId: lead.client_id,
              reminderType: label,
              scheduledAt: booking.startTime,
              attendeeEmail: attendee.email
            },
            { delay }
          )
          .catch((err: unknown) =>
            console.error(`[calcom-webhook] reminder ${label} enqueue failed`, err)
          );
      }
    }
  }

  return NextResponse.json({ status: "processed", meetingId: meeting.id }, { status: 200 });
}
