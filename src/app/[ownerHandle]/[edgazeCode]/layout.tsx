// src/app/[ownerHandle]/[edgazeCode]/layout.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { workflowPreviewImageUrl } from "@lib/listing-preview-image";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getWorkflowRedirectPath } from "@lib/supabase/handle-redirect";

const METADATA_BASE = "https://edgaze.ai";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

type Props = {
  params: Promise<{ ownerHandle: string; edgazeCode: string }>;
  children: React.ReactNode;
};

async function getWorkflowListing(ownerHandle: string, edgazeCode: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("workflows")
      .select(
        "title, description, thumbnail_url, banner_url, demo_images, output_demo_urls, price_usd, is_paid",
      )
      .eq("owner_handle", ownerHandle)
      .eq("edgaze_code", edgazeCode)
      .eq("is_published", true)
      .is("removed_at", null)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as {
      title: string | null;
      description: string | null;
      thumbnail_url: string | null;
      banner_url: string | null;
      demo_images: unknown;
      output_demo_urls: unknown;
      price_usd: number | null;
      is_paid: boolean | null;
    };
    return row;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ownerHandle, edgazeCode } = await params;
  const listing = await getWorkflowListing(ownerHandle, edgazeCode);
  const fallbackOg = `${METADATA_BASE}/og.png`;

  if (!listing) {
    return {
      title: "Workflow",
      description: "View this AI workflow on Edgaze. Build powerful automation with AI.",
      openGraph: {
        title: "Workflow | Edgaze",
        description: "View this AI workflow on Edgaze. Build powerful automation with AI.",
        url: `${METADATA_BASE}/${ownerHandle}/${edgazeCode}`,
        images: [
          { url: fallbackOg, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: "Edgaze" },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Workflow | Edgaze",
        description: "View this AI workflow on Edgaze. Build powerful automation with AI.",
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
  const title = listing.title?.trim() || "Workflow";
  // Optimize description for SEO (150-160 chars is ideal, max 160)
  const rawDescription = listing.description?.trim() || "";
  const description =
    rawDescription.length > 0
      ? rawDescription.slice(0, 160).replace(/\s+$/, "") // Trim trailing whitespace
      : "Discover and use this AI workflow on Edgaze. Build powerful automation with AI.";

  const pageUrl = `${METADATA_BASE}/${ownerHandle}/${edgazeCode}`;
  const dynamicOg = `${METADATA_BASE}/api/og/workflow?${new URLSearchParams({ ownerHandle, edgazeCode }).toString()}`;
  const primaryOg = {
    url: dynamicOg,
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

function buildWorkflowProductJsonLd(
  ownerHandle: string,
  edgazeCode: string,
  listing: {
    title: string | null;
    description: string | null;
    thumbnail_url: string | null;
    banner_url: string | null;
    demo_images: unknown;
    output_demo_urls: unknown;
    price_usd: number | null;
    is_paid: boolean | null;
  },
): Record<string, unknown> {
  const name = listing.title?.trim() || "Workflow";
  const description =
    listing.description?.trim()?.slice(0, 500) ||
    "Discover and use this AI workflow on Edgaze. Build powerful automation with AI.";
  const imageUrl = workflowPreviewImageUrl(listing);
  const price =
    listing.is_paid && listing.price_usd != null && listing.price_usd > 0
      ? String(listing.price_usd)
      : "0";
  const pageUrl = `${METADATA_BASE}/${ownerHandle}/${edgazeCode}`;

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

export default async function WorkflowProductLayout({ children, params }: Props) {
  const { ownerHandle, edgazeCode } = await params;
  const listing = await getWorkflowListing(ownerHandle, edgazeCode);
  if (!listing) {
    const redirectPath = await getWorkflowRedirectPath(ownerHandle, edgazeCode);
    if (redirectPath) redirect(redirectPath);
  }

  const productJsonLd =
    listing != null ? buildWorkflowProductJsonLd(ownerHandle, edgazeCode, listing) : null;

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
