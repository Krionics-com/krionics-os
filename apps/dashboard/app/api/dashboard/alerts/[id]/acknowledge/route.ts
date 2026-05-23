import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [updated] = await sql<any[]>`
      UPDATE alerts
      SET 
        status = 'acknowledged',
        acknowledged_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    await recordAudit({
      operator_id: operator.sub,
      action: "acknowledged",
      resource_type: "alert",
      resource_id: id,
      summary: `Acknowledged alert: ${updated.title}`,
      before_value: { status: "new" },
      after_value: { status: "acknowledged" }
    });

    return NextResponse.json({ success: true, alert: updated });
  } catch (err: any) {
    console.error("POST acknowledge alert error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
