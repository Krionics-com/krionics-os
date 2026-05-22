import { z } from "zod";
import postgres from "postgres";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = process.env.DASHBOARD_BASE_URL ?? "http://localhost:3001";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !DATABASE_URL) {
  console.error("Missing ADMIN_EMAIL, ADMIN_PASSWORD, or DATABASE_URL");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, onnotice: () => {} });

const LoginResponseSchema = z.object({
  operator: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.string()
  })
});

const ReplyItemsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      status: z.string()
    })
  ),
  total: z.number()
});

const ReplyDetailSchema = z.object({
  reply_item: z.object({
    id: z.string(),
    draft_id: z.string().nullable().optional()
  }),
  draft: z
    .object({
      subject: z.string().nullable().optional(),
      body_text: z.string().nullable().optional()
    })
    .nullable()
});

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, init);
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(payload?.error ?? `Request failed (${res.status})`);
  }
  return { data: payload as T, headers: res.headers };
}

async function main() {
  const summary: string[] = [];

  const loginResponse = await fetchJson<z.infer<typeof LoginResponseSchema>>(
    `${BASE_URL}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    }
  );
  const loginData = LoginResponseSchema.parse(loginResponse.data);
  summary.push("✓ login");

  const cookie = loginResponse.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Login did not return a session cookie");
  }

  const listResponse = await fetchJson<z.infer<typeof ReplyItemsSchema>>(
    `${BASE_URL}/api/reply-items?status=PENDING_REVIEW&skip=0&limit=2`,
    { headers: { Cookie: cookie } }
  );
  const listData = ReplyItemsSchema.parse(listResponse.data);
  summary.push("✓ list");

  if (listData.data.length < 2) {
    throw new Error("Need at least two pending items to run E2E flow");
  }

  const approveTarget = listData.data[0];
  const rejectTarget = listData.data[1];

  const detailResponse = await fetchJson<z.infer<typeof ReplyDetailSchema>>(
    `${BASE_URL}/api/reply-items/${approveTarget.id}`,
    { headers: { Cookie: cookie } }
  );
  const detailData = ReplyDetailSchema.parse(detailResponse.data);

  await fetchJson(`${BASE_URL}/api/reply-items/${approveTarget.id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      edited_subject: detailData.draft?.subject ?? "Approved",
      edited_body_text: `${detailData.draft?.body_text ?? "Approved"}\n\nReviewed by E2E.`
    })
  });
  summary.push("✓ approve");

  await fetchJson(`${BASE_URL}/api/reply-items/${rejectTarget.id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ rejection_reason: "E2E rejection" })
  });
  summary.push("✓ reject");

  const [approvedRow] = await sql<{ status: string }[]>`
    SELECT status FROM reply_items WHERE id = ${approveTarget.id}
  `;
  const [rejectedRow] = await sql<{ status: string }[]>`
    SELECT status FROM reply_items WHERE id = ${rejectTarget.id}
  `;

  if (approvedRow?.status !== "APPROVED") {
    throw new Error(`Approve verification failed: ${approvedRow?.status ?? "missing"}`);
  }

  if (rejectedRow?.status !== "REJECTED") {
    throw new Error(`Reject verification failed: ${rejectedRow?.status ?? "missing"}`);
  }

  const [auditApprove] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM audit_log
    WHERE action = 'APPROVE_DRAFT' AND entity_id = ${approveTarget.id}
  `;
  const [auditReject] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM audit_log
    WHERE action = 'REJECT_DRAFT' AND entity_id = ${rejectTarget.id}
  `;

  if (!auditApprove?.count || !auditReject?.count) {
    throw new Error("Audit log verification failed");
  }

  summary.push("✓ audit log");
  console.log(summary.join(" | "));
  await sql.end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
