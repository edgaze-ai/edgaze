import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://edgaze.ai";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",          // homepage
          "/p/",        // prompt pages
          // workflows are under /[ownerHandle]/... -> allow all, but block admin/private below
        ],
        disallow: [
          "/admin/",
          "/api/",
          "/auth/",
          "/banned/",
          "/forbidden/",
          "/settings/",
          "/library/",
          "/builder/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
