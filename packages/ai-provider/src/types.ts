import type {
  ClassifyInput,
  ClassificationOutput,
  DraftInput,
  DraftOutput
} from "@krionics/schema";

export interface AIProvider {
  classify(input: ClassifyInput): Promise<ClassificationOutput>;
  generateDraft(input: DraftInput): Promise<DraftOutput>;
}
