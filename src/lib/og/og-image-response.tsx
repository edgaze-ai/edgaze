import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { resolveTrustedUrl } from "@/lib/security/url-policy";
import { ListingOgCard, type ListingOgCardProps } from "./listing-og-card";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export function ogImageResponseInit(): {
  width: number;
  height: number;
  headers: Record<string, string>;
} {
  return {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  };
}

/** Probes URL so we only pass images into Satori that are likely to decode (fail-soft). */
/** Reads `public/brand/edgaze-mark.png` for OG cards (Satori-compatible data URL). */
export async function loadBrandMarkDataUrl(): Promise<string | undefined> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public/brand/edgaze-mark.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function remoteImageLikelyRenderable(url: string): Promise<boolean> {
  try {
    let currentUrl = url;
    let r: Response | null = null;

    for (let i = 0; i < 4; i += 1) {
      const trustedUrl = resolveTrustedUrl(currentUrl, {
        allowedProtocols: ["https:", "http:"],
        allowLocalhost: false,
        allowPrivateIpv4: false,
      });
      if (!trustedUrl) return false;

      r = await fetch(trustedUrl, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "image/*,*/*;q=0.8" },
      });

      if (![301, 302, 303, 307, 308].includes(r.status)) break;
      const location = r.headers.get("location");
      if (!location) return false;
      currentUrl = new URL(location, trustedUrl).toString();
    }

    if (!r) return false;
    if (!r.ok) return false;
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.startsWith("image/")) return false;
    if (ct.includes("svg")) return false;
    return true;
  } catch {
    return false;
  }
}

export function imageResponseFromListingCard(props: ListingOgCardProps): ImageResponse {
  return new ImageResponse(<ListingOgCard {...props} />, ogImageResponseInit());
}

export function imageResponseFromElement(element: ReactElement): ImageResponse {
  return new ImageResponse(element, ogImageResponseInit());
}

export function minimalBrandedListingCard(brandMarkSrc?: string | null): ReactElement {
  return (
    <ListingOgCard
      title="Edgaze"
      creatorName="edgaze.ai"
      priceLabel="Free"
      imageUrl={undefined}
      brandMarkSrc={brandMarkSrc}
    />
  );
}
