import Anthropic from "@anthropic-ai/sdk";
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

type ClaudeProviderOptions = {
  apiKey: string;
  model: string;
};

function extractText(content: Anthropic.Messages.Message["content"]): string {
  const first = content[0];
  if (!first || first.type !== "text") {
    throw new AIProviderError("claude", "EMPTY_RESPONSE", "Claude response had no text content", false);
  }
  return first.text;
}

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

export class ClaudeProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: ClaudeProviderOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model;
  }

  private async call(
    system: string,
    user: string,
    maxTokens = 1024,
    override?: PromptOverride
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: override?.model ?? this.model,
        max_tokens: override?.max_tokens ?? maxTokens,
        ...(override?.temperature != null ? { temperature: override.temperature } : {}),
        system: override?.system_prompt ?? system,
        messages: [{ role: "user", content: user }]
      });
      return extractText(response.content);
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError("claude", "API_ERROR", "Claude request failed", true, error);
    }
  }

  async classify(input: ClassifyInput, override?: PromptOverride): Promise<ClassificationOutput> {
    const validated = ClassifyInputSchema.parse(input);
    const { system, user } = classifyPrompt(validated);
    const text = await this.call(system, user, 1024, override);
    return parseAndValidate(text, ClassificationOutputSchema, "claude");
  }

  async generateDraft(input: DraftInput, override?: PromptOverride): Promise<DraftOutput> {
    const validated = DraftInputSchema.parse(input);
    const { system, user } = draftPrompt(validated);
    const text = await this.call(system, user, 1024, override);
    return parseAndValidate(text, DraftOutputSchema, "claude");
  }

  async extractSignals(
    input: SignalExtractionInput,
    override?: PromptOverride
  ): Promise<SignalExtractionOutput> {
    const validated = SignalExtractionInputSchema.parse(input);
    const { system, user } = signalExtractionPrompt(validated);
    const text = await this.call(system, user, 1024, override);
    return parseAndValidate(text, SignalExtractionOutputSchema, "claude");
  }

  async generateSequence(input: SequenceInput, override?: PromptOverride): Promise<SequenceOutput> {
    const validated = SequenceInputSchema.parse(input);
    const { system, user } = sequencePrompt(validated);
    const text = await this.call(system, user, 4096, override);
    return parseAndValidate(text, SequenceOutputSchema, "claude");
  }

  async analyzeObjection(input: ObjectionInput, override?: PromptOverride): Promise<ObjectionOutput> {
    const validated = ObjectionInputSchema.parse(input);
    const { system, user } = objectionPrompt(validated);
    const text = await this.call(system, user, 1024, override);
    return parseAndValidate(text, ObjectionOutputSchema, "claude");
  }

  async analyzePerformance(input: AnalyticsInput, override?: PromptOverride): Promise<AnalyticsOutput> {
    const validated = AnalyticsInputSchema.parse(input);
    const { system, user } = analyticsPrompt(validated);
    const text = await this.call(system, user, 2048, override);
    return parseAndValidate(text, AnalyticsOutputSchema, "claude");
  }
}
