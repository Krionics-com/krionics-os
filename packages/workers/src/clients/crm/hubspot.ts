import type { CRMContact, CRMDeal, CRMProvider } from "./types.js";

const BASE = "https://api.hubapi.com";

export class HubSpotProvider implements CRMProvider {
  constructor(private readonly accessToken: string) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`
    };
  }

  async upsertContact(contact: CRMContact): Promise<{ id: string }> {
    // Search for existing contact by email
    const search = await fetch(`${BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "email", operator: "EQ", value: contact.email }
            ]
          }
        ],
        limit: 1,
        properties: ["email", "firstname", "lastname"]
      })
    });

    if (!search.ok) {
      throw new Error(`HubSpot search failed: ${search.status}`);
    }

    const searchResult = (await search.json()) as { results: Array<{ id: string }> };
    const existing = searchResult.results[0];

    const properties: Record<string, string> = {
      email: contact.email,
      ...(contact.first_name ? { firstname: contact.first_name } : {}),
      ...(contact.last_name ? { lastname: contact.last_name } : {}),
      ...(contact.title ? { jobtitle: contact.title } : {}),
      ...(contact.company ? { company: contact.company } : {}),
      ...(contact.phone ? { phone: contact.phone } : {})
    };

    if (existing) {
      await fetch(`${BASE}/crm/v3/objects/contacts/${existing.id}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ properties })
      });
      return { id: existing.id };
    }

    const create = await fetch(`${BASE}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ properties })
    });

    if (!create.ok) {
      throw new Error(`HubSpot contact create failed: ${create.status}`);
    }

    const created = (await create.json()) as { id: string };
    return { id: created.id };
  }

  async createDeal(deal: CRMDeal): Promise<{ id: string }> {
    const response = await fetch(`${BASE}/crm/v3/objects/deals`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        properties: {
          dealname: deal.name,
          amount: deal.amount ?? 0,
          dealstage: deal.stage ?? "appointmentscheduled",
          closedate: deal.close_date ?? null,
          description: deal.notes ?? null
        },
        associations: [
          {
            to: { id: deal.contact_id },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot deal create failed: ${response.status}`);
    }

    const created = (await response.json()) as { id: string };
    return { id: created.id };
  }
}
