export class AIProviderError extends Error {
  readonly provider: string;
  readonly code: string;
  readonly retryable: boolean;

  constructor(provider: string, code: string, message: string, retryable: boolean, cause?: unknown) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
