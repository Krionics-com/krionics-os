import { z } from "zod";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variables");
  process.exit(1);
}

// Zod validation schemas
const LoginResponseSchema = z.object({
  operator: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.string()
  })
});

const ReplyItemsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      lead_email: z.string()
    })
  ),
  total: z.number()
});

const ReplyDetailResponseSchema = z.object({
  reply_item: z.object({
    id: z.string(),
    status: z.string()
  }),
  classification: z.object({
    id: z.string(),
    intent: z.string().nullable().optional(),
    confidence: z.number().nullable().optional()
  }).nullable().optional()
});

const MeResponseSchema = z.object({
  operator: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.string()
  })
});

async function main() {
  const checks: string[] = [];

  // Step 1: POST /api/auth/login
  console.log(`Starting E2E Dashboard tests against ${BASE_URL}...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }

  const loginData = LoginResponseSchema.parse(await loginRes.json());
  if (loginData.operator.email !== ADMIN_EMAIL) {
    throw new Error(`Login operator email mismatch: expected ${ADMIN_EMAIL}, got ${loginData.operator.email}`);
  }

  const rawCookie = loginRes.headers.get("set-cookie");
  if (!rawCookie) {
    throw new Error("No set-cookie header returned on login");
  }

  // Extract the kos_session cookie
  const cookieMatch = rawCookie.match(/kos_session=[^;]+/);
  const cookie = cookieMatch ? cookieMatch[0] : rawCookie;
  checks.push("✓ login");

  // Step 2: GET /api/reply-items?status=PENDING_REVIEW
  const listRes = await fetch(`${BASE_URL}/api/reply-items?status=PENDING_REVIEW&skip=0&limit=10`, {
    headers: { Cookie: cookie }
  });

  if (!listRes.ok) {
    throw new Error(`List PENDING_REVIEW failed with status ${listRes.status}`);
  }

  const listData = ReplyItemsResponseSchema.parse(await listRes.json());
  checks.push("✓ list");

  // Step 3-5: If data has items, run detail, approve, and list APPROVED checks
  if (listData.data.length > 0) {
    const targetItem = listData.data[0];

    // Step 3: GET /api/reply-items/{id}
    const detailRes = await fetch(`${BASE_URL}/api/reply-items/${targetItem.id}`, {
      headers: { Cookie: cookie }
    });

    if (!detailRes.ok) {
      throw new Error(`GET reply-item detail failed with status ${detailRes.status}`);
    }

    const detailData = ReplyDetailResponseSchema.parse(await detailRes.json());
    if (!detailData.classification) {
      console.warn("⚠️ Warning: Reply item lacks classification details");
    }
    checks.push("✓ detail");

    // Step 4: POST /api/reply-items/{id}/approve
    const approveRes = await fetch(`${BASE_URL}/api/reply-items/${targetItem.id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie
      },
      body: JSON.stringify({
        edited_subject: "Re: E2E Approved Reply",
        edited_body_text: "Test approval"
      })
    });

    if (!approveRes.ok) {
      throw new Error(`Approve failed with status ${approveRes.status}: ${await approveRes.text()}`);
    }
    checks.push("✓ approve");

    // Step 5: GET /api/reply-items?status=APPROVED
    const approvedListRes = await fetch(`${BASE_URL}/api/reply-items?status=APPROVED&skip=0&limit=10`, {
      headers: { Cookie: cookie }
    });

    if (!approvedListRes.ok) {
      throw new Error(`List APPROVED failed with status ${approvedListRes.status}`);
    }

    const approvedListData = ReplyItemsResponseSchema.parse(await approvedListRes.json());
    if (approvedListData.data.length < 1) {
      throw new Error("Expect approved reply-items count >= 1");
    }
    checks.push("✓ list approved");
  } else {
    console.log("No pending review items found. Skipping detail, approve, and list approved E2E steps.");
    checks.push("⚠ detail (skipped)");
    checks.push("⚠ approve (skipped)");
    checks.push("⚠ list approved (skipped)");
  }

  // Step 6: GET /api/auth/me
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookie }
  });

  if (!meRes.ok) {
    throw new Error(`GET /api/auth/me failed with status ${meRes.status}`);
  }

  const meData = MeResponseSchema.parse(await meRes.json());
  if (meData.operator.email !== ADMIN_EMAIL) {
    throw new Error(`Operator profile email mismatch: expected ${ADMIN_EMAIL}, got ${meData.operator.email}`);
  }
  checks.push("✓ me");

  // Step 7: POST /api/auth/change-password with wrong current password
  const changePasswordRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body: JSON.stringify({
      current_password: "wrong_password_here",
      new_password: "new_secure_password"
    })
  });

  if (changePasswordRes.status !== 400 && changePasswordRes.status !== 401) {
    throw new Error(`Expected change-password to fail with 400 or 401, but got status ${changePasswordRes.status}`);
  }
  checks.push("✓ change-password wrong");

  console.log("\nAll E2E checks passed successfully:");
  console.log(checks.join(" | "));
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ E2E Test execution failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
