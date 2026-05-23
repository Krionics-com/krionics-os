import { Queue } from "bullmq";
import IORedis from "ioredis";

// ── Redis connection (reuse across requests) ────────────────────────
let redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("Missing REDIS_URL environment variable");
    }
    redis = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redis;
}

// ── Queue instance cache ────────────────────────────────────────────
const queueCache = new Map<string, Queue>();

/**
 * Returns a cached BullMQ Queue instance for the given queue name.
 * Queue instances are stored in a module-level Map so each request
 * reuses the same connection / instance.
 */
export function getQueue(name: string): Queue {
  let q = queueCache.get(name);
  if (!q) {
    q = new Queue(name, { connection: getRedis() });
    queueCache.set(name, q);
  }
  return q;
}

// ── RICR pipeline queue names (excludes DLQ) ────────────────────────
export const QUEUE_NAMES: string[] = [
  "reply-ingest",
  "reply-classification",
  "reply-draft_generation",
  "reply-review_dispatch",
  "reply-scheduled-send",
];

/** The dead-letter queue name */
export function getDLQName(): string {
  return "reply-dlq";
}
