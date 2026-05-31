import { Queue, type QueueOptions } from "bullmq";
import IORedis from "ioredis";
import { getEnv } from "./env.js";

const { redisUrl } = getEnv();

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const baseQueueOptions: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail: { count: 5000, age: 604800 }
  }
};

export const ingestQueue = new Queue("reply-ingest", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 }
  }
});

export const classificationQueue = new Queue("reply-classification", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    priority: 50
  }
});

export const draftQueue = new Queue("reply-draft_generation", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    priority: 50
  }
});

export const reviewDispatchQueue = new Queue("reply-review_dispatch", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 }
  }
});

export const scheduledSendQueue = new Queue("reply-scheduled-send", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 }
  }
});

// ── Acquisition / enrichment ─────────────────────────────────────────────────

export const apolloImportQueue = new Queue("lead-apollo-import", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }
  }
});

export const clayEnrichmentQueue = new Queue("lead-clay-enrichment", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 }
  }
});

export const signalExtractionQueue = new Queue("lead-signal-extraction", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }
  }
});

// ── CRM sync ─────────────────────────────────────────────────────────────────

export const crmSyncQueue = new Queue("crm-sync", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: { type: "exponential", delay: 10000 }
  }
});

// ── Sequence generation ──────────────────────────────────────────────────────

export const sequenceGenerationQueue = new Queue("lead-sequence-generation", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 }
  }
});

export const instantlyPushQueue = new Queue("lead-instantly-push", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 }
  }
});

// ── Objection intelligence ────────────────────────────────────────────────────

export const objectionIntelligenceQueue = new Queue("reply-objection-intelligence", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }
  }
});

// ── Analytics ────────────────────────────────────────────────────────────────

export const analyticsAggregateQueue = new Queue("analytics-aggregate", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 2,
    backoff: { type: "fixed", delay: 30000 }
  }
});

export const analyticsIntelligenceQueue = new Queue("analytics-intelligence", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 2,
    backoff: { type: "exponential", delay: 30000 }
  }
});

// ── Booking reminders ────────────────────────────────────────────────────────

export const bookingReminderQueue = new Queue("booking-reminder", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }
  }
});

// ── Outbound scheduler ───────────────────────────────────────────────────────

export const outboundSchedulerQueue = new Queue("outbound-scheduler", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 2,
    backoff: { type: "fixed", delay: 60000 }
  }
});

export const deadLetterQueue = new Queue("reply-dlq", {
  ...baseQueueOptions,
  defaultJobOptions: {
    ...baseQueueOptions.defaultJobOptions,
    attempts: 1,
    removeOnFail: false
  }
});

export async function moveToDLQ(
  originalQueue: string,
  jobName: string,
  payload: unknown,
  error: Error,
  attemptsMade: number
): Promise<void> {
  await deadLetterQueue.add("dlq_entry", {
    originalQueue,
    jobName,
    payload,
    error: { message: error.message, stack: error.stack },
    attemptsMade,
    failedAt: new Date().toISOString()
  });
}
