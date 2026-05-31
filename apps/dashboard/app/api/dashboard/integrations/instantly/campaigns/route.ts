import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { listInstantlyCampaigns } from "@krionics/workers";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyToken(token); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "INSTANTLY_API_KEY is not configured" },
      { status: 503 }
    );
  }

  try {
    const campaigns = await listInstantlyCampaigns(apiKey);
    return NextResponse.json({ campaigns });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch Instantly campaigns" },
      { status: 502 }
    );
  }
}
