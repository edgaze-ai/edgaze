import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Social in-app browsers (e.g. X/Twitter on iOS) may present external links inside a nested
 * browsing context. A blanket `X-Frame-Options: SAMEORIGIN` blocks that and can surface as a
 * generic “page couldn’t load” while the same URL works in a full browser tab.
 *
 * We omit that header globally and instead deny framing only for authenticated / creator areas
 * via CSP `frame-ancestors` (stricter and easier to scope than XFO).
 */
const FRAME_DENY_PREFIXES = [
  "/admin",
  "/dashboard",
  "/library",
  "/builder",
  "/auth",
  "/settings",
  "/onboarding",
  "/creators/onboarding",
  "/claim",
  "/store",
  "/checkout",
  "/c/",
  "/prompt-studio",
] as const;

function isProtectedPath(pathname: string): boolean {
  for (const prefix of FRAME_DENY_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  if (isProtectedPath(request.nextUrl.pathname)) {
    res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|woff2?)$).*)",
  ],
};
