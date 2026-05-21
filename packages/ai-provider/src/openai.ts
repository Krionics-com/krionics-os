import OpenAI from "openai";
import {
  ClassifyInputSchema,
  ClassificationOutputSchema,
  DraftInputSchema,
  DraftOutputSchema
} from "@krionics/schema";
import { AIProviderError } from "./errors.js";
import type { AIProvider } from "./types.js";
import type { ClassifyInput, ClassificationOutput, DraftInput, DraftOutput } from "@krionics/schema";

type OpenAIProviderOptions = {
  apiKey: string;
  model: string;
  baseURL?: string;
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

export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIProviderOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL });
    this.model = options.model;
  }

  async classify(input: ClassifyInput): Promise<ClassificationOutput> {
    const validatedInput = ClassifyInputSchema.parse(input);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        messages: [
          { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
          { role: "user", content: buildClassifyPrompt(validatedInput) }
        ]
      });

      const text = response.choices[0]?.message?.content ?? "";
      if (!text) {
        throw new AIProviderError("openai", "EMPTY_RESPONSE", "OpenAI response had no text content", false);
      }

      return parseAndValidate(text, ClassificationOutputSchema, "openai");
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError("openai", "API_ERROR", "OpenAI request failed", true, error);
    }
  }

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const validatedInput = DraftInputSchema.parse(input);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.3,
        messages: [
          { role: "system", content: DRAFT_SYSTEM_PROMPT },
          { role: "user", content: buildDraftPrompt(validatedInput) }
        ]
      });

      const text = response.choices[0]?.message?.content ?? "";
      if (!text) {
        throw new AIProviderError("openai", "EMPTY_RESPONSE", "OpenAI response had no text content", false);
      }

      return parseAndValidate(text, DraftOutputSchema, "openai");
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError("openai", "API_ERROR", "OpenAI request failed", true, error);
    }
  }
}
