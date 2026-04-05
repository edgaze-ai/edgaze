/**
 * Compare a demo token from the URL to the stored listing token (handles trimming / decode edge cases).
 */
function tokenVariants(value: string): string[] {
  const out = new Set<string>([value]);
  try {
    const d = decodeURIComponent(value);
    if (d !== value) out.add(d);
  } catch {
    /* ignore */
  }
  return [...out];
}

export function demoTokensEqual(
  urlParam: string | null | undefined,
  stored: string | null | undefined,
): boolean {
  const a = String(urlParam ?? "").trim();
  const b = String(stored ?? "").trim();
  if (!a || !b) return false;
  const av = tokenVariants(a);
  const bv = tokenVariants(b);
  return av.some((x) => bv.includes(x));
}
