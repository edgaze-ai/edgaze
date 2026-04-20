/** Default meta / Open Graph description for the site (homepage + root tags). */
export const SITE_META_DESCRIPTION =
  "Marketplace is the runtime and distribution layer for AI workflows. Build once, deploy as executable products, and monetize through a global marketplace." as const;

/** Short line under the Edgaze wordmark in the sitewide footer only. */
export const SITE_FOOTER_TAGLINE = "Create, sell, and monetise AI products." as const;

export const GRAD_BORDER = "edge-grad p-[1.5px] rounded-full";
export const SURFACE = "edge-glass";
export const BORDER = "border border-white/12";
export const HOVER = "transition-all duration-300 hover:scale-[1.01] shadow-glow";

/**
 * Show likes and run counts on marketplace, product pages, and public profiles.
 * View counts stay creator-only (per-listing analytics).
 */
export const SHOW_PUBLIC_LIKES_AND_RUNS = true;

/**
 * @deprecated Prefer SHOW_PUBLIC_LIKES_AND_RUNS. Legacy name bundled views + likes;
 * public UI must never show views—only likes/runs when SHOW_PUBLIC_LIKES_AND_RUNS is true.
 */
export const SHOW_VIEWS_AND_LIKES_PUBLICLY = SHOW_PUBLIC_LIKES_AND_RUNS;
