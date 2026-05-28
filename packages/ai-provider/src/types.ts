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

export interface AIProvider {
  classify(input: ClassifyInput): Promise<ClassificationOutput>;
  generateDraft(input: DraftInput): Promise<DraftOutput>;
  extractSignals(input: SignalExtractionInput): Promise<SignalExtractionOutput>;
  generateSequence(input: SequenceInput): Promise<SequenceOutput>;
  analyzeObjection(input: ObjectionInput): Promise<ObjectionOutput>;
  analyzePerformance(input: AnalyticsInput): Promise<AnalyticsOutput>;
}
