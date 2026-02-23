/**
 * Retry classification: only retry retryable errors (429, 5xx, network, timeout).
 * Respect provider retry-after. Circuit breaker per workflow run.
 */

export type RetryDecision =
  | { retry: true; delayMs: number }
  | { retry: false; reason: string };

const RETRY_AFTER_HEADER = "retry-after";

/** Extract Retry-After from response headers (seconds or HTTP-date) */
function parseRetryAfter(header: string | null): number | null {
  if (!header || !header.trim()) return null;
  const trimmed = header.trim();
  const secs = parseInt(trimmed, 10);
  if (!Number.isNaN(secs) && secs >= 0) return secs * 1000;
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return null;
}

/** Check if error is retryable */
export function isRetryableError(err: unknown, response?: { status?: number; headers?: Headers }): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("ETIMEDOUT") || msg.includes("ECONNRESET")) {
    return true;
  }
  if (response?.status) {
    if (response.status === 429) return true;
    if (response.status >= 500 && response.status < 600) return true;
    if (response.status === 408) return true; // Request Timeout
  }
  if (msg.includes("429") || msg.includes("rate limit")) return true;
  if (msg.includes("5") && (msg.includes("Internal Server") || msg.includes("Bad Gateway") || msg.includes("Service Unavailable"))) return true;
  return false;
}

/** Compute retry delay: use Retry-After if present, else exponential backoff */
export function getRetryDelay(
  err: unknown,
  attempt: number,
  response?: { status?: number; headers?: Headers }
): number {
  const retryAfter = response?.headers?.get?.(RETRY_AFTER_HEADER) ?? null;
  const parsed = parseRetryAfter(retryAfter);
  if (parsed !== null && parsed > 0) {
    return Math.min(parsed, 60000); // Cap at 60s
  }
  const base = 250;
  const max = 8000;
  return Math.min(max, base * 2 ** (attempt - 1));
}

export function shouldRetry(
  err: unknown,
  attempt: number,
  maxRetries: number,
  response?: { status?: number; headers?: Headers }
): RetryDecision {
  if (attempt > maxRetries) {
    return { retry: false, reason: "max retries exceeded" };
  }
  if (!isRetryableError(err, response)) {
    return { retry: false, reason: "error is not retryable (e.g. 4xx, bad prompt)" };
  }
  const delayMs = getRetryDelay(err, attempt, response);
  return { retry: true, delayMs };
}

/** Circuit breaker: too many failures in a run = stop retrying */
export class RunCircuitBreaker {
  private failureCount = 0;
  private readonly threshold: number;

  constructor(threshold = 5) {
    this.threshold = threshold;
  }

  recordFailure(): void {
    this.failureCount += 1;
  }

  isOpen(): boolean {
    return this.failureCount >= this.threshold;
  }
}
