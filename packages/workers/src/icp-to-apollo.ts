import type { ApolloSearchParams } from "./clients/apollo.js";

export interface ClientIcpConfig {
  target_industries?: string[] | null;
  target_company_sizes?: string[] | null;
  target_titles?: string | null;
  target_seniority?: string[] | null;
  target_geographies?: string[] | null;
}

export interface ApolloPullConfig {
  daily_lead_target?: number;
  max_total_leads?: number;
  pull_cadence?: "daily" | "weekly" | "threshold";
  threshold_min?: number;
}

const COMPANY_SIZE_RANGES: Record<string, string> = {
  "1-10": "1,10",
  "11-50": "11,50",
  "51-200": "51,200",
  "201-500": "201,500",
  "501-1000": "501,1000",
  "1001-5000": "1001,5000",
  "5001+": "5001,1000000",
};

const SENIORITY_VALUES = new Set([
  "owner",
  "founder",
  "c_suite",
  "partner",
  "vp",
  "head",
  "director",
  "manager",
  "senior",
  "entry",
  "intern",
]);

export function mapIcpToApolloSearchParams(
  icp: ClientIcpConfig,
  pull: ApolloPullConfig
): ApolloSearchParams {
  const params: ApolloSearchParams = {};

  if (icp.target_titles) {
    const titles = icp.target_titles
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (titles.length > 0) params.titles = titles;
  }

  if (icp.target_company_sizes?.length) {
    const ranges = icp.target_company_sizes
      .map((s) => COMPANY_SIZE_RANGES[s])
      .filter((r): r is string => Boolean(r));
    if (ranges.length > 0) params.num_employees_ranges = ranges;
  }

  if (icp.target_seniority?.length) {
    const seniorities = icp.target_seniority
      .map((s) => s.toLowerCase().replace(/\s+/g, "_"))
      .filter((s) => SENIORITY_VALUES.has(s));
    if (seniorities.length > 0) params.seniorities = seniorities;
  }

  if (icp.target_geographies?.length) {
    params.person_locations = icp.target_geographies;
  }

  // Always restrict to verified emails
  params.contact_email_status = ["verified"];

  params.per_page = Math.min(pull.daily_lead_target ?? 25, 100);
  params.page = 1;

  return params;
}

export function validateApolloSearchParams(params: ApolloSearchParams): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!params.titles?.length) missing.push("titles");
  if (
    !params.person_locations?.length &&
    !params.num_employees_ranges?.length &&
    !params.organization_industry_tag_ids?.length
  ) {
    missing.push("at least one of: geographies, company_sizes, industries");
  }
  return { valid: missing.length === 0, missing };
}
