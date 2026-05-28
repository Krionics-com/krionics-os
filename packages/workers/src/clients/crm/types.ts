export interface CRMContact {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  company?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
}

export interface CRMDeal {
  name: string;
  contact_id: string;
  amount?: number;
  stage?: string;
  close_date?: string;
  notes?: string;
}

export interface CRMSyncResult {
  contact_id: string;
  deal_id?: string;
  provider: string;
}

export interface CRMProvider {
  upsertContact(contact: CRMContact): Promise<{ id: string }>;
  createDeal(deal: CRMDeal): Promise<{ id: string }>;
}
