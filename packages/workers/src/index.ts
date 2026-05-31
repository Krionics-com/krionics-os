import { Worker } from "bullmq";
import { redis, moveToDLQ, analyticsAggregateQueue, outboundSchedulerQueue } from "./queues.js";
import { notifyDLQ } from "./notify-slack.js";
import { createIngestWorker } from "./workers/ingest.js";
import { createClassifyWorker } from "./workers/classify.js";
import { createDraftWorker } from "./workers/draft.js";
import { createReviewDispatchWorker } from "./workers/review-dispatch.js";
import { createScheduledSendWorker } from "./workers/send.js";
import { createApolloImportWorker } from "./workers/apollo-import.js";
import { createClayEnrichmentWorker } from "./workers/clay-enrichment.js";
import { createSignalExtractionWorker } from "./workers/signal-extraction.js";
import { createBookingReminderWorker } from "./workers/booking-reminder.js";
import { createCRMSyncWorker } from "./workers/crm-sync.js";
import { createAnalyticsAggregatorWorker } from "./workers/analytics-aggregator.js";
import { createAnalyticsIntelligenceWorker } from "./workers/analytics-intelligence.js";
import { createSequenceGenerationWorker } from "./workers/sequence-generation.js";
import { createInstantlyPushWorker } from "./workers/instantly-push.js";
import { createObjectionIntelligenceWorker } from "./workers/objection-intelligence.js";
import { createOutboundSchedulerWorker } from "./workers/outbound-scheduler.js";

type ManagedWorker = {
  name: string;
  worker: Worker;
};

function attachDlqHandler({ name, worker }: ManagedWorker): void {
  worker.on("failed", async (job, error) => {
    if (!job) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      await moveToDLQ(name, job.name, job.data, error, job.attemptsMade);
      await notifyDLQ(name, job.name, error, job.attemptsMade);
    }
  });

  worker.on("error", (error) => {
    console.error(`[workers] ${name} worker error:`, error);
  });
}

const workers: ManagedWorker[] = [
  { name: "reply:ingest", worker: createIngestWorker() },
  { name: "reply:classification", worker: createClassifyWorker() },
  { name: "reply:draft_generation", worker: createDraftWorker() },
  { name: "reply:review_dispatch", worker: createReviewDispatchWorker() },
  { name: "reply:scheduled_send", worker: createScheduledSendWorker() },
  { name: "lead:apollo_import", worker: createApolloImportWorker() },
  { name: "lead:clay_enrichment", worker: createClayEnrichmentWorker() },
  { name: "lead:signal_extraction", worker: createSignalExtractionWorker() },
  { name: "meeting:booking_reminder", worker: createBookingReminderWorker() },
  { name: "crm:sync", worker: createCRMSyncWorker() },
  { name: "analytics:aggregator", worker: createAnalyticsAggregatorWorker() },
  { name: "analytics:intelligence", worker: createAnalyticsIntelligenceWorker() },
  { name: "lead:sequence_generation", worker: createSequenceGenerationWorker() },
  { name: "lead:instantly_push", worker: createInstantlyPushWorker() },
  { name: "reply:objection_intelligence", worker: createObjectionIntelligenceWorker() },
  { name: "outbound:scheduler", worker: createOutboundSchedulerWorker() }
];

workers.forEach(attachDlqHandler);

// Schedule analytics aggregator to run every 15 minutes (daily granularity)
analyticsAggregateQueue.add(
  "aggregate_daily",
  { granularity: "daily" },
  { repeat: { every: 15 * 60 * 1000 }, jobId: "analytics-aggregate-daily-repeat" }
).catch((err) => {
  console.error("[workers] Failed to schedule analytics aggregator:", err);
});

// Schedule outbound scheduler to run every hour
outboundSchedulerQueue.add(
  "outbound_tick",
  {},
  { repeat: { every: 60 * 60 * 1000 }, jobId: "outbound-scheduler-tick" }
).catch((err) => {
  console.error("[workers] Failed to schedule outbound scheduler:", err);
});

console.log("[workers] RICR workers are running.");

async function shutdown(): Promise<void> {
  console.log("[workers] Shutting down...");
  await Promise.all(workers.map(({ worker }) => worker.close()));
  await redis.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
