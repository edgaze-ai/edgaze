import { getSiteOrigin } from "./site-origin";

/**
 * Default Open Graph / Twitter image for all non–product pages (landing, app shells, docs, etc.).
 * Product routes override with `/api/og/...`-generated artwork.
 *
 * File: `public/og2.png` (1200×630 recommended for WhatsApp, Instagram, Facebook, X).
 */
export const DEFAULT_SOCIAL_IMAGE_PATH = "/og2.png" as const;

/**
 * Bump when replacing `og2.png` so crawlers that cache aggressively (especially X) fetch the new asset.
 * WhatsApp/Meta often refresh sooner; X can keep showing an old `twitter:image` until the URL changes.
 */
const DEFAULT_SOCIAL_IMAGE_V = "2" as const;

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
