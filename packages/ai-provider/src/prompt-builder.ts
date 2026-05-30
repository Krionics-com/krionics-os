/**
 * 6-layer composable prompt architecture.
 *
 * Layer 1 – System role:     Who the AI is and its persona.
 * Layer 2 – Task instruction: What the AI must do for this invocation.
 * Layer 3 – Client context:  Tenant-specific knowledge (company, ICP, service).
 * Layer 4 – Conv context:    The concrete data for this request (reply, lead, etc).
 * Layer 5 – Knowledge ctx:   Supplementary info (objection playbook, past signals).
 * Layer 6 – Output rules:    Strict format contract; must appear last.
 */

export interface PromptLayers {
  systemRole: string;
  taskInstruction: string;
  clientContext?: string;
  conversationContext?: string;
  knowledgeContext?: string;
  outputRules: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

export function buildPrompt(layers: PromptLayers): BuiltPrompt {
  const userParts: string[] = [layers.taskInstruction];

  if (layers.clientContext) {
    userParts.push("--- CLIENT CONTEXT ---", layers.clientContext);
  }
  if (layers.conversationContext) {
    userParts.push("--- DATA ---", layers.conversationContext);
  }
  if (layers.knowledgeContext) {
    userParts.push("--- KNOWLEDGE ---", layers.knowledgeContext);
  }

  userParts.push("--- OUTPUT RULES ---", layers.outputRules);

  return {
    system: layers.systemRole,
    user: userParts.join("\n\n")
  };
}

// ── Reusable output rule fragments ──────────────────────────────────────────

export const JSON_ONLY = "Return ONLY a valid JSON object with no markdown fences, no commentary.";

// ── System roles ─────────────────────────────────────────────────────────────

export const ROLES = {
  classifier:
    "You are an expert B2B sales reply classifier. You read inbound replies to cold email campaigns and determine the prospect's intent with precision.",
  drafter:
    "You are an expert B2B sales copywriter. You draft concise, personalised follow-up emails that move deals forward without being pushy.",
  signalExtractor:
    "You are a B2B sales intelligence analyst. You read lead enrichment data and extract actionable buying signals and ICP fit scores.",
  sequenceWriter:
    "You are a senior B2B SDR strategist. You write multi-step cold email sequences that are highly personalised and convert prospects to meetings.",
  objectionHandler:
    "You are a B2B sales coach specialising in objection handling. You diagnose objections and recommend the best response strategy.",
  analyticsAdvisor:
    "You are a B2B outbound sales analyst. You interpret campaign metrics and surface actionable insights to improve performance."
} as const;

// ── Per-operation prompt factories ────────────────────────────────────────────

import type {
  ClassifyInput,
  DraftInput,
  SignalExtractionInput,
  SequenceInput,
  ObjectionInput,
  AnalyticsInput
} from "@krionics/schema";

export function classifyPrompt(input: ClassifyInput): BuiltPrompt {
  return buildPrompt({
    systemRole: ROLES.classifier,
    taskInstruction:
      "Classify the inbound reply below. Return a JSON object matching the schema exactly.",
    clientContext: [
      `Company: ${input.client_context.company_name}`,
      `Service: ${input.client_context.service_description}`,
      `ICP: ${input.client_context.icp_description}`
    ].join("\n"),
    conversationContext: [
      `From: ${input.from_email}`,
      `Original Subject: ${input.original_subject ?? "(none)"}`,
      `Original Email:\n${input.original_body}`,
      `Reply:\n${input.reply_body}`
    ].join("\n\n"),
    outputRules: [
      JSON_ONLY,
      "Schema: { intent, confidence, reasoning, sentiment_score, urgency_score, buying_signals, objection_type }",
      "intent must be one of: POSITIVE | OBJECTION | FAQ | BOOKING_INTENT | NURTURE | UNSUBSCRIBE | NOT_RELEVANT | BOUNCE_OOO | HOSTILE | UNKNOWN",
      "confidence: 0-1 float",
      "sentiment_score: -1 (negative) to 1 (positive)",
      "urgency_score: 0-1 float",
      "buying_signals: string[]",
      "objection_type: string | null"
    ].join("\n")
  });
}

export function draftPrompt(input: DraftInput): BuiltPrompt {
  return buildPrompt({
    systemRole: ROLES.drafter,
    taskInstruction:
      "Write a reply email for the conversation below. Match the tone to the intent.",
    clientContext: [
      `Company: ${input.client_context.company_name}`,
      `Sales Lead: ${input.client_context.sales_lead_name}`,
      `Service: ${input.client_context.service_description}`,
      `Booking Link: ${input.client_context.calcom_link}`
    ].join("\n"),
    conversationContext: [
      `Intent: ${input.intent}`,
      `Classification Reasoning: ${input.classification_reasoning}`,
      `Original Email:\n${input.original_body}`,
      `Prospect Reply:\n${input.reply_body}`
    ].join("\n\n"),
    outputRules: [
      JSON_ONLY,
      "Schema: { subject, body }",
      "Keep body under 150 words. Do not use markdown inside the body.",
      "If intent is BOOKING_INTENT or POSITIVE, include the booking link naturally."
    ].join("\n")
  });
}

export function signalExtractionPrompt(input: SignalExtractionInput): BuiltPrompt {
  const lead = input.lead;
  return buildPrompt({
    systemRole: ROLES.signalExtractor,
    taskInstruction:
      "Analyse the lead data below. Extract buying signals and score ICP fit.",
    clientContext: [
      `Company: ${input.client_context.company_name}`,
      `Service: ${input.client_context.service_description}`,
      `ICP: ${input.client_context.icp_description}`
    ].join("\n"),
    conversationContext: [
      `Lead: ${lead.full_name}`,
      `Title: ${lead.title ?? "unknown"}`,
      `Company: ${lead.company_name}`,
      `Industry: ${lead.industry ?? "unknown"}`,
      `Seniority: ${lead.seniority ?? "unknown"}`,
      `LinkedIn: ${lead.linkedin_url ?? "not available"}`,
      input.enrichment_data
        ? `Enrichment Data:\n${JSON.stringify(input.enrichment_data, null, 2)}`
        : "Enrichment Data: none"
    ].join("\n"),
    outputRules: [
      JSON_ONLY,
      "Schema: { icp_fit_score, icp_fit_reasoning, signals, personalization_hooks, recommended_sequence_type }",
      "icp_fit_score: 0-1 float",
      "signals: Array<{ signal_type, description, strength: 'strong'|'moderate'|'weak' }>",
      "personalization_hooks: string[] (unique facts to reference in cold emails)",
      "recommended_sequence_type: short label e.g. 'technical-founder' or 'enterprise-procurement'"
    ].join("\n")
  });
}

export function sequencePrompt(input: SequenceInput): BuiltPrompt {
  const signalsSummary = input.signals
    .map((s) => `  - [${s.strength}] ${s.signal_type}: ${s.description}`)
    .join("\n");
  const hooksSummary = input.personalization_hooks.join(", ");

  return buildPrompt({
    systemRole: ROLES.sequenceWriter,
    taskInstruction: `Write a ${input.sequence_steps}-step cold email sequence personalised for the lead below.`,
    clientContext: [
      `Company: ${input.client_context.company_name}`,
      `Sales Lead: ${input.client_context.sales_lead_name}`,
      `Service: ${input.client_context.service_description}`,
      `Booking Link: ${input.client_context.calcom_link}`
    ].join("\n"),
    conversationContext: [
      `Lead: ${input.lead.full_name}`,
      `Title: ${input.lead.title ?? "unknown"}`,
      `Company: ${input.lead.company_name}`,
      `ICP Fit Score: ${input.icp_fit_score}`,
      `Signals:\n${signalsSummary}`,
      `Personalization Hooks: ${hooksSummary}`
    ].join("\n\n"),
    outputRules: [
      JSON_ONLY,
      "Schema: { emails, strategy_notes }",
      "emails: Array<{ step, delay_days, subject, body }>",
      `step: 1 to ${input.sequence_steps}`,
      "delay_days: days after previous step (step 1 is 0)",
      "Keep each body under 120 words. No markdown inside bodies.",
      "strategy_notes: 1-2 sentences on the overall approach"
    ].join("\n")
  });
}

export function objectionPrompt(input: ObjectionInput): BuiltPrompt {
  const historyText = input.conversation_history
    .map((m) => `[${m.role}]: ${m.body}`)
    .join("\n\n");

  const commonObjections =
    input.client_context.common_objections?.join("; ") ?? "none provided";

  return buildPrompt({
    systemRole: ROLES.objectionHandler,
    taskInstruction:
      "Diagnose the objection in the prospect reply and recommend the best response strategy.",
    clientContext: [
      `Company: ${input.client_context.company_name}`,
      `Service: ${input.client_context.service_description}`,
      `Known Objections: ${commonObjections}`
    ].join("\n"),
    conversationContext: [
      `Prospect Reply:\n${input.reply_body}`,
      `Objection Type Detected: ${input.objection_type ?? "unknown"}`,
      `Conversation History:\n${historyText}`
    ].join("\n\n"),
    outputRules: [
      JSON_ONLY,
      "Schema: { objection_category, severity, recommended_approach, response_draft, escalate, escalation_reason }",
      "severity: 'low' | 'medium' | 'high'",
      "response_draft: ready-to-send reply under 100 words",
      "escalate: true only when human intervention is essential",
      "escalation_reason: string | null"
    ].join("\n")
  });
}

export function analyticsPrompt(input: AnalyticsInput): BuiltPrompt {
  const intentBreakdown = Object.entries(input.metrics.intent_breakdown)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  return buildPrompt({
    systemRole: ROLES.analyticsAdvisor,
    taskInstruction:
      "Analyse the campaign metrics below and produce actionable insights.",
    clientContext: [
      `Company: ${input.client_context.company_name}`,
      `Service: ${input.client_context.service_description}`
    ].join("\n"),
    conversationContext: [
      `Period: ${input.period_start} → ${input.period_end}`,
      `Total Replies: ${input.metrics.total_replies}`,
      `Reply Rate: ${(input.metrics.reply_rate * 100).toFixed(1)}%`,
      `Positive Rate: ${(input.metrics.positive_rate * 100).toFixed(1)}%`,
      `Booking Rate: ${(input.metrics.booking_rate * 100).toFixed(1)}%`,
      `Avg Response Time: ${input.metrics.avg_response_time_hours.toFixed(1)}h`,
      input.metrics.sequences_sent !== undefined
        ? `Sequences Sent: ${input.metrics.sequences_sent}`
        : "",
      `Intent Breakdown:\n${intentBreakdown}`,
      `Top Objections: ${input.top_objections.join(", ") || "none"}`
    ]
      .filter(Boolean)
      .join("\n"),
    outputRules: [
      JSON_ONLY,
      "Schema: { summary, key_insights, recommended_actions, sequence_suggestions, health_score }",
      "key_insights: string[] (3-5 items)",
      "recommended_actions: Array<{ action, priority: 'high'|'medium'|'low', expected_impact }>",
      "sequence_suggestions: string[] (improvements to cold email sequences)",
      "health_score: 0-1 float representing overall campaign health"
    ].join("\n")
  });
}
