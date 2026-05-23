import { sql } from "@/lib/db";

export interface AuditParams {
  operator_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  summary: string;
  before_value?: Record<string, any> | null;
  after_value?: Record<string, any> | null;
}

export async function recordAudit(params: AuditParams): Promise<void> {
  const {
    operator_id,
    action,
    resource_type,
    resource_id,
    summary,
    before_value = null,
    after_value = null,
  } = params;

  try {
    await sql`
      INSERT INTO audit_logs (
        operator_id,
        action,
        resource_type,
        resource_id,
        summary,
        before_value,
        after_value,
        created_at
      ) VALUES (
        ${operator_id || null},
        ${action},
        ${resource_type},
        ${resource_id},
        ${summary},
        ${before_value ? JSON.stringify(before_value) : null},
        ${after_value ? JSON.stringify(after_value) : null},
        NOW()
      )
    `;
  } catch (err) {
    console.error("Failed to record audit log:", err);
  }
}
