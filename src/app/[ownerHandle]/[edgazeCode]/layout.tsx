// src/app/[ownerHandle]/[edgazeCode]/layout.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getWorkflowRedirectPath } from "@lib/supabase/handle-redirect";

const METADATA_BASE = "https://edgaze.ai";

type Props = {
  params: Promise<{ ownerHandle: string; edgazeCode: string }>;
  children: React.ReactNode;
};

async function getWorkflowListing(ownerHandle: string, edgazeCode: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("workflows")
      .select("title, description, thumbnail_url, banner_url, price_usd, is_paid")
      .eq("owner_handle", ownerHandle)
      .eq("edgaze_code", edgazeCode)
      .eq("is_published", true)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as {
      title: string | null;
      description: string | null;
      thumbnail_url: string | null;
      banner_url: string | null;
      price_usd: number | null;
      is_paid: boolean | null;
    };
    return row;
  } catch {
    return null;
  }
}

function absoluteImageUrl(url: string | null | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = METADATA_BASE.replace(/\/+$/, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ownerHandle, edgazeCode } = await params;
  const listing = await getWorkflowListing(ownerHandle, edgazeCode);

  if (!listing) {
    return {
      title: "Workflow",
      description: "View this AI workflow on Edgaze. Build powerful automation with AI.",
      openGraph: {
        title: "Workflow | Edgaze",
        description: "View this AI workflow on Edgaze. Build powerful automation with AI.",
        url: `${METADATA_BASE}/${ownerHandle}/${edgazeCode}`,
      },
      twitter: {
        card: "summary_large_image",
        title: "Workflow | Edgaze",
        description: "View this AI workflow on Edgaze. Build powerful automation with AI.",
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

  const imageUrl = absoluteImageUrl(listing.thumbnail_url) || absoluteImageUrl(listing.banner_url);
  const pageUrl = `${METADATA_BASE}/${ownerHandle}/${edgazeCode}`;
  const dynamicOgUrl = `${METADATA_BASE}/api/og/workflow?ownerHandle=${encodeURIComponent(ownerHandle)}&edgazeCode=${encodeURIComponent(edgazeCode)}`;
  const ogImages = [
    { url: dynamicOgUrl, width: 1200, height: 630, alt: title },
    ...(imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: title }] : []),
    { url: "/og.png", width: 1200, height: 630, alt: title },
  ].filter((_, i, a) => a.findIndex((x) => x.url === (a[i] as (typeof a)[0]).url) === i);

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
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Edgaze`,
      description,
      images: [dynamicOgUrl, ...(imageUrl ? [imageUrl] : []), "/og.png"].filter(
        (u, i, a) => a.indexOf(u) === i,
      ),
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
    price_usd: number | null;
    is_paid: boolean | null;
  },
): Record<string, unknown> {
  const name = listing.title?.trim() || "Workflow";
  const description =
    listing.description?.trim()?.slice(0, 500) ||
    "Discover and use this AI workflow on Edgaze. Build powerful automation with AI.";
  const imageUrl =
    absoluteImageUrl(listing.thumbnail_url) || absoluteImageUrl(listing.banner_url) || undefined;
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
