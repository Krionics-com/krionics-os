import Anthropic from "@anthropic-ai/sdk";
import {
  ClassifyInputSchema,
  ClassificationOutputSchema,
  DraftInputSchema,
  DraftOutputSchema
} from "@krionics/schema";
import { AIProviderError } from "./errors.js";
import type { AIProvider } from "./types.js";
import type { ClassifyInput, ClassificationOutput, DraftInput, DraftOutput } from "@krionics/schema";

type ClaudeProviderOptions = {
  apiKey: string;
  model: string;
};

const CLASSIFY_SYSTEM_PROMPT =
  "You classify inbound replies for a B2B outbound system. Return ONLY valid JSON.";

const DRAFT_SYSTEM_PROMPT =
  "You draft concise replies for a B2B outbound system. Return ONLY valid JSON.";

function buildClassifyPrompt(input: ClassifyInput): string {
  return [
    "Classify the reply and return JSON with intent, confidence, reasoning, sentiment_score, urgency_score, buying_signals, objection_type.",
    `Reply: ${input.reply_body}`,
    `Original Subject: ${input.original_subject ?? ""}`,
    `Original Body: ${input.original_body}`,
    `From: ${input.from_email}`,
    "Client Context:",
    `Company: ${input.client_context.company_name}`,
    `Service: ${input.client_context.service_description}`,
    `ICP: ${input.client_context.icp_description}`
  ].join("\n");
}

function buildDraftPrompt(input: DraftInput): string {
  return [
    "Generate a reply draft and return JSON with subject and body.",
    `Intent: ${input.intent}`,
    `Classification Reasoning: ${input.classification_reasoning}`,
    `Reply: ${input.reply_body}`,
    `Original Body: ${input.original_body}`,
    "Client Context:",
    `Company: ${input.client_context.company_name}`,
    `Sales Lead: ${input.client_context.sales_lead_name}`,
    `Service: ${input.client_context.service_description}`,
    `Calendly: ${input.client_context.calendly_link}`
  ].join("\n");
}

function extractText(content: Anthropic.Messages.Message["content"]): string {
  const first = content[0];
  if (!first || first.type !== "text") {
    throw new AIProviderError("claude", "EMPTY_RESPONSE", "Claude response had no text content", false);
  }
  return first.text;
}

function parseAndValidate<T>(
  rawText: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { message: string } } },
  provider: string
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new AIProviderError(provider, "INVALID_JSON", "Provider returned invalid JSON", false, error);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AIProviderError(provider, "VALIDATION_FAILED", result.error.message, false);
  }

  return result.data;
}

export class ClaudeProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: ClaudeProviderOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model;
  }

  async classify(input: ClassifyInput): Promise<ClassificationOutput> {
    const validatedInput = ClassifyInputSchema.parse(input);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: CLASSIFY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildClassifyPrompt(validatedInput) }]
      });

      const text = extractText(response.content);
      return parseAndValidate(text, ClassificationOutputSchema, "claude");
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError("claude", "API_ERROR", "Claude request failed", true, error);
    }
  }

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const validatedInput = DraftInputSchema.parse(input);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: DRAFT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildDraftPrompt(validatedInput) }]
      });

      const text = extractText(response.content);
      return parseAndValidate(text, DraftOutputSchema, "claude");
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError("claude", "API_ERROR", "Claude request failed", true, error);
    }
  }
}
