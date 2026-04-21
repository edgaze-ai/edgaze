import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { MARKETPLACE_CATEGORIES } from "./categories";
import { buildCanonicalUrl, buildMetadata, NOINDEX_ROBOTS } from "../../../lib/seo";

type Props = { params: Promise<{ category: string }> };

function isMarketplaceCategory(
  category: string,
): category is (typeof MARKETPLACE_CATEGORIES)[number] {
  return MARKETPLACE_CATEGORIES.includes(category as (typeof MARKETPLACE_CATEGORIES)[number]);
}

function categoryTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function marketplaceTopicUrl(category: string) {
  return `${buildCanonicalUrl("/marketplace")}?topic=${encodeURIComponent(category)}`;
}

export function generateStaticParams() {
  return MARKETPLACE_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isMarketplaceCategory(category)) {
    return buildMetadata({
      title: "Marketplace | Edgaze",
      description: "Browse workflow categories in the Edgaze marketplace.",
      path: "/marketplace",
      robots: NOINDEX_ROBOTS,
    });
  }
  const title = `${categoryTitle(category)} Workflows | Edgaze Marketplace`;
  const description = `Browse ${categoryTitle(category).toLowerCase()} workflows and prompts in the Edgaze marketplace.`;
  const canonical = marketplaceTopicUrl(category);

  const metadata = buildMetadata({
    title,
    description,
    path: `/marketplace/${category}`,
    robots: NOINDEX_ROBOTS,
  });

  return {
    ...metadata,
    alternates: {
      canonical,
    },
    openGraph: {
      ...metadata.openGraph,
      url: canonical,
    },
  };
}

export default async function MarketplaceCategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isMarketplaceCategory(category)) {
    permanentRedirect("/marketplace");
  }
  permanentRedirect(marketplaceTopicUrl(category));
}
