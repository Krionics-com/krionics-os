import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apolloImportQueue } from "@/lib/queues";

const RequestSchema = z.object({
  campaignId: z.string().uuid().optional().nullable(),
  searchParams: z.object({
    titles: z.array(z.string()).optional(),
    q_organization_domains: z.array(z.string()).optional(),
    organization_industry_tag_ids: z.array(z.string()).optional(),
    num_employees_ranges: z.array(z.string()).optional(),
    person_locations: z.array(z.string()).optional(),
    seniorities: z.array(z.string()).optional(),
    contact_email_status: z.array(z.string()).optional(),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(100).optional()
  }),
  clientId: z.string().uuid()
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

  const { campaignId, searchParams, clientId } = parsed.data;

  const job = await apolloImportQueue.add("apollo_import", {
    clientId,
    campaignId: campaignId ?? null,
    searchParams
  });

  return NextResponse.json(
    { status: "queued", jobId: job.id },
    { status: 202 }
  );
}
