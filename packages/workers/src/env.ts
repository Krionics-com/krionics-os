type WorkerEnv = {
  databaseUrl: string;
  redisUrl: string;
  aiProvider: string;
  anthropicApiKey?: string;
  anthropicModel: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  instantlyApiKey?: string;
  apolloApiKey?: string;
  clayApiKey?: string;
  clayWebhookSecret?: string;
  calcomWebhookSecret?: string;
  hubspotAccessToken?: string;
  pipedriveApiKey?: string;
};

let cachedEnv: WorkerEnv | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnv(): WorkerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const redisUrl = process.env.UPSTASH_REDIS_URL ?? process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing UPSTASH_REDIS_URL or REDIS_URL");
  }

  cachedEnv = {
    databaseUrl: requireEnv("DATABASE_URL"),
    redisUrl,
    aiProvider: requireEnv("AI_PROVIDER"),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    openaiModel: process.env.OPENAI_MODEL,
    instantlyApiKey: process.env.INSTANTLY_API_KEY,
    apolloApiKey: process.env.APOLLO_API_KEY,
    clayApiKey: process.env.CLAY_API_KEY,
    clayWebhookSecret: process.env.CLAY_WEBHOOK_SECRET,
    calcomWebhookSecret: process.env.CALCOM_WEBHOOK_SECRET,
    hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    pipedriveApiKey: process.env.PIPEDRIVE_API_KEY
  };

  return cachedEnv;
}
