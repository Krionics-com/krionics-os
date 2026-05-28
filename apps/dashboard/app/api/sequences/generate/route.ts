import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sequenceGenerationQueue } from "@/lib/queues";

const RequestSchema = z.object({
  clientId: z.string().uuid(),
  leadId: z.string().uuid(),
  campaignId: z.string().uuid().optional()
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { clientId, leadId, campaignId } = parsed.data;

  const job = await sequenceGenerationQueue.add("generate_sequence", {
    clientId,
    leadId,
    campaignId: campaignId ?? null
  }, {
    jobId: `seq-gen:${clientId}:${leadId}`
  });

  return NextResponse.json(
    { status: "queued", jobId: job.id },
    { status: 202 }
  );
}
