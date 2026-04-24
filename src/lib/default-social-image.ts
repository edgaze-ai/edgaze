import { getSiteOrigin } from "./site-origin";

/**
 * Default Open Graph / Twitter image for all non–product pages (landing, app shells, docs, etc.).
 * Product routes override with `/api/og/...`-generated artwork.
 *
 * Canonical file: `public/og.png`.
 * Legacy alias `public/og2.png` remains available so old crawler caches do not break.
 */
export const DEFAULT_SOCIAL_IMAGE_PATH = "/og.png" as const;

/**
 * Bump when replacing the default asset so crawlers that cache aggressively (especially X)
 * fetch the new image URL.
 * WhatsApp/Meta often refresh sooner; X can keep showing an old `twitter:image` until the URL changes.
 */
const DEFAULT_SOCIAL_IMAGE_V = "3" as const;

export const DEFAULT_SOCIAL_IMAGE = {
  url: `${DEFAULT_SOCIAL_IMAGE_PATH}?v=${DEFAULT_SOCIAL_IMAGE_V}`,
  width: 1200,
  height: 630,
  alt: "Edgaze",
} as const;

/** Absolute URL for legacy `<meta>` tags (`head.tsx`). */
export function defaultSocialImageAbsoluteUrl(): string {
  return `${getSiteOrigin()}${DEFAULT_SOCIAL_IMAGE_PATH}?v=${DEFAULT_SOCIAL_IMAGE_V}`;
}
