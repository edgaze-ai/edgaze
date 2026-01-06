import type { MetadataRoute } from "next";

const STATIC_ROUTES = [
  "/",
  "/apply",
  "/bugs",
  "/docs",
  "/feedback",
  "/help",
  "/marketplace",
  "/profile",
  "/prompt-studio",
] as const;

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXTAUTH_URL;

  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function safeFetchJson<T>(url: string, timeoutMs = 3000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 1800 }, // 30 min
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
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const dynamic = await safeFetchJson<{ urls: string[] }>(`${base}/api/sitemap`);

  if (!dynamic?.urls?.length) return staticEntries;

  const dynamicEntries: MetadataRoute.Sitemap = dynamic.urls
    .filter(Boolean)
    .map((url) => ({
      url,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    }));

  // de-dupe
  const seen = new Set<string>();
  return [...staticEntries, ...dynamicEntries].filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}
