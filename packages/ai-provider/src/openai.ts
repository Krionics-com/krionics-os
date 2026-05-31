import OpenAI from "openai";
import {
  ClassifyInputSchema,
  ClassificationOutputSchema,
  DraftInputSchema,
  DraftOutputSchema,
  SignalExtractionInputSchema,
  SignalExtractionOutputSchema,
  SequenceInputSchema,
  SequenceOutputSchema,
  ObjectionInputSchema,
  ObjectionOutputSchema,
  AnalyticsInputSchema,
  AnalyticsOutputSchema
} from "@krionics/schema";
import type {
  ClassifyInput,
  ClassificationOutput,
  DraftInput,
  DraftOutput,
  SignalExtractionInput,
  SignalExtractionOutput,
  SequenceInput,
  SequenceOutput,
  ObjectionInput,
  ObjectionOutput,
  AnalyticsInput,
  AnalyticsOutput
} from "@krionics/schema";
import { AIProviderError } from "./errors.js";
import type { AIProvider, PromptOverride } from "./types.js";
import {
  classifyPrompt,
  draftPrompt,
  signalExtractionPrompt,
  sequencePrompt,
  objectionPrompt,
  analyticsPrompt
} from "./prompt-builder.js";

type OpenAIProviderOptions = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

function parseAndValidate<T>(
  rawText: string,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { message: string } } },
  provider: string
): T {
  let parsed: unknown;
  try {
    const trimmed = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(trimmed);
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

  private async call(
    system: string,
    user: string,
    temperature = 0,
    maxTokens = 1024,
    override?: PromptOverride
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: override?.model ?? this.model,
        temperature: override?.temperature ?? temperature,
        max_tokens: override?.max_tokens ?? maxTokens,
        messages: [
          { role: "system", content: override?.system_prompt ?? system },
          { role: "user", content: user }
        ]
      });
      const text = response.choices[0]?.message?.content ?? "";
      if (!text) {
        throw new AIProviderError("openai", "EMPTY_RESPONSE", "OpenAI response had no text content", false);
      }
      return text;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError("openai", "API_ERROR", "OpenAI request failed", true, error);
    }
  }

  async classify(input: ClassifyInput, override?: PromptOverride): Promise<ClassificationOutput> {
    const validated = ClassifyInputSchema.parse(input);
    const { system, user } = classifyPrompt(validated);
    const text = await this.call(system, user, 0, 1024, override);
    return parseAndValidate(text, ClassificationOutputSchema, "openai");
  }

  async generateDraft(input: DraftInput, override?: PromptOverride): Promise<DraftOutput> {
    const validated = DraftInputSchema.parse(input);
    const { system, user } = draftPrompt(validated);
    const text = await this.call(system, user, 0.3, 1024, override);
    return parseAndValidate(text, DraftOutputSchema, "openai");
  }

  async extractSignals(
    input: SignalExtractionInput,
    override?: PromptOverride
  ): Promise<SignalExtractionOutput> {
    const validated = SignalExtractionInputSchema.parse(input);
    const { system, user } = signalExtractionPrompt(validated);
    const text = await this.call(system, user, 0, 1024, override);
    return parseAndValidate(text, SignalExtractionOutputSchema, "openai");
  }

  async generateSequence(input: SequenceInput, override?: PromptOverride): Promise<SequenceOutput> {
    const validated = SequenceInputSchema.parse(input);
    const { system, user } = sequencePrompt(validated);
    const text = await this.call(system, user, 0.4, 4096, override);
    return parseAndValidate(text, SequenceOutputSchema, "openai");
  }

  async analyzeObjection(input: ObjectionInput, override?: PromptOverride): Promise<ObjectionOutput> {
    const validated = ObjectionInputSchema.parse(input);
    const { system, user } = objectionPrompt(validated);
    const text = await this.call(system, user, 0, 1024, override);
    return parseAndValidate(text, ObjectionOutputSchema, "openai");
  }

  async analyzePerformance(input: AnalyticsInput, override?: PromptOverride): Promise<AnalyticsOutput> {
    const validated = AnalyticsInputSchema.parse(input);
    const { system, user } = analyticsPrompt(validated);
    const text = await this.call(system, user, 0, 2048, override);
    return parseAndValidate(text, AnalyticsOutputSchema, "openai");
  }
}
