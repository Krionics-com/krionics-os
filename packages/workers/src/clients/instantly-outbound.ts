const BASE = "https://api.instantly.ai/api/v1";

export interface InstantlyEmail {
  subject: string;
  body: string;
  delay_days: number;
}

export interface InstantlyAddLeadParams {
  apiKey: string;
  campaignId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  variables?: Record<string, string>;
  emails: InstantlyEmail[];
}

export interface InstantlyAddLeadResult {
  leadId: string;
}

export async function addLeadToInstantlyCampaign(
  params: InstantlyAddLeadParams
): Promise<InstantlyAddLeadResult> {
  const response = await fetch(`${BASE}/lead/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: params.apiKey,
      campaign_id: params.campaignId,
      skip_if_in_workspace: true,
      leads: [
        {
          email: params.email,
          first_name: params.firstName ?? "",
          last_name: params.lastName ?? "",
          company_name: params.companyName ?? "",
          variables: params.variables ?? {},
          email_list: params.emails.map((e, i) => ({
            subject: e.subject,
            body: e.body,
            delay_days: e.delay_days,
            step: i + 1
          }))
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly add lead failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id?: string; lead_id?: string };
  const leadId = data.id ?? data.lead_id ?? params.email;
  return { leadId };
}

export async function getInstantlyCampaign(
  apiKey: string,
  campaignId: string
): Promise<{ id: string; name: string; status: string }> {
  const response = await fetch(
    `${BASE}/campaign/get?api_key=${apiKey}&campaign_id=${campaignId}`
  );

  if (!response.ok) {
    throw new Error(`Instantly get campaign failed: ${response.status}`);
  }

  return response.json() as Promise<{ id: string; name: string; status: string }>;
}

export interface InstantlyCampaignSummary {
  id: string;
  name: string;
  status: string;
}

export async function listInstantlyCampaigns(
  apiKey: string
): Promise<InstantlyCampaignSummary[]> {
  const response = await fetch(
    `${BASE}/campaign/list?api_key=${encodeURIComponent(apiKey)}`
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly list campaigns failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as
    | { campaigns?: Array<{ id: string; name: string; status?: string }> }
    | Array<{ id: string; name: string; status?: string }>;

  const list = Array.isArray(data) ? data : data.campaigns ?? [];
  return list.map((c) => ({ id: c.id, name: c.name, status: c.status ?? "unknown" }));
}
