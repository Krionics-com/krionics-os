import type { CRMContact, CRMDeal, CRMProvider } from "./types.js";

const BASE = "https://api.pipedrive.com/v1";

export class PipedriveProvider implements CRMProvider {
  constructor(private readonly apiKey: string) {}

  private url(path: string): string {
    return `${BASE}${path}?api_token=${this.apiKey}`;
  }

  async upsertContact(contact: CRMContact): Promise<{ id: string }> {
    // Search existing person by email
    const search = await fetch(
      `${BASE}/persons/search?term=${encodeURIComponent(contact.email)}&field=email&api_token=${this.apiKey}`
    );

    if (!search.ok) {
      throw new Error(`Pipedrive person search failed: ${search.status}`);
    }

    const searchResult = (await search.json()) as {
      data?: { items?: Array<{ item: { id: number } }> };
    };

    const existing = searchResult.data?.items?.[0]?.item;

    const body: Record<string, unknown> = {
      email: [{ value: contact.email, primary: true }],
      ...(contact.first_name || contact.last_name
        ? { name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") }
        : {}),
      ...(contact.title ? { job_title: contact.title } : {}),
      ...(contact.phone ? { phone: [{ value: contact.phone, primary: true }] } : {})
    };

    if (existing) {
      await fetch(this.url(`/persons/${existing.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      return { id: String(existing.id) };
    }

    const create = await fetch(this.url("/persons"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!create.ok) {
      throw new Error(`Pipedrive person create failed: ${create.status}`);
    }

    const created = (await create.json()) as { data?: { id: number } };
    if (!created.data?.id) {
      throw new Error("Pipedrive person create returned no id");
    }

    return { id: String(created.data.id) };
  }

  async createDeal(deal: CRMDeal): Promise<{ id: string }> {
    const response = await fetch(this.url("/deals"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: deal.name,
        person_id: Number(deal.contact_id),
        value: deal.amount ?? 0,
        expected_close_date: deal.close_date ?? null,
        status: "open"
      })
    });

    if (!response.ok) {
      throw new Error(`Pipedrive deal create failed: ${response.status}`);
    }

    const created = (await response.json()) as { data?: { id: number } };
    if (!created.data?.id) {
      throw new Error("Pipedrive deal create returned no id");
    }

    return { id: String(created.data.id) };
  }
}
