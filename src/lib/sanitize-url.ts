/**
 * Server-side URL sanitization for user-provided links.
 * Only allows http and https protocols to prevent javascript:, data:, etc.
 */

const MAX_URL_LENGTH = 2000;

/**
 * Sanitize a URL for safe storage and display.
 * Returns the URL if valid (http/https), or null if invalid/dangerous.
 */
export function sanitizeUrl(url: unknown): string | null {
  if (url == null || typeof url !== "string") return null;
  const v = url.trim();
  if (!v || v.length > MAX_URL_LENGTH) return null;
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize a socials object (key -> URL). Returns only valid http/https URLs.
 */
export function sanitizeSocials(socials: unknown): Record<string, string> | null {
  if (socials == null || typeof socials !== "object" || Array.isArray(socials)) return null;
  const result: Record<string, string> = {};
  const MAX_KEYS = 12;
  const KEY_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;
  let count = 0;
  for (const [k, v] of Object.entries(socials)) {
    if (count >= MAX_KEYS) break;
    if (typeof k !== "string" || !KEY_PATTERN.test(k)) continue;
    const sanitized = sanitizeUrl(v);
    if (sanitized) {
      result[k] = sanitized;
      count++;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}
