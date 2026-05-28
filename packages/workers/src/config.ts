import { sql } from "./db.js";
import { redis } from "./queues.js";

const FLAG_TTL_SECONDS = 60;
const CONFIG_TTL_SECONDS = 120;

export async function getFeatureFlag(
  clientId: string | null,
  featureKey: string
): Promise<boolean> {
  const cacheKey = `ff:${featureKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) return cached === "1";
  } catch {
    // Redis miss — fall through to DB
  }

  const [row] = await sql<{ enabled: boolean }[]>`
    SELECT enabled FROM feature_flags WHERE feature_key = ${featureKey} LIMIT 1
  `;

  const enabled = row?.enabled ?? true;

  try {
    await redis.setex(cacheKey, FLAG_TTL_SECONDS, enabled ? "1" : "0");
  } catch {
    // Cache write failure is non-fatal
  }

  return enabled;
}

export async function getGlobalConfig<T = unknown>(configKey: string): Promise<T | null> {
  const cacheKey = `gc:${configKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch {
    // Redis miss — fall through to DB
  }

  const [row] = await sql<{ value: unknown }[]>`
    SELECT value FROM global_config WHERE config_key = ${configKey} LIMIT 1
  `;

  if (!row) return null;

  try {
    await redis.setex(cacheKey, CONFIG_TTL_SECONDS, JSON.stringify(row.value));
  } catch {
    // Cache write failure is non-fatal
  }

  return row.value as T;
}
