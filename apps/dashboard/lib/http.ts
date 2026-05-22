export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type FetchJsonOptions = {
  timeoutMs?: number;
};

type RetryOptions = FetchJsonOptions & {
  retries?: number;
  retryDelayMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;

export function isRetryableStatus(status?: number): boolean {
  return typeof status === "number" && status >= 500 && status <= 599;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  options: FetchJsonOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message = typeof data?.error === "string" ? data.error : "Request failed";
      throw new ApiError(message, res.status);
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out", 408);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("Network error", 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJsonWithRetry<T>(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let attempt = 0;
  while (true) {
    try {
      return await fetchJson<T>(url, init, options);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;

      if (!isRetryableStatus(status) || attempt >= retries) {
        throw error;
      }

      const delay = retryDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}
