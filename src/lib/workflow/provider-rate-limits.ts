/**
 * Provider rate limit awareness: per-user, per-BYOK-key, global (platform key).
 * Reduces 429 storms and flaky runs.
 * Minimal in-memory implementation; can upgrade to Redis/DB later.
 */

export type ProviderKey = "openai";

const LIMITS_PER_MINUTE: Record<ProviderKey, number> = {
  openai: 60,
};

const WINDOW_MS = 60_000;
const COOLDOWN_AFTER_429_MS = 60_000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const cooldowns = new Map<string, number>();

function getKey(params: {
  provider: ProviderKey;
  userId?: string | null;
  apiKeyFingerprint?: string;
  isPlatformKey: boolean;
}): string {
  if (params.apiKeyFingerprint) {
    return `key:${params.apiKeyFingerprint}:${params.provider}`;
  }
  if (params.userId) {
    return `user:${params.userId}:${params.provider}`;
  }
  return `global:${params.provider}`;
}

export async function checkProviderRateLimit(params: {
  provider: ProviderKey;
  userId?: string | null;
  apiKeyFingerprint?: string;
  isPlatformKey: boolean;
}): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const key = getKey(params);

  const now = Date.now();
  const cooldownUntil = cooldowns.get(key);
  if (cooldownUntil != null && now < cooldownUntil) {
    return { allowed: false, retryAfterMs: cooldownUntil - now };
  }
  if (cooldownUntil != null && now >= cooldownUntil) {
    cooldowns.delete(key);
  }

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  const limit = LIMITS_PER_MINUTE[params.provider] ?? 60;
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  return { allowed: true };
}

export async function recordProviderUsage(params: {
  provider: ProviderKey;
  userId?: string | null;
  apiKeyFingerprint?: string;
  isPlatformKey: boolean;
}): Promise<void> {
  const key = getKey(params);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
}

/** Call when a 429 is received to trigger cooldown */
export function record429Cooldown(params: {
  provider: ProviderKey;
  userId?: string | null;
  apiKeyFingerprint?: string;
  isPlatformKey: boolean;
}): void {
  const key = getKey(params);
  cooldowns.set(key, Date.now() + COOLDOWN_AFTER_429_MS);
}
