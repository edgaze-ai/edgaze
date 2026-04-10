import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Only block stuff that should never be indexed
          "/api/",
          "/admin/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
