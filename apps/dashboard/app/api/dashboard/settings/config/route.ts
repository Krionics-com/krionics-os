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
    const configs = await sql<any[]>`
      SELECT config_key, value FROM global_config
    `;
    
    // Map configs into a clean object
    const result: Record<string, any> = {};
    configs.forEach((item) => {
      result[item.config_key] = item.value;
    });

    return NextResponse.json({ config: result });
  } catch (err: any) {
    console.error("GET global config error:", err);
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
  const { config } = body; // Object containing configuration blocks e.g. { api_provider: {...}, retry_policy: {...} }

  if (!config || typeof config !== "object") {
    return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
  }

  try {
    await sql.begin(async (tx) => {
      for (const [key, value] of Object.entries(config)) {
        const [old] = await tx`
          SELECT value FROM global_config WHERE config_key = ${key}
        `;

        if (old) {
          // Deep merge the incoming config parameters
          const merged = { ...old.value, ...(value as object) };

          await tx`
            UPDATE global_config
            SET 
              value = ${JSON.stringify(merged)},
              updated_at = NOW()
            WHERE config_key = ${key}
          `;

          // Log to the Phase 11 immutable audit logs
          await recordAudit({
            operator_id: operator!.id,
            action: "config_changed",
            resource_type: "global_config",
            resource_id: key,
            summary: `Updated global configuration block '${key}' parameters.`,
            before_value: old.value,
            after_value: merged
          });
        } else {
          await tx`
            INSERT INTO global_config (config_key, value)
            VALUES (${key}, ${JSON.stringify(value)})
          `;
        }
      }
    });

    // Query updated values
    const configs = await sql<any[]>`
      SELECT config_key, value FROM global_config
    `;
    const result: Record<string, any> = {};
    configs.forEach((item) => {
      result[item.config_key] = item.value;
    });

    return NextResponse.json({ success: true, config: result });
  } catch (err: any) {
    console.error("PATCH global config error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
