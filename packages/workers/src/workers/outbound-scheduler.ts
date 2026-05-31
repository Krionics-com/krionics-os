import { Worker } from "bullmq";
import { sql } from "../db.js";
import { apolloImportQueue, outboundSchedulerQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";
import {
  mapIcpToApolloSearchParams,
  validateApolloSearchParams,
  type ClientIcpConfig,
  type ApolloPullConfig,
} from "../icp-to-apollo.js";

type ActiveClient = {
  id: string;
  config: ClientIcpConfig | null;
  apollo_config: ApolloPullConfig | null;
  last_apollo_pull_at: string | null;
};

function isDue(cadence: string | undefined, lastPullAt: string | null): boolean {
  if (!lastPullAt) return true;
  const last = new Date(lastPullAt).getTime();
  const now = Date.now();
  const elapsedHours = (now - last) / (60 * 60 * 1000);

  if (cadence === "weekly") return elapsedHours >= 24 * 7;
  if (cadence === "threshold") return elapsedHours >= 1;
  return elapsedHours >= 24;
}

async function getCurrentLeadCount(clientId: string): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM leads
    WHERE client_id = ${clientId}::uuid
      AND lead_status NOT IN ('suppressed', 'rejected', 'opted_out', 'bounced')
  `;
  return row?.count ?? 0;
}

export function createOutboundSchedulerWorker(): Worker {
  return new Worker(
    outboundSchedulerQueue.name,
    async () => {
      const clients = await sql<ActiveClient[]>`
        SELECT id, config, apollo_config, last_apollo_pull_at
        FROM clients
        WHERE outbound_active = true
      `;

      const dispatched: Array<{ clientId: string; status: string; reason?: string }> = [];

      for (const client of clients) {
        const cadence = client.apollo_config?.pull_cadence ?? "daily";
        const maxTotal = client.apollo_config?.max_total_leads ?? 2000;
        const thresholdMin = client.apollo_config?.threshold_min ?? 100;

        if (!isDue(cadence, client.last_apollo_pull_at)) {
          dispatched.push({ clientId: client.id, status: "skipped", reason: "not_due" });
          continue;
        }

        const currentCount = await getCurrentLeadCount(client.id);
        if (currentCount >= maxTotal) {
          dispatched.push({ clientId: client.id, status: "skipped", reason: "max_total_reached" });
          continue;
        }
        if (cadence === "threshold" && currentCount >= thresholdMin) {
          dispatched.push({ clientId: client.id, status: "skipped", reason: "threshold_not_hit" });
          continue;
        }

        const icp: ClientIcpConfig = client.config ?? {};
        const searchParams = mapIcpToApolloSearchParams(icp, client.apollo_config ?? {});
        const validation = validateApolloSearchParams(searchParams);

        if (!validation.valid) {
          dispatched.push({
            clientId: client.id,
            status: "skipped",
            reason: `invalid_search_params:${validation.missing.join(",")}`,
          });
          continue;
        }

        await apolloImportQueue.add(
          "apollo_import",
          { clientId: client.id, campaignId: null, searchParams },
          { jobId: `apollo-scheduled:${client.id}:${Date.now()}` }
        );

        await sql`
          UPDATE clients SET last_apollo_pull_at = NOW()
          WHERE id = ${client.id}::uuid
        `;

        await emitEvent({
          clientId: client.id,
          eventType: "outbound_pull_scheduled",
          metadata: { cadence, search_params: searchParams, current_lead_count: currentCount },
          traceId: null,
        });

        dispatched.push({ clientId: client.id, status: "queued" });
      }

      return { processed: clients.length, dispatched };
    },
    { connection: outboundSchedulerQueue.opts.connection }
  );
}
