/**
 * Resolve listing image URLs for Open Graph embeds, JSON-LD, and /api/og routes.
 * Thumbnail first so link previews match marketplace cards and creator intent.
 */

import { getSiteOrigin } from "./site-origin";

export function absoluteListingImageUrl(
  url: string | null | undefined,
  baseUrl: string = getSiteOrigin(),
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

function stableUrlVersion(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function listingSocialImageVersion(listing: {
  thumbnail_url: string | null;
  banner_url?: string | null;
  demo_images: unknown;
  output_demo_urls: unknown;
  updated_at?: string | null;
}): string {
  const imageUrl =
    absoluteListingImageUrl(listing.thumbnail_url) ??
    absoluteListingImageUrl(listing.banner_url) ??
    absoluteListingImageUrl(firstJsonbImageUrl(listing.demo_images)) ??
    absoluteListingImageUrl(firstJsonbImageUrl(listing.output_demo_urls)) ??
    "";
  const updatedAt = listing.updated_at?.trim() || "";
  const updatedMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  const updatedVersion = Number.isFinite(updatedMs)
    ? String(updatedMs)
    : stableUrlVersion(updatedAt);

  return [updatedVersion, stableUrlVersion(imageUrl)].filter(Boolean).join("-");
}

function buildListingOgImageUrl(
  routePath: "/api/og/prompt" | "/api/og/workflow",
  ownerHandle: string,
  edgazeCode: string,
  listing: {
    thumbnail_url: string | null;
    banner_url?: string | null;
    demo_images: unknown;
    output_demo_urls: unknown;
    updated_at?: string | null;
  },
  baseUrl: string = getSiteOrigin(),
): string {
  const url = new URL(routePath, baseUrl);
  url.searchParams.set("ownerHandle", ownerHandle);
  url.searchParams.set("edgazeCode", edgazeCode);
  url.searchParams.set("v", listingSocialImageVersion(listing));
  return url.toString();
}

export function promptOgImageUrl(
  ownerHandle: string,
  edgazeCode: string,
  listing: {
    thumbnail_url: string | null;
    demo_images: unknown;
    output_demo_urls: unknown;
    updated_at?: string | null;
  },
  baseUrl: string = getSiteOrigin(),
): string {
  return buildListingOgImageUrl("/api/og/prompt", ownerHandle, edgazeCode, listing, baseUrl);
}

export function workflowOgImageUrl(
  ownerHandle: string,
  edgazeCode: string,
  listing: {
    thumbnail_url: string | null;
    banner_url: string | null;
    demo_images: unknown;
    output_demo_urls: unknown;
    updated_at?: string | null;
  },
  baseUrl: string = getSiteOrigin(),
): string {
  return buildListingOgImageUrl("/api/og/workflow", ownerHandle, edgazeCode, listing, baseUrl);
}
