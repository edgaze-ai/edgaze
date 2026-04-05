import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
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
export async function remoteImageLikelyRenderable(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
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

export function minimalBrandedListingCard(): ReactElement {
  return (
    <ListingOgCard title="Edgaze" creatorName="edgaze.ai" priceLabel="Free" imageUrl={undefined} />
  );
}
