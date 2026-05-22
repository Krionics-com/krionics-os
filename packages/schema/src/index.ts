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
