import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://edgaze.ai";

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
