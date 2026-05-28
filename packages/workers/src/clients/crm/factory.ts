import type { CRMProvider } from "./types.js";
import { HubSpotProvider } from "./hubspot.js";
import { PipedriveProvider } from "./pipedrive.js";

export type CRMType = "hubspot" | "pipedrive" | "none";

export function createCRMProvider(crmType: CRMType): CRMProvider | null {
  if (crmType === "hubspot") {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) throw new Error("Missing HUBSPOT_ACCESS_TOKEN");
    return new HubSpotProvider(token);
  }

  if (crmType === "pipedrive") {
    const key = process.env.PIPEDRIVE_API_KEY;
    if (!key) throw new Error("Missing PIPEDRIVE_API_KEY");
    return new PipedriveProvider(key);
  }

  return null;
}
