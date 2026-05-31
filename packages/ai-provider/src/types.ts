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

export interface PromptOverride {
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AIProvider {
  classify(input: ClassifyInput, override?: PromptOverride): Promise<ClassificationOutput>;
  generateDraft(input: DraftInput, override?: PromptOverride): Promise<DraftOutput>;
  extractSignals(input: SignalExtractionInput, override?: PromptOverride): Promise<SignalExtractionOutput>;
  generateSequence(input: SequenceInput, override?: PromptOverride): Promise<SequenceOutput>;
  analyzeObjection(input: ObjectionInput, override?: PromptOverride): Promise<ObjectionOutput>;
  analyzePerformance(input: AnalyticsInput, override?: PromptOverride): Promise<AnalyticsOutput>;
}
