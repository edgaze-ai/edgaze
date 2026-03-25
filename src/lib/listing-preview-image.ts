/**
 * Resolve listing image URLs for Open Graph embeds, JSON-LD, and /api/og routes.
 * Thumbnail first so link previews match marketplace cards and creator intent.
 */

const DEFAULT_BASE = "https://edgaze.ai";

export function absoluteListingImageUrl(
  url: string | null | undefined,
  baseUrl: string = DEFAULT_BASE,
): string | undefined {
  if (!url || !url.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith("https://")) return u;
  if (u.startsWith("http://")) return `https://${u.slice("http://".length)}`;
  const base = baseUrl.replace(/\/+$/, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

export function firstJsonbImageUrl(arr: unknown): string | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  for (const item of arr) {
    if (typeof item === "string") {
      const s = item.trim();
      if (s) return s;
      continue;
    }
    if (item && typeof item === "object" && "url" in item) {
      const u = (item as { url: unknown }).url;
      if (typeof u === "string" && u.trim()) return u.trim();
    }
  }
  return undefined;
}

export function promptPreviewImageUrl(listing: {
  thumbnail_url: string | null;
  demo_images: unknown;
  output_demo_urls: unknown;
}): string | undefined {
  return (
    absoluteListingImageUrl(listing.thumbnail_url) ??
    absoluteListingImageUrl(firstJsonbImageUrl(listing.demo_images)) ??
    absoluteListingImageUrl(firstJsonbImageUrl(listing.output_demo_urls))
  );
}

export function workflowPreviewImageUrl(listing: {
  thumbnail_url: string | null;
  banner_url: string | null;
  demo_images: unknown;
  output_demo_urls: unknown;
}): string | undefined {
  return (
    absoluteListingImageUrl(listing.thumbnail_url) ??
    absoluteListingImageUrl(listing.banner_url) ??
    absoluteListingImageUrl(firstJsonbImageUrl(listing.demo_images)) ??
    absoluteListingImageUrl(firstJsonbImageUrl(listing.output_demo_urls))
  );
}
