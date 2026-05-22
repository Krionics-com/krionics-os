export interface ReplyItem {
  id: string;
  raw_reply_id: string;
  client_id: string;
  lead_id: string;
  status: string;
  classification_id?: string | null;
  draft_id?: string | null;
  trace_id: string;
  created_at: string;
}

export interface ReplyClassification {
  id: string;
  intent: string;
  confidence: number;
  sentiment: string | null;
  urgency: string | null;
  key_signals: string[];
  objection_type?: string | null;
  reasoning?: string | null;
}

export interface ReplyDraft {
  id: string;
  subject: string;
  body_text: string;
  body_html?: string | null;
  status: string;
  edited_body_text?: string | null;
  edited_at?: string | null;
  edited_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
}

export interface Operator {
  id: string;
  email: string;
  name: string;
  role: string;
  client_access: string[] | null;
}
