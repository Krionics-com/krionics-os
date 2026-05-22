import express, { type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import postgres from "postgres";
import { z } from "zod";
import { ingestQueue, moveToDLQ, redis } from "./queue.js";
import { verifySignature } from "./validation.js";

const PORT = Number(process.env.WEBHOOK_PORT ?? "3000");
const LOG_LEVEL = (process.env.LOG_LEVEL ?? "info").toLowerCase();
const DATABASE_URL = process.env.DATABASE_URL;
const WEBHOOK_SECRET = process.env.INSTANTLY_WEBHOOK_SECRET;

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}
if (!WEBHOOK_SECRET) {
  throw new Error("Missing INSTANTLY_WEBHOOK_SECRET");
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 5, onnotice: () => {} });

const InstantlyWebhookSchema = z.object({
  reply_id: z.string().optional(),
  email_id: z.string().optional(),
  campaign_id: z.string().min(1),
  from_email: z.string().email(),
  to_email: z.string().email().optional(),
  subject: z.string().optional(),
  body_text: z.string().min(1),
  body_html: z.string().optional(),
  received_at: z.string().min(1),
  headers: z.record(z.string()).optional(),
  trace_id: z.string().uuid().optional()
});

type InstantlyWebhookPayload = z.infer<typeof InstantlyWebhookSchema>;

type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function log(level: LogLevel, message: string, traceId?: string, metadata?: Record<string, unknown>): void {
  if (levelOrder[level] < levelOrder[(LOG_LEVEL as LogLevel) ?? "info"]) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    trace_id: traceId ?? null,
    message,
    metadata: metadata ?? {}
  };

  console.log(JSON.stringify(payload));
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getSignatureHeader(req: Request): string | null {
  return (
    req.header("instantly-webhook-secret") ??
    req.header("INSTANTLY_WEBHOOK_SECRET") ??
    req.header("x-instantly-signature") ??
    null
  );
}

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    }
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const traceId = (res.locals.traceId as string | undefined) ?? undefined;
    log("info", "request", traceId, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: durationMs
    });
  });
  next();
});

app.get("/health", async (_req, res) => {
  try {
    const [dbCheck] = await sql`SELECT 1 as ok`;
    const redisStatus = await redis.ping();

    res.json({
      status: "ok",
      db: dbCheck?.ok === 1 ? "ok" : "error",
      redis: redisStatus === "PONG" ? "ok" : "error"
    });
  } catch (error) {
    res.status(500).json({ status: "error" });
  }
});

app.post("/webhooks/instantly", async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = getSignatureHeader(req);

  if (!rawBody || !verifySignature(rawBody, WEBHOOK_SECRET, signature)) {
    log("warn", "invalid_signature", undefined, { signature_present: Boolean(signature) });
    return res.status(403).json({ status: "forbidden" });
  }

  const parseResult = InstantlyWebhookSchema.safeParse(req.body);
  if (!parseResult.success) {
    log("warn", "invalid_payload", undefined, { issues: parseResult.error.issues });
    return res.status(400).json({ status: "invalid_payload" });
  }

  const payload = parseResult.data as InstantlyWebhookPayload;
  const replyId = payload.reply_id ?? payload.email_id;
  if (!replyId) {
    return res.status(400).json({ status: "invalid_payload", message: "Missing reply_id" });
  }

  const traceId = payload.trace_id ?? crypto.randomUUID();
  res.locals.traceId = traceId;

  const idempotencyKey = sha256(replyId);
  const existing = await sql<{ entity_id: string }[]>`
    SELECT entity_id FROM idempotency_keys
    WHERE key = ${idempotencyKey} AND expires_at > NOW()
  `;

  if (existing.length > 0) {
    log("info", "idempotent_duplicate", traceId, { reply_id: replyId, reply_item_id: existing[0].entity_id });
    return res.status(200).json({
      status: "duplicate",
      replyItemId: existing[0].entity_id
    });
  }

  const jobPayload = {
    reply_id: replyId,
    email_id: payload.email_id ?? null,
    campaign_id: payload.campaign_id,
    from_email: payload.from_email,
    to_email: payload.to_email ?? null,
    subject: payload.subject ?? null,
    body_text: payload.body_text,
    body_html: payload.body_html ?? null,
    received_at: payload.received_at,
    headers: payload.headers ?? {},
    raw_payload: req.body,
    trace_id: traceId
  };

  try {
    const job = await ingestQueue.add("ingest_reply", jobPayload, { jobId: replyId });
    log("info", "queued", traceId, { reply_id: replyId, job_id: job.id });
    return res.status(200).json({ status: "queued", jobId: job.id, traceId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown enqueue error");
    await moveToDLQ("reply-ingest", "ingest_reply", jobPayload, err, 1);
    log("error", "enqueue_failed", traceId, { error: err.message });
    return res.status(500).json({ status: "error" });
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log("error", "unhandled_error", undefined, { error: err.message });
  res.status(500).json({ status: "error" });
});

const server = app.listen(PORT, () => {
  log("info", "webhook_handler_started", undefined, { port: PORT });
});

async function shutdown(): Promise<void> {
  log("info", "shutdown_start");
  server.close();
  await ingestQueue.close();
  await redis.quit();
  await sql.end();
  log("info", "shutdown_complete");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
