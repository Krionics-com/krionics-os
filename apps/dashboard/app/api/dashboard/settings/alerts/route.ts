import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rules = await sql<any[]>`
      SELECT * FROM alert_rules
      ORDER BY rule_type ASC
    `;

    return NextResponse.json({ rules });
  } catch (err: any) {
    console.error("GET alert settings error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rules } = body;

    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: "Invalid payload format, expected rules array" }, { status: 400 });
    }

    // Perform updates for each rule in transaction
    await sql.begin(async (sqlTrans) => {
      for (const rule of rules) {
        const { rule_type, enabled, severity, threshold, destinations } = rule;
        
        await sqlTrans`
          INSERT INTO alert_rules (rule_type, enabled, severity, threshold, destinations, updated_at)
          VALUES (${rule_type}, ${enabled}, ${severity}, ${threshold === "" ? null : threshold}, ${destinations}, NOW())
          ON CONFLICT (rule_type) DO UPDATE
          SET
            enabled = EXCLUDED.enabled,
            severity = EXCLUDED.severity,
            threshold = EXCLUDED.threshold,
            destinations = EXCLUDED.destinations,
            updated_at = NOW()
        `;
      }
    });

    const updatedRules = await sql`
      SELECT * FROM alert_rules
      ORDER BY rule_type ASC
    `;

    return NextResponse.json({ success: true, rules: updatedRules });
  } catch (err: any) {
    console.error("POST alert settings error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
