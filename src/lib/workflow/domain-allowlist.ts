/**
 * Domain allowlist for HTTP requests. Marketplace safety against data exfil.
 */

const DEFAULT_DENY = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "169.254.169.254",
  "metadata.google.internal",
  "metadata",
];

export function validateUrlForWorkflow(
  url: string,
  options: {
    allowOnly?: string[];  // Comma-separated or array of allowed hosts
    denyHosts?: string[];
    workflowAllowlist?: string[];  // From workflow-level policy
  }
): { allowed: boolean; error?: string } {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();

    const denyHosts = [
      ...DEFAULT_DENY,
      ...(options.denyHosts ?? []).flatMap((h) => h.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)),
    ];
    if (denyHosts.includes(host)) {
      return { allowed: false, error: `Access denied: ${host} is not allowed` };
    }

    // Block private IP ranges
    const ipMatch = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const a = Number(ipMatch[1]);
      const b = Number(ipMatch[2]);
      if (a === 10) return { allowed: false, error: "Access denied: private IP range" };
      if (a === 172 && b >= 16 && b <= 31) return { allowed: false, error: "Access denied: private IP range" };
      if (a === 192 && b === 168) return { allowed: false, error: "Access denied: private IP range" };
    }
    if (host.endsWith(".local") || host.endsWith(".internal")) {
      return { allowed: false, error: `Access denied: ${host} is not allowed` };
    }

    const allowOnly = [
      ...(options.allowOnly ?? []).flatMap((h) => h.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)),
      ...(options.workflowAllowlist ?? []).map((h) => h.trim().toLowerCase()).filter(Boolean),
    ];
    if (allowOnly.length > 0 && !allowOnly.includes(host)) {
      return { allowed: false, error: `Access denied: ${host} is not in the allow list` };
    }

    return { allowed: true };
  } catch (e: unknown) {
    return { allowed: false, error: `Invalid URL: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Extract allowed domains from workflow/node config for listing page display */
export function getNetworkAccessFromWorkflow(nodes: { data?: { specId?: string; config?: Record<string, unknown> } }[]): {
  hasHttpRequest: boolean;
  allowedDomains: string[];
} {
  const allowedDomains: string[] = [];
  let hasHttpRequest = false;
  for (const node of nodes) {
    if (node.data?.specId === "http-request") {
      hasHttpRequest = true;
      const allowOnly = node.data?.config?.allowOnly;
      if (typeof allowOnly === "string") {
        allowedDomains.push(...allowOnly.split(",").map((x) => x.trim()).filter(Boolean));
      } else if (Array.isArray(allowOnly)) {
        allowedDomains.push(...allowOnly.map((x) => String(x).trim()).filter(Boolean));
      }
    }
  }
  return { hasHttpRequest, allowedDomains: [...new Set(allowedDomains)] };
}

/** Headers that must not be passed from workflow (exfil risk: user context, session) */
export const STRIP_OUTGOING_HEADERS = new Set([
  "cookie",
  "cookie2",
  "origin",
  "referer",
  "host",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-real-ip",
  "cf-connecting-ip",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
]);

export function stripSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (STRIP_OUTGOING_HEADERS.has(lower)) continue;
    out[k] = v;
  }
  return out;
}

export const MAX_HTTP_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_HTTP_RESPONSE_BYTES_MARKETPLACE = 2 * 1024 * 1024; // 2MB for marketplace runs
export const MAX_JSON_DEPTH = 32;
export const MAX_STRING_LENGTH = 1024 * 1024; // 1MB for parsed string values

/** Validate redirect Location URL against allowed hosts before following */
export function validateRedirectUrl(
  url: string,
  allowedHosts: string[]
): { allowed: boolean; error?: string } {
  return validateUrlForWorkflow(url, {
    allowOnly: allowedHosts,
  });
}

/** Check if JSON value exceeds max depth */
export function exceedsJsonDepth(val: unknown, maxDepth: number, current = 0): boolean {
  if (current >= maxDepth) return true;
  if (val === null || typeof val !== "object") return false;
  for (const v of Object.values(val)) {
    if (exceedsJsonDepth(v, maxDepth, current + 1)) return true;
  }
  return false;
}
