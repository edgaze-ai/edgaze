export function extractTrustedClientIp(req: Request): string | null {
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    const value = cfConnectingIp.split(",")[0]?.trim();
    return value || null;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const value = realIp.split(",")[0]?.trim();
    return value || null;
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const value = forwardedFor.split(",")[0]?.trim();
    return value || null;
  }

  return null;
}

export function extractTrustedClientIpOrUnknown(req: Request): string {
  return extractTrustedClientIp(req) ?? "unknown";
}
