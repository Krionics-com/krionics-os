// Public API for @krionics/workers — queue objects and shared utilities.
// Import from this file when using the package as a library (e.g. in the dashboard).
// The worker processes themselves are started via src/index.ts.

export {
  redis,
  ingestQueue,
  classificationQueue,
  draftQueue,
  reviewDispatchQueue,
  scheduledSendQueue,
  deadLetterQueue,
  apolloImportQueue,
  clayEnrichmentQueue,
  signalExtractionQueue,
  crmSyncQueue,
  sequenceGenerationQueue,
  instantlyPushQueue,
  objectionIntelligenceQueue,
  analyticsAggregateQueue,
  analyticsIntelligenceQueue,
  bookingReminderQueue,
  moveToDLQ
} from "./queues.js";
