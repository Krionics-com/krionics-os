import { AIProviderError } from "./errors.js";
import type { AIProvider } from "./types.js";
import { ClaudeProvider } from "./claude.js";
import { OpenAIProvider } from "./openai.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AIProviderError("factory", "MISSING_ENV", `Missing env var: ${name}`, false);
  }
  return value;
}

export function createAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? "claude").toLowerCase();

  if (provider === "claude") {
    const apiKey = requireEnv("ANTHROPIC_API_KEY");
    const model = requireEnv("ANTHROPIC_MODEL");
    return new ClaudeProvider({ apiKey, model });
  }

  if (provider === "openai") {
    const apiKey = requireEnv("OPENAI_API_KEY");
    const model = requireEnv("OPENAI_MODEL");
    const baseURL = process.env.OPENAI_BASE_URL || undefined;
    return new OpenAIProvider({ apiKey, model, baseURL });
  }

  throw new AIProviderError("factory", "UNSUPPORTED_PROVIDER", `Unsupported AI_PROVIDER: ${provider}`, false);
}
