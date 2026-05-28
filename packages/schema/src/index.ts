import { z } from "zod";

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type ClientId = Brand<string, "ClientId">;
export type CampaignId = Brand<string, "CampaignId">;
export type LeadId = Brand<string, "LeadId">;
export type ReplyItemId = Brand<string, "ReplyItemId">;
export type RawReplyId = Brand<string, "RawReplyId">;

export const ReplyIntentSchema = z.enum([
  "POSITIVE",
  "OBJECTION",
  "FAQ",
  "BOOKING_INTENT",
  "NURTURE",
  "UNSUBSCRIBE",
  "NOT_RELEVANT",
  "BOUNCE_OOO",
  "HOSTILE",
  "UNKNOWN"
]);
export type ReplyIntent = z.infer<typeof ReplyIntentSchema>;

export const ReplyItemStatusSchema = z.enum([
  "RECEIVED",
  "CLASSIFYING",
  "CLASSIFIED",
  "CLASSIFICATION_FAILED",
  "DRAFT_GENERATING",
  "DRAFT_FAILED",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "ESCALATED",
  "SENT",
  "SUPPRESSED"
]);
export type ReplyItemStatus = z.infer<typeof ReplyItemStatusSchema>;

export const LeadStatusSchema = z.enum([
  "raw_imported",
  "contacted",
  "replied",
  "positive",
  "meeting_booked",
  "disqualified",
  "unsubscribed"
]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const ClassifyInputSchema = z.object({
  reply_body: z.string().min(1),
  original_body: z.string().min(1),
  original_subject: z.string().min(1).nullable(),
  from_email: z.string().email(),
  client_context: z.object({
    company_name: z.string().min(1),
    service_description: z.string().min(1),
    icp_description: z.string().min(1)
  })
});
export type ClassifyInput = z.infer<typeof ClassifyInputSchema>;

export const ClassificationOutputSchema = z.object({
  intent: ReplyIntentSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  sentiment_score: z.number().min(-1).max(1),
  urgency_score: z.number().min(0).max(1),
  buying_signals: z.array(z.string()),
  objection_type: z.string().nullable()
});
export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;

export const DraftInputSchema = z.object({
  reply_body: z.string().min(1),
  original_body: z.string().min(1),
  intent: ReplyIntentSchema,
  classification_reasoning: z.string().min(1),
  client_context: z.object({
    company_name: z.string().min(1),
    sales_lead_name: z.string().min(1),
    service_description: z.string().min(1),
    calendly_link: z.string().url()
  })
});
export type DraftInput = z.infer<typeof DraftInputSchema>;

export const DraftOutputSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1)
});
export type DraftOutput = z.infer<typeof DraftOutputSchema>;

export const ClientOperatingProfileSchema = z.object({
  client_id: z.string().min(1),
  slug: z.string().min(1),
  company_name: z.string().min(1),
  timezone: z.string().min(1),
  automation_level: z.enum(["1", "2", "3"]),
  sales_lead_name: z.string().min(1),
  service_description: z.string().min(1),
  icp_description: z.string().min(1),
  calendly_link: z.string().url(),
  crm_type: z.enum(["hubspot", "pipedrive", "none"])
});
export type ClientOperatingProfile = z.infer<typeof ClientOperatingProfileSchema>;

// --- AI invocation point 1: signal extraction ---

const SignalSchema = z.object({
  signal_type: z.string().min(1),
  description: z.string().min(1),
  strength: z.enum(["strong", "moderate", "weak"])
});

export const SignalExtractionInputSchema = z.object({
  lead: z.object({
    full_name: z.string(),
    title: z.string().nullable(),
    company_name: z.string(),
    linkedin_url: z.string().url().nullable().optional(),
    industry: z.string().nullable().optional(),
    seniority: z.string().nullable().optional()
  }),
  enrichment_data: z.record(z.unknown()).nullable().optional(),
  client_context: z.object({
    company_name: z.string().min(1),
    service_description: z.string().min(1),
    icp_description: z.string().min(1)
  })
});
export type SignalExtractionInput = z.infer<typeof SignalExtractionInputSchema>;

export const SignalExtractionOutputSchema = z.object({
  icp_fit_score: z.number().min(0).max(1),
  icp_fit_reasoning: z.string().min(1),
  signals: z.array(SignalSchema),
  personalization_hooks: z.array(z.string()),
  recommended_sequence_type: z.string().min(1)
});
export type SignalExtractionOutput = z.infer<typeof SignalExtractionOutputSchema>;

// --- AI invocation point 2: sequence generation ---

const SequenceEmailSchema = z.object({
  step: z.number().int().min(1),
  delay_days: z.number().int().min(0),
  subject: z.string().min(1),
  body: z.string().min(1)
});

export const SequenceInputSchema = z.object({
  lead: z.object({
    full_name: z.string(),
    title: z.string().nullable().optional(),
    company_name: z.string()
  }),
  icp_fit_score: z.number().min(0).max(1),
  signals: z.array(SignalSchema),
  personalization_hooks: z.array(z.string()),
  client_context: z.object({
    company_name: z.string().min(1),
    sales_lead_name: z.string().min(1),
    service_description: z.string().min(1),
    calendly_link: z.string().url()
  }),
  sequence_steps: z.number().int().min(1).max(10).default(5)
});
export type SequenceInput = z.infer<typeof SequenceInputSchema>;

export const SequenceOutputSchema = z.object({
  emails: z.array(SequenceEmailSchema).min(1),
  strategy_notes: z.string()
});
export type SequenceOutput = z.infer<typeof SequenceOutputSchema>;

// --- AI invocation point 5: objection intelligence ---

export const ObjectionInputSchema = z.object({
  reply_body: z.string().min(1),
  objection_type: z.string().nullable(),
  conversation_history: z.array(z.object({
    role: z.enum(["sender", "prospect"]),
    body: z.string()
  })),
  client_context: z.object({
    company_name: z.string().min(1),
    service_description: z.string().min(1),
    common_objections: z.array(z.string()).optional()
  })
});
export type ObjectionInput = z.infer<typeof ObjectionInputSchema>;

export const ObjectionOutputSchema = z.object({
  objection_category: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  recommended_approach: z.string().min(1),
  response_draft: z.string().min(1),
  escalate: z.boolean(),
  escalation_reason: z.string().nullable()
});
export type ObjectionOutput = z.infer<typeof ObjectionOutputSchema>;

// --- AI invocation point 6: analytics intelligence ---

export const AnalyticsInputSchema = z.object({
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  client_id: z.string().min(1),
  metrics: z.object({
    total_replies: z.number().int().min(0),
    intent_breakdown: z.record(z.number()),
    reply_rate: z.number().min(0).max(1),
    booking_rate: z.number().min(0).max(1),
    positive_rate: z.number().min(0).max(1),
    avg_response_time_hours: z.number().min(0),
    sequences_sent: z.number().int().min(0).optional()
  }),
  top_objections: z.array(z.string()),
  client_context: z.object({
    company_name: z.string().min(1),
    service_description: z.string().min(1)
  })
});
export type AnalyticsInput = z.infer<typeof AnalyticsInputSchema>;

export const AnalyticsOutputSchema = z.object({
  summary: z.string().min(1),
  key_insights: z.array(z.string()),
  recommended_actions: z.array(z.object({
    action: z.string().min(1),
    priority: z.enum(["high", "medium", "low"]),
    expected_impact: z.string().min(1)
  })),
  sequence_suggestions: z.array(z.string()),
  health_score: z.number().min(0).max(1)
});
export type AnalyticsOutput = z.infer<typeof AnalyticsOutputSchema>;
