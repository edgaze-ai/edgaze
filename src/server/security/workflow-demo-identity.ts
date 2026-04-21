import { createHash } from "node:crypto";

export const WORKFLOW_DEMO_FINGERPRINT_MIN_LENGTH = 10;
export const WORKFLOW_DEMO_FINGERPRINT_MAX_LENGTH = 160;

const WORKFLOW_DEMO_FINGERPRINT_PATTERN = /^fp_[a-z0-9]+(?:_[a-z0-9]+)+$/i;

export function normalizeWorkflowDemoFingerprint(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length < WORKFLOW_DEMO_FINGERPRINT_MIN_LENGTH ||
    normalized.length > WORKFLOW_DEMO_FINGERPRINT_MAX_LENGTH
  ) {
    return null;
  }

  if (!WORKFLOW_DEMO_FINGERPRINT_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function getWorkflowDemoUserAgent(req: Request) {
  return req.headers.get("user-agent")?.trim() || "";
}

export function hashWorkflowDemoIpAddress(ipAddress: string) {
  return createHash("sha256").update(ipAddress.trim()).digest("base64url");
}
