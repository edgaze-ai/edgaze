/**
 * Domain allowlist for HTTP requests. Marketplace safety against data exfil.
 */

import { promises as dnsPromises } from "dns";
import { isIP } from "net";

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
    allowOnly?: string[]; // Comma-separated or array of allowed hosts
    denyHosts?: string[];
    workflowAllowlist?: string[]; // From workflow-level policy
  },
): { allowed: boolean; error?: string } {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();

    const denyHosts = [
      ...DEFAULT_DENY,
      ...(options.denyHosts ?? []).flatMap((h) =>
        h
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean),
      ),
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
      if (a === 172 && b >= 16 && b <= 31)
        return { allowed: false, error: "Access denied: private IP range" };
      if (a === 192 && b === 168)
        return { allowed: false, error: "Access denied: private IP range" };
    }
    if (host.endsWith(".local") || host.endsWith(".internal")) {
      return { allowed: false, error: `Access denied: ${host} is not allowed` };
    }

    const allowOnly = [
      ...(options.allowOnly ?? []).flatMap((h) =>
        h
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean),
      ),
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

// ---------------------------------------------------------------------------
// Post-DNS-resolution SSRF guard (VULN-3: DNS rebinding, VULN-4: alt IP notation)
//
// validateUrlForWorkflow() checks the URL string before DNS resolution which means
// an attacker who controls a domain's DNS can:
//   (a) set A → public IP to pass the hostname check, then flip it to 127.0.0.1
//       before the actual fetch() happens (DNS rebinding)
//   (b) supply hex/decimal/shorthand IP literals that some resolvers expand to
//       private addresses (non-standard notation bypass)
//
// resolveAndValidateHostnameIp() fixes both: it resolves the hostname right now, in
// the same request, and rejects if ANY resolved address falls in a private range.
// Since the resolved addresses are canonical dotted-decimal (IPv4) or colon-hex
// (IPv6) values returned by the OS resolver, alternate notation is never an issue.
// ---------------------------------------------------------------------------

/** Returns true if an IPv4 dotted-decimal address falls in any private/reserved range. */
function isPrivateIpv4(address: string): boolean {
  const m = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 0) return true; // 0.0.0.0/8 — this-host
  if (a === 10) return true; // 10.0.0.0/8 — RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 — CGNAT
  if (a === 127) return true; // 127.0.0.0/8 — loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local / AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 — RFC 1918
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 — RFC 1918
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 — benchmarking
  if (a === 203 && b === 0 && Number(m[3]) === 113) return true; // 203.0.113.0/24 — documentation
  if (a === 240) return true; // 240.0.0.0/4 — reserved
  if (a === 255 && b === 255) return true; // 255.255.255.255/32 — broadcast
  return false;
}

/** Returns true if an IPv6 address falls in a private/reserved range. */
function isPrivateIpv6(address: string): boolean {
  const n = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (n === "::1") return true; // loopback
  if (n === "::") return true; // unspecified
  if (/^fe[89ab][0-9a-f]:/i.test(n)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(n)) return true; // fc00::/7 unique-local
  if (/^::ffff:/i.test(n)) return true; // ::ffff:0:0/96 IPv4-mapped
  if (/^64:ff9b:/i.test(n)) return true; // 64:ff9b::/96 NAT64
  if (/^2001:db8:/i.test(n)) return true; // 2001:db8::/32 documentation
  if (/^(fc|fd)/i.test(n)) return true; // fc00::/7 catch-all
  return false;
}

/**
 * Resolves `hostname` via DNS and checks every returned address against private/reserved
 * IP ranges. Call this immediately before fetch() to close the DNS-rebinding window.
 *
 * - If the hostname is already an IP literal, the DNS step is skipped.
 * - If resolution fails, the request is blocked (fail-safe).
 * - Covers IPv4 (all private RFC ranges) and IPv6 (loopback, link-local, unique-local,
 *   IPv4-mapped, NAT64).
 */
export async function resolveAndValidateHostnameIp(
  hostname: string,
): Promise<{ allowed: boolean; error?: string }> {
  const bare = hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // If it's already an IP literal, validate directly without a DNS round-trip.
  const ipVersion = isIP(bare);
  if (ipVersion === 4) {
    return isPrivateIpv4(bare)
      ? { allowed: false, error: `Access denied: ${bare} is a private/reserved IPv4 address` }
      : { allowed: true };
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(bare)
      ? { allowed: false, error: `Access denied: ${bare} is a private/reserved IPv6 address` }
      : { allowed: true };
  }

  // Hostname — resolve and check every address the OS resolver returns.
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dnsPromises.lookup(hostname, { all: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { allowed: false, error: `DNS resolution failed for ${hostname}: ${msg}` };
  }

  if (addresses.length === 0) {
    return { allowed: false, error: `DNS resolution returned no addresses for ${hostname}` };
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      return {
        allowed: false,
        error: `Access denied: ${hostname} resolves to private IPv4 address ${address}`,
      };
    }
    if (family === 6 && isPrivateIpv6(address)) {
      return {
        allowed: false,
        error: `Access denied: ${hostname} resolves to private IPv6 address ${address}`,
      };
    }
  }

  return { allowed: true };
}

/** Extract allowed domains from workflow/node config for listing page display */
export function getNetworkAccessFromWorkflow(
  nodes: { data?: { specId?: string; config?: Record<string, unknown> } }[],
): {
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
        allowedDomains.push(
          ...allowOnly
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        );
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
  allowedHosts: string[],
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
