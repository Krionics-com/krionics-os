import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import {
  mapIcpToApolloSearchParams,
  validateApolloSearchParams,
} from "@krionics/workers";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyToken(token); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const [client] = await sql<{ config: any; apollo_config: any }[]>`
    SELECT config, apollo_config FROM clients WHERE slug = ${slug}
  `;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const searchParams = mapIcpToApolloSearchParams(
    client.config ?? {},
    client.apollo_config ?? {}
  );
  const validation = validateApolloSearchParams(searchParams);

  return NextResponse.json({
    searchParams,
    valid: validation.valid,
    missing: validation.missing,
  });
}
