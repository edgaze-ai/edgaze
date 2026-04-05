/**
 * Canonical origin for metadata, Open Graph, JSON-LD, and absolute listing image URLs.
 *
 * Default production value is https://www.edgaze.ai so og:url matches typical shared links
 * and avoids apex↔www redirects that confuse Meta’s crawler (WhatsApp / Instagram / Facebook).
 *
 * Override with NEXT_PUBLIC_SITE_URL when needed (e.g. preview deployments).
 */
export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* ignore invalid */
    }
  }

  if (process.env.NODE_ENV === "development") {
    const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (app) {
      try {
        return new URL(app).origin;
      } catch {
        /* ignore */
      }
    }
    return "http://localhost:3000";
  }

  return "https://www.edgaze.ai";
}
