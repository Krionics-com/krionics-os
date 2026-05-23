import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

async function verifyAdmin(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return { error: "Unauthorized", status: 401 };

  try {
    const payload = await verifyToken(token);
    const [opRecord] = await sql<any[]>`
      SELECT id, role, name, email FROM operators WHERE id = ${payload.sub}
    `;
    if (!opRecord) {
      return { error: "Unauthorized", status: 401 };
    }
    if (opRecord.role !== "admin" && opRecord.role !== "super_admin") {
      return { error: "Forbidden", status: 403 };
    }
    return { operator: opRecord };
  } catch {
    return { error: "Unauthorized", status: 401 };
  }
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const flags = await sql<any[]>`
      SELECT feature_key, enabled, description, updated_at FROM feature_flags
    `;
    return NextResponse.json({ flags });
  } catch (err: any) {
    console.error("GET feature flags error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { operator } = auth;
  const body = await req.json().catch(() => ({}));
  const { flags } = body; // Array of { feature_key: string, enabled: boolean }

  if (!flags || !Array.isArray(flags)) {
    return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
  }

  try {
    await sql.begin(async (tx) => {
      for (const item of flags) {
        const [old] = await tx`
          SELECT enabled FROM feature_flags WHERE feature_key = ${item.feature_key}
        `;

        await tx`
          UPDATE feature_flags
          SET 
            enabled = ${item.enabled},
            updated_by = ${operator!.id},
            updated_at = NOW()
          WHERE feature_key = ${item.feature_key}
        `;

        if (old && old.enabled !== item.enabled) {
          // Log to the Phase 11 immutable audit logs
          await recordAudit({
            operator_id: operator!.id,
            action: "config_changed",
            resource_type: "feature_flag",
            resource_id: item.feature_key,
            summary: `Updated feature flag '${item.feature_key}' to ${item.enabled ? "ENABLED" : "DISABLED"}`,
            before_value: { enabled: old.enabled },
            after_value: { enabled: item.enabled }
          });
        }
      }
    });

    const updated = await sql<any[]>`
      SELECT feature_key, enabled, description, updated_at FROM feature_flags
    `;
    return NextResponse.json({ success: true, flags: updated });
  } catch (err: any) {
    console.error("PATCH feature flags error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
