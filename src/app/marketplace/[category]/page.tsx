import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";
import MarketplaceCategoryClient from "./MarketplaceCategoryClient";
import { MARKETPLACE_CATEGORIES } from "./categories";

type Props = { params: Promise<{ category: string }> };

const BASE = "https://edgaze.ai";

function categoryTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function generateStaticParams() {
  return MARKETPLACE_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const title = categoryTitle(category);
  const description = `Discover AI workflows and prompts for ${title.toLowerCase()} on Edgaze. Browse and run ${title} automation built by creators.`;

  return {
    title: `${title} | Edgaze Marketplace`,
    description,
    openGraph: {
      title: `${title} | Edgaze Marketplace`,
      description,
      url: `https://edgaze.ai/marketplace/${category}`,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Edgaze Marketplace`,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
  };
}

export default async function MarketplaceCategoryPage({ params }: Props) {
  const { category } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || BASE;
  const title = categoryTitle(category);
  let itemListElement: { "@type": string; position: number; url: string }[] = [];

  try {
    const res = await fetch(
      `${base}/api/marketplace/listings?topic=${encodeURIComponent(category)}&sort=newest`,
      { next: { revalidate: 3600 } },
    );
    const json = (await res.json()) as {
      prompts?: { owner_handle?: string; edgaze_code?: string }[];
      workflows?: { owner_handle?: string; edgaze_code?: string }[];
    };
    const prompts = json.prompts ?? [];
    const workflows = json.workflows ?? [];
    const urls: string[] = [
      ...prompts
        .filter((p) => p.owner_handle && p.edgaze_code)
        .map((p) => `${base}/p/${p.owner_handle}/${p.edgaze_code}`),
      ...workflows
        .filter((w) => w.owner_handle && w.edgaze_code)
        .map((w) => `${base}/${w.owner_handle}/${w.edgaze_code}`),
    ];
    itemListElement = urls.slice(0, 20).map((url, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      url,
    }));
  } catch {
    // leave itemListElement empty
  }

  const collectionPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${title} | Edgaze Marketplace`,
    url: `${base}/marketplace/${category}`,
    description: `Discover AI workflows and prompts for ${title.toLowerCase()} on Edgaze. Browse and run ${title} automation built by creators.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: itemListElement.length,
      itemListElement,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
      />
      <MarketplaceCategoryClient />
    </>
  );
}
