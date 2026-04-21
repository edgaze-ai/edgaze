import { extractTrustedClientIpOrUnknown } from "@lib/request-client-ip";

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

function prune(now: number, windowMs: number, timestamps: number[]) {
  const cutoff = now - windowMs;
  return timestamps.filter((timestamp) => timestamp > cutoff);
}

function checkBucket(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  const active = prune(now, windowMs, bucket.timestamps);
  if (active.length >= limit) {
    buckets.set(key, { timestamps: active });
    return false;
  }
  active.push(now);
  buckets.set(key, { timestamps: active });
  return true;
}

export function checkWorkflowDemoRateLimit(params: {
  req: Request;
  workflowId: string;
  deviceFingerprint?: string | null;
  kind: "preflight" | "consume" | "resolve";
}): boolean {
  const { req, workflowId, deviceFingerprint, kind } = params;
  const ip = extractTrustedClientIpOrUnknown(req);
  const fingerprint = typeof deviceFingerprint === "string" ? deviceFingerprint.trim() : "";

  const ipLimit = kind === "consume" ? 12 : 30;
  const fingerprintLimit = kind === "consume" ? 8 : 20;
  const windowMs = 5 * 60 * 1000;

  const ipAllowed = checkBucket(`workflow-demo:${kind}:ip:${workflowId}:${ip}`, ipLimit, windowMs);
  if (!ipAllowed) return false;

  if (fingerprint.length >= 10) {
    return checkBucket(
      `workflow-demo:${kind}:fp:${workflowId}:${fingerprint}`,
      fingerprintLimit,
      windowMs,
    );
  }

  return true;
}
