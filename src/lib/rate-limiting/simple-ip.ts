/**
 * Simple in-memory rate limiter for IP-based endpoints.
 * Effective within a single serverless instance (warm invocations).
 * For production at scale, consider Redis/Upstash.
 */

const store = new Map<string, number[]>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // per window
const CLEANUP_INTERVAL = 60_000; // clean old entries every minute

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - WINDOW_MS;
  for (const [key, times] of store.entries()) {
    const filtered = times.filter((t) => t > cutoff);
    if (filtered.length === 0) store.delete(key);
    else store.set(key, filtered);
  }
}

function getIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.split(",")[0]?.trim() ?? "unknown";
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function checkSimpleIpRateLimit(req: Request): { allowed: boolean } {
  cleanup();
  const ip = getIp(req);
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const times = store.get(ip) ?? [];
  const recent = times.filter((t) => t > cutoff);
  if (recent.length >= MAX_REQUESTS) {
    return { allowed: false };
  }
  recent.push(now);
  store.set(ip, recent);
  return { allowed: true };
}
