import { sql } from "./db.js";

/**
 * Seeds default reply_policies and timing_rules for a client.
 * Call this after creating a new client if the DB trigger is not available
 * (e.g. in tests or seed scripts).
 */
export async function seedClientPolicies(clientId: string): Promise<void> {
  await sql`SELECT seed_client_default_policies(${clientId}::uuid)`;
}
