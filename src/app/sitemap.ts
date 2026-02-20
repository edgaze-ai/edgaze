import type { MetadataRoute } from "next";

// Priority map: higher priority = stronger signal to Google for sitelinks
const STATIC_ROUTE_PRIORITIES: Record<string, number> = {
  "/": 1.0,
  "/marketplace": 0.95,
  "/prompt-studio": 0.9,
  "/docs": 0.85,
  "/apply": 0.8,
  "/help": 0.75,
  "/feedback": 0.7,
  "/profile": 0.65,
  "/bugs": 0.5,
};

const STATIC_ROUTES = [
  "/",
  "/marketplace",
  "/prompt-studio",
  "/docs",
  "/apply",
  "/help",
  "/feedback",
  "/profile",
  "/bugs",
] as const;

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXTAUTH_URL;

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

  const dynamic = await safeFetchJson<{ urls: string[] }>(`${base}/api/sitemap`);
  if (!dynamic?.urls?.length) return staticEntries;

  const dynamicEntries: MetadataRoute.Sitemap = dynamic.urls
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
      changeFrequency: "daily",
      priority: 0.85,
    }));

  const seen = new Set<string>();
  return [...staticEntries, ...dynamicEntries].filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}
