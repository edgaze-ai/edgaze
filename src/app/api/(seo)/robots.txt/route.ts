import { buildCanonicalUrl } from "../../../../lib/seo";

export const dynamic = "force-static";

const DISALLOWED_PATHS = [
  "/api/",
  "/admin/",
  "/dashboard/",
  "/settings/",
  "/auth/",
  "/checkout/",
  "/claim/",
  "/onboarding/",
  "/library",
  "/profile",
  "/feedback",
  "/bugs",
  "/apply",
  "/store/",
];

export function GET() {
  const rules = [
    "User-agent: Twitterbot",
    "Allow: /api/og/",
    "",
    "User-agent: *",
    "Allow: /",
    "Allow: /api/og/",
    ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
  ];

  return new Response(`${rules.join("\n")}\nSitemap: ${buildCanonicalUrl("/sitemap.xml")}\n`, {
    headers: { "Content-Type": "text/plain" },
  });
}
