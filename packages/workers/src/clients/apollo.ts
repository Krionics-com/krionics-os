export interface ApolloSearchParams {
  titles?: string[];
  q_organization_domains?: string[];
  organization_industry_tag_ids?: string[];
  num_employees_ranges?: string[];
  person_locations?: string[];
  seniorities?: string[];
  contact_email_status?: string[];
  page?: number;
  per_page?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  title: string | null;
  seniority: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  organization: {
    name: string | null;
    website_url: string | null;
    primary_domain: string | null;
    industry: string | null;
    estimated_num_employees: number | null;
  } | null;
}

export interface ApolloSearchResponse {
  people: ApolloPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

const BASE_URL = "https://api.apollo.io/v1";

export async function apolloSearchPeople(
  apiKey: string,
  params: ApolloSearchParams
): Promise<ApolloSearchResponse> {
  const response = await fetch(`${BASE_URL}/mixed_people/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey
    },
    body: JSON.stringify({
      ...params,
      page: params.page ?? 1,
      per_page: params.per_page ?? 25
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apollo API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<ApolloSearchResponse>;
}
