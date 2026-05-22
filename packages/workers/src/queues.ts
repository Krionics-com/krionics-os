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
