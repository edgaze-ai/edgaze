import type { MetadataRoute } from "next";
import { buildCanonicalUrl } from "../lib/seo";
import { getSiteOrigin } from "../lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: "Twitterbot",
        allow: ["/api/og/"],
      },
      {
        userAgent: "*",
        allow: ["/", "/api/og/"],
        disallow: [
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
        ],
      },
    ],
    sitemap: buildCanonicalUrl("/sitemap.xml"),
    host: new URL(base).host,
  };
}
