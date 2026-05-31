import { sql } from "./db.js";

export interface PromptOverride {
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  prompt_id: string;
}

const cache = new Map<string, { value: PromptOverride | null; expiresAt: number }>();
const TTL_MS = 60_000;

function cacheKey(slug: string, clientId: string | null): string {
  return `${slug}::${clientId ?? "global"}`;
}

/**
 * Returns the active prompt override for the given slug. Prefers a client-
 * specific override; falls back to the global row. Returns null if no row
 * is active, in which case the worker uses its hardcoded prompt.
 */
export async function loadPromptOverride(
  slug: string,
  clientId: string | null
): Promise<PromptOverride | null> {
  const key = cacheKey(slug, clientId);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const rows = await sql<{
    id: string;
    system_prompt: string;
    model: string;
    temperature: string;
    max_tokens: number;
    client_id: string | null;
  }[]>`
    SELECT id, system_prompt, model, temperature, max_tokens, client_id
    FROM ai_prompts
    WHERE slug = ${slug}
      AND is_active = true
      AND (client_id = ${clientId}::uuid OR client_id IS NULL)
    ORDER BY (client_id IS NULL) ASC, version DESC
    LIMIT 1
  `;

  const row = rows[0];
  const result: PromptOverride | null = row
    ? {
        system_prompt: row.system_prompt,
        model: row.model,
        temperature: Number(row.temperature),
        max_tokens: row.max_tokens,
        prompt_id: row.id,
      }
    : null;

  cache.set(key, { value: result, expiresAt: Date.now() + TTL_MS });
  return result;
}

export function clearPromptOverrideCache(): void {
  cache.clear();
}
