import type { MetadataRoute } from "next";
import { getAllDocs } from "./docs/utils/docs";
import { getAllBlogs } from "./blogs/utils/blogs";
import { MARKETPLACE_CATEGORIES } from "./marketplace/[category]/categories";

// Priority map: higher priority = stronger signal to Google for sitelinks
const STATIC_ROUTE_PRIORITIES: Record<string, number> = {
  "/": 1.0,
  "/marketplace": 0.95,
  "/prompt-studio": 0.9,
  "/library": 0.9,
  "/docs": 0.85,
  "/creators": 0.85,
  "/apply": 0.8,
  "/help": 0.75,
  "/feedback": 0.7,
  "/bugs": 0.5,
  "/pricing": 0.85,
  "/about": 0.85,
  "/blogs": 0.85,
  "/careers": 0.8,
  "/press": 0.8,
  "/contact": 0.8,
  "/builder": 0.8,
};

const STATIC_ROUTES = [
  "/",
  "/marketplace",
  "/prompt-studio",
  "/library",
  "/docs",
  "/creators",
  "/apply",
  "/help",
  "/feedback",
  "/bugs",
  "/pricing",
  "/about",
  "/blogs",
  "/careers",
  "/press",
  "/contact",
  "/builder",
] as const;

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXTAUTH_URL;

  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://edgaze.ai";
}

async function safeFetchJson<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 1800 }, // 30 min
      headers: { Accept: "application/json" },
    });

    clearTimeout(t);

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" || path === "/marketplace" ? "daily" : "weekly",
    priority: STATIC_ROUTE_PRIORITIES[path] ?? 0.6,
  }));

  // Marketplace category landing pages
  const categoryEntries: MetadataRoute.Sitemap = MARKETPLACE_CATEGORIES.map((category) => ({
    url: `${base}/marketplace/${category}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.88,
  }));

  // Docs: /docs/<slug> and /docs/builder/<subslug>
  const docs = getAllDocs();
  const docsEntries: MetadataRoute.Sitemap = docs.map((doc) => {
    const pathSegment = doc.slug.startsWith("builder/")
      ? `builder/${doc.slug.slice("builder/".length)}`
      : doc.slug;
    return {
      url: `${base}/docs/${pathSegment}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    };
  });

  // Blogs: /blogs and /blogs/<slug>
  const blogs = getAllBlogs();
  const blogListEntry: MetadataRoute.Sitemap = [
    { url: `${base}/blogs`, lastModified: now, changeFrequency: "weekly", priority: 0.82 },
  ];
  const blogSlugEntries: MetadataRoute.Sitemap = blogs.map((b) => ({
    url: `${base}/blogs/${b.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Dynamic product URLs from API
  const dynamic = await safeFetchJson<{ urls: string[] }>(`${base}/api/sitemap`);
  const dynamicEntries: MetadataRoute.Sitemap =
    (dynamic?.urls?.length ?? 0) > 0
      ? (dynamic!.urls as string[])
          .map((u) => (typeof u === "string" ? u.trim() : ""))
          .filter(Boolean)
          .map((u) =>
            u.startsWith("http://") || u.startsWith("https://")
              ? u
              : `${base}${u.startsWith("/") ? "" : "/"}${u}`,
          )
          .map((url) => ({
            url,
            lastModified: now,
            changeFrequency: "daily" as const,
            priority: 0.85,
          }))
      : [];

  const seen = new Set<string>();
  const all = [
    ...staticEntries,
    ...categoryEntries,
    ...docsEntries,
    ...blogListEntry,
    ...blogSlugEntries,
    ...dynamicEntries,
  ].filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });

  return all;
}
