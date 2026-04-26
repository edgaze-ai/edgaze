/**
 * Timing-safe cron secret verification.
 *
 * Using `!==` for secret comparison is vulnerable to timing attacks: an attacker
 * can measure response latency to learn the secret byte-by-byte. `timingSafeEqual`
 * from node:crypto guarantees constant-time comparison regardless of content.
 */
import { timingSafeEqual } from "node:crypto";

/**
 * Returns true if the request carries a valid `Authorization: Bearer <CRON_SECRET>` header.
 * Always returns false (never throws) when CRON_SECRET is not configured.
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;

  const expected = `Bearer ${cronSecret}`;
  // Buffers must be the same byte-length for timingSafeEqual; pad to equal length
  // to avoid leaking which side is shorter.
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.alloc(expectedBuf.length);
  Buffer.from(authHeader, "utf8").copy(providedBuf);

  return authHeader.length === expected.length && timingSafeEqual(providedBuf, expectedBuf);
}
