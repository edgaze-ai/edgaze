// src/app/p/[ownerHandle]/[edgazeCode]/layout.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getProductRedirectPath } from "@lib/supabase/handle-redirect";

const METADATA_BASE = "https://edgaze.ai";
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

function absoluteImageUrl(url: string | null | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith("https://")) return u;
  if (u.startsWith("http://")) return `https://${u.slice("http://".length)}`;
  const base = METADATA_BASE.replace(/\/+$/, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

/** Same priority as `PromptProductPage` demo hero: demo → outputs → thumbnail (all typically Supabase storage). */
function firstJsonbImageUrl(arr: unknown): string | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const s = arr[0];
  return typeof s === "string" && s.trim() ? s.trim() : undefined;
}

function promptSocialImageUrl(listing: {
  thumbnail_url: string | null;
  demo_images: unknown;
  output_demo_urls: unknown;
}): string | undefined {
  return (
    absoluteImageUrl(firstJsonbImageUrl(listing.demo_images)) ??
    absoluteImageUrl(firstJsonbImageUrl(listing.output_demo_urls)) ??
    absoluteImageUrl(listing.thumbnail_url)
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ownerHandle, edgazeCode } = await params;
  const listing = await getListing(ownerHandle, edgazeCode);

  const fallbackOg = `${METADATA_BASE}/og.png`;

  if (!listing) {
    return {
      title: "Product",
      description: "View this prompt or workflow on Edgaze",
      openGraph: {
        title: "Product | Edgaze",
        description: "View this prompt or workflow on Edgaze",
        url: `${METADATA_BASE}/p/${ownerHandle}/${edgazeCode}`,
        images: [
          { url: fallbackOg, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: "Edgaze" },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Product | Edgaze",
        description: "View this prompt or workflow on Edgaze",
        images: fallbackOg,
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

  const imageUrl = promptSocialImageUrl(listing);
  const pageUrl = `${METADATA_BASE}/p/${ownerHandle}/${edgazeCode}`;
  // Exactly one preview image: Supabase public URL when present (no second og.png — scrapers disagree on multi-value tags).
  const primaryOg = imageUrl
    ? { url: imageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: title }
    : { url: fallbackOg, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: title };
  const twitterImage: string = imageUrl ?? fallbackOg;

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
      images: twitterImage,
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
  const imageUrl = promptSocialImageUrl(listing);
  const price =
    listing.is_paid && listing.price_usd != null && listing.price_usd > 0
      ? String(listing.price_usd)
      : "0";
  const pageUrl = `${METADATA_BASE}/p/${ownerHandle}/${edgazeCode}`;

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
