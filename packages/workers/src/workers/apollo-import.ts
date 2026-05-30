import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { apolloImportQueue, clayEnrichmentQueue } from "../queues.js";
import { getEnv } from "../env.js";
import { emitEvent } from "../emit-event.js";
import { apolloSearchPeople, type ApolloSearchParams } from "../clients/apollo.js";

const ApolloImportJobSchema = z.object({
  clientId: z.string().uuid(),
  campaignId: z.string().uuid().optional().nullable(),
  searchParams: z.object({
    titles: z.array(z.string()).optional(),
    q_organization_domains: z.array(z.string()).optional(),
    organization_industry_tag_ids: z.array(z.string()).optional(),
    num_employees_ranges: z.array(z.string()).optional(),
    person_locations: z.array(z.string()).optional(),
    seniorities: z.array(z.string()).optional(),
    contact_email_status: z.array(z.string()).optional(),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(100).optional()
  }),
  traceId: z.string().uuid().nullable().optional()
});

type ApolloImportJob = z.infer<typeof ApolloImportJobSchema>;

export function createApolloImportWorker(): Worker<ApolloImportJob> {
  const env = getEnv();
  const apiKey = env.apolloApiKey;
  if (!apiKey) {
    throw new Error("Missing APOLLO_API_KEY");
  }

  return new Worker(
    apolloImportQueue.name,
    async (job) => {
      const payload = ApolloImportJobSchema.parse(job.data);

      const result = await apolloSearchPeople(apiKey, payload.searchParams as ApolloSearchParams);
      const people = result.people.filter((p) => !!p.email);

      if (people.length === 0) {
        return { status: "no_results", total: 0, imported: 0 };
      }

      let imported = 0;
      const newLeadIds: string[] = [];

      for (const person of people) {
        if (!person.email) continue;

        const [row] = await sql<{ id: string; is_new: boolean }[]>`
          INSERT INTO leads (
            client_id,
            campaign_id,
            email,
            first_name,
            last_name,
            title,
            seniority,
            linkedin_url,
            company,
            company_domain,
            company_industry,
            company_size,
            source,
            apollo_id,
            lead_status
          ) VALUES (
            ${payload.clientId}::uuid,
            ${payload.campaignId ?? null}::uuid,
            ${person.email},
            ${person.first_name ?? null},
            ${person.last_name ?? null},
            ${person.title ?? null},
            ${person.seniority ?? null},
            ${person.linkedin_url ?? null},
            ${person.organization?.name ?? null},
            ${person.organization?.primary_domain ?? null},
            ${person.organization?.industry ?? null},
            ${person.organization?.estimated_num_employees != null
              ? String(person.organization.estimated_num_employees)
              : null},
            'apollo',
            ${person.id},
            'raw_imported'
          )
          ON CONFLICT (client_id, email) DO UPDATE
            SET
              first_name  = EXCLUDED.first_name,
              last_name   = EXCLUDED.last_name,
              title       = EXCLUDED.title,
              seniority   = EXCLUDED.seniority,
              linkedin_url = EXCLUDED.linkedin_url,
              company     = EXCLUDED.company,
              company_domain = EXCLUDED.company_domain,
              company_industry = EXCLUDED.company_industry,
              apollo_id   = EXCLUDED.apollo_id,
              updated_at  = NOW()
          RETURNING id, (xmax = 0) AS is_new
        `;

        if (!row) continue;
        imported++;

        if (row.is_new) {
          newLeadIds.push(row.id);
        }
      }

      if (newLeadIds.length > 0) {
        await emitEvent({
          clientId: payload.clientId,
          campaignId: payload.campaignId ?? null,
          eventType: "leads_imported",
          metadata: {
            source: "apollo",
            count: newLeadIds.length,
            campaign_id: payload.campaignId ?? null,
            search_page: payload.searchParams.page ?? 1
          },
          traceId: payload.traceId ?? null
        });

        // Enqueue Clay enrichment for new leads
        for (const leadId of newLeadIds) {
          await clayEnrichmentQueue.add("enrich_lead", {
            clientId: payload.clientId,
            leadId,
            traceId: payload.traceId ?? null
          });
        }
      }

      return {
        status: "done",
        total: people.length,
        imported,
        new: newLeadIds.length,
        total_pages: result.pagination.total_pages
      };
    },
    { connection: apolloImportQueue.opts.connection }
  );
}
