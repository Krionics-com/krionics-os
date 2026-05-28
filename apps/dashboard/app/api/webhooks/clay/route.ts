import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { signalExtractionQueue } from "@/lib/queues";

function verifyClaySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.CLAY_WEBHOOK_SECRET;

  if (secret) {
    const sig = req.headers.get("x-clay-signature");
    if (!verifyClaySignature(rawBody, sig, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const externalId = payload["external_id"] as string | undefined;
  if (!externalId) {
    return NextResponse.json({ error: "Missing external_id" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load the lead to get client_id
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, client_id")
    .eq("id", externalId)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Upsert enriched_leads row
  const enrichmentData = {
    lead_id: externalId,
    client_id: lead.client_id,
    linkedin_profile_url: payload["linkedin_profile_url"] ?? null,
    linkedin_headline: payload["linkedin_headline"] ?? null,
    linkedin_summary: payload["linkedin_summary"] ?? null,
    linkedin_updated_at: payload["linkedin_updated_at"] ?? null,
    company_summary: payload["company_summary"] ?? null,
    company_growth_signals: payload["company_growth_signals"] ?? null,
    hiring_signals: payload["hiring_signals"] ?? null,
    tech_stack: payload["tech_stack"] ?? null,
    website_summary: payload["website_summary"] ?? null,
    recent_news: payload["recent_news"] ?? null,
    clay_request_id: payload["clay_request_id"] ?? null,
    enriched_at: new Date().toISOString()
  };

  const { data: enriched, error: upsertError } = await supabase
    .from("enriched_leads")
    .upsert(enrichmentData, { onConflict: "lead_id" })
    .select("id")
    .single();

  if (upsertError || !enriched) {
    console.error("[clay-webhook] upsert failed", upsertError);
    return NextResponse.json({ error: "DB upsert failed" }, { status: 500 });
  }

  // Enqueue signal extraction (AI invocation point 1)
  await signalExtractionQueue
    .add("extract_signals", {
      clientId: lead.client_id,
      leadId: externalId,
      enrichedLeadId: enriched.id
    })
    .catch((err: unknown) => {
      console.error("[clay-webhook] failed to enqueue signal extraction", err);
    });

  return NextResponse.json({ status: "processed" }, { status: 200 });
}
