// src/app/[ownerHandle]/[edgazeCode]/layout.tsx
import type { Metadata } from "next";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

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
      .select("title, description, thumbnail_url, banner_url")
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
  
  const imageUrl =
    absoluteImageUrl(listing.thumbnail_url) ||
    absoluteImageUrl(listing.banner_url);
  const pageUrl = `${METADATA_BASE}/${ownerHandle}/${edgazeCode}`;

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
      title: `${title} | Edgaze`, // Explicit for OG
      description,
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Edgaze`, // Explicit for Twitter
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default function WorkflowProductLayout({ children }: Props) {
  return <>{children}</>;
}
