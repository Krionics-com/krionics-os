import { sql } from "./db.js";

export type AIInvocationType =
  | "reply_classification"
  | "draft_generation"
  | "personalization"
  | "signal_extraction"
  | "lead_scoring"
  | "analytics_intelligence"
  | "sentiment_analysis"
  | "escalation_detection";

export type EntityType = "reply" | "lead" | "campaign";

export interface LogAIInvocationParams {
  clientId?: string | null;
  invocationType: AIInvocationType;
  traceId: string;
  entityType?: EntityType | null;
  entityId?: string | null;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs: number;
  cached?: boolean;
  success: boolean;
  errorCode?: string | null;
  rawOutput?: unknown;
  validatedOutput?: unknown;
  validationPassed?: boolean | null;
  costUsdMicro?: number | null;
  promptVersion?: number;
}

export async function logAIInvocation(params: LogAIInvocationParams): Promise<void> {
  try {
    await sql`
      INSERT INTO ai_invocations (
        client_id, invocation_type, trace_id,
        entity_type, entity_id,
        model, input_tokens, output_tokens, latency_ms,
        cached, success, error_code,
        raw_output, validated_output, validation_passed,
        cost_usd_micro, prompt_version
      ) VALUES (
        ${params.clientId ?? null}::uuid,
        ${params.invocationType}::ai_invocation_type,
        ${params.traceId}::uuid,
        ${params.entityType ?? null},
        ${params.entityId ?? null}::uuid,
        ${params.model},
        ${params.inputTokens ?? null},
        ${params.outputTokens ?? null},
        ${params.latencyMs},
        ${params.cached ?? false},
        ${params.success},
        ${params.errorCode ?? null},
        ${params.rawOutput ? JSON.stringify(params.rawOutput) : null}::jsonb,
        ${params.validatedOutput ? JSON.stringify(params.validatedOutput) : null}::jsonb,
        ${params.validationPassed ?? null},
        ${params.costUsdMicro ?? null},
        ${params.promptVersion ?? 1}
      )
    `;
  } catch (err) {
    console.error("[log-ai-invocation] failed to write invocation log", {
      invocationType: params.invocationType,
      traceId: params.traceId,
      error: err
    });
  }
}

export function estimateCostMicro(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Costs in micro-dollars per token (approximate)
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-20250514": { input: 3, output: 15 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
    "claude-3-opus-20240229": { input: 15, output: 75 },
    "gpt-4o": { input: 5, output: 15 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 }
  };

  const rates = pricing[model] ?? { input: 3, output: 15 };
  // Tokens are priced per 1M; micro-dollars = cost_per_1M_tokens * tokens / 1_000_000 * 1_000_000
  return Math.round(rates.input * inputTokens + rates.output * outputTokens);
}
