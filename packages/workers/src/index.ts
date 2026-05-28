import { Worker } from "bullmq";
import { redis, moveToDLQ } from "./queues.js";
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
  { name: "crm:sync", worker: createCRMSyncWorker() }
];

workers.forEach(attachDlqHandler);

console.log("[workers] RICR workers are running.");

async function shutdown(): Promise<void> {
  console.log("[workers] Shutting down...");
  await Promise.all(workers.map(({ worker }) => worker.close()));
  await redis.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
