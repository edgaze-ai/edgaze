// src/app/p/[ownerHandle]/[edgazeCode]/layout.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { promptPreviewImageUrl } from "@lib/listing-preview-image";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getProductRedirectPath } from "@lib/supabase/handle-redirect";
import { getSiteOrigin } from "@lib/site-origin";

/** Open Graph / Twitter hint dimensions (recommended for link previews; actual asset may differ). */
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

type Props = {
  params: Promise<{ ownerHandle: string; edgazeCode: string }>;
  children: React.ReactNode;
};

async function getListing(ownerHandle: string, edgazeCode: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("prompts")
      .select(
        "title, description, thumbnail_url, demo_images, output_demo_urls, type, price_usd, is_paid",
      )
      .eq("owner_handle", ownerHandle)
      .eq("edgaze_code", edgazeCode)
      .is("removed_at", null)
      .in("visibility", ["public", "unlisted"])
      .maybeSingle();

    if (error || !data) return null;
    return data as {
      title: string | null;
      description: string | null;
      thumbnail_url: string | null;
      demo_images: unknown;
      output_demo_urls: unknown;
      type: string | null;
      price_usd: number | null;
      is_paid: boolean | null;
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ownerHandle, edgazeCode } = await params;
  const listing = await getListing(ownerHandle, edgazeCode);
  const siteOrigin = getSiteOrigin();

  const fallbackOg = "/og.png";

  if (!listing) {
    return {
      title: "Product",
      description: "View this prompt or workflow on Edgaze",
      openGraph: {
        title: "Product | Edgaze",
        description: "View this prompt or workflow on Edgaze",
        url: `${siteOrigin}/p/${ownerHandle}/${edgazeCode}`,
        images: [
          { url: fallbackOg, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: "Edgaze" },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Product | Edgaze",
        description: "View this prompt or workflow on Edgaze",
        images: [
          {
            url: fallbackOg,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            alt: "Edgaze",
          },
        ],
      },
    };
  }

  // Use title as-is (root layout template will add "| Edgaze")
  const title = listing.title?.trim() || (listing.type === "workflow" ? "Workflow" : "Prompt");
  // Optimize description for SEO (150-160 chars is ideal, max 160)
  const rawDescription = listing.description?.trim() || "";
  const description =
    rawDescription.length > 0
      ? rawDescription.slice(0, 160).replace(/\s+$/, "") // Trim trailing whitespace
      : listing.type === "workflow"
        ? "Discover and use this AI workflow on Edgaze. Build powerful automation with AI."
        : "Discover and use this AI prompt on Edgaze. Create amazing content with AI.";

  const pageUrl = `${siteOrigin}/p/${ownerHandle}/${edgazeCode}`;
  // Relative image URL resolves with root metadataBase (same host as shared links, e.g. www) so Meta gets og:image + dimensions without apex↔www redirects.
  const dynamicOgPath = `/api/og/prompt?${new URLSearchParams({ ownerHandle, edgazeCode }).toString()}`;
  const primaryOg = {
    url: dynamicOgPath,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: title,
  };

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "Edgaze",
      title: `${title} | Edgaze`,
      description,
      images: [primaryOg],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Edgaze`,
      description,
      images: [primaryOg],
    },
  };
}

function buildPromptProductJsonLd(
  ownerHandle: string,
  edgazeCode: string,
  listing: {
    title: string | null;
    description: string | null;
    thumbnail_url: string | null;
    demo_images: unknown;
    output_demo_urls: unknown;
    type: string | null;
    price_usd: number | null;
    is_paid: boolean | null;
  },
): Record<string, unknown> {
  const name = listing.title?.trim() || (listing.type === "workflow" ? "Workflow" : "Prompt");
  const description =
    listing.description?.trim()?.slice(0, 500) ||
    (listing.type === "workflow"
      ? "Discover and use this AI workflow on Edgaze. Build powerful automation with AI."
      : "Discover and use this AI prompt on Edgaze. Create amazing content with AI.");
  const imageUrl = promptPreviewImageUrl(listing);
  const price =
    listing.is_paid && listing.price_usd != null && listing.price_usd > 0
      ? String(listing.price_usd)
      : "0";
  const pageUrl = `${getSiteOrigin()}/p/${ownerHandle}/${edgazeCode}`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    ...(imageUrl && { image: imageUrl }),
    url: pageUrl,
    brand: { "@type": "Brand", name: "Edgaze" },
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: pageUrl,
    },
  };
}

export default async function ProductLayout({ children, params }: Props) {
  const { ownerHandle, edgazeCode } = await params;
  const listing = await getListing(ownerHandle, edgazeCode);
  if (!listing) {
    const redirectPath = await getProductRedirectPath(ownerHandle, edgazeCode);
    if (redirectPath) redirect(redirectPath);
  }

  const productJsonLd =
    listing != null ? buildPromptProductJsonLd(ownerHandle, edgazeCode, listing) : null;

  return (
    <>
      {productJsonLd != null && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      {children}
    </>
  );
}
