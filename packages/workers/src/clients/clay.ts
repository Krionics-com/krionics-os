export interface ClayEnrichmentRequest {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  linkedin_url?: string | null;
  company_domain?: string | null;
  company_name?: string | null;
  external_id: string;
}

export interface ClayEnrichmentResponse {
  success: boolean;
  request_id?: string;
  message?: string;
}

export interface ClayWebhookPayload {
  external_id: string;
  email: string;

  // LinkedIn
  linkedin_profile_url?: string;
  linkedin_headline?: string;
  linkedin_summary?: string;
  linkedin_updated_at?: string;

  // Company
  company_summary?: string;
  company_growth_signals?: string[];
  hiring_signals?: string[];
  tech_stack?: string[];
  website_summary?: string;
  recent_news?: string[];

  // Raw enrichment blob
  raw?: Record<string, unknown>;

  clay_request_id?: string;
}

const BASE_URL = "https://api.clay.com/v1";

/**
 * Triggers Clay enrichment for a lead via Clay's inbound webhook.
 * Clay enriches the data asynchronously and POSTs back to our
 * /api/webhooks/clay endpoint when complete.
 */
export async function triggerClayEnrichment(
  apiKey: string,
  webhookUrl: string,
  request: ClayEnrichmentRequest
): Promise<ClayEnrichmentResponse> {
  const response = await fetch(`${BASE_URL}/enrichment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      ...request,
      callback_url: webhookUrl
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clay API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<ClayEnrichmentResponse>;
}
