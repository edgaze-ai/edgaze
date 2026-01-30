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
      title: "Edgaze",
      openGraph: { title: "Edgaze", url: `${METADATA_BASE}/${ownerHandle}/${edgazeCode}` },
      twitter: { card: "summary_large_image", title: "Edgaze" },
    };
  }

  const title = (listing.title || "Workflow | Edgaze").trim();
  const description =
    (listing.description || "").trim().slice(0, 160) || "Workflow on Edgaze";
  const imageUrl =
    absoluteImageUrl(listing.thumbnail_url) ||
    absoluteImageUrl(listing.banner_url);
  const pageUrl = `${METADATA_BASE}/${ownerHandle}/${edgazeCode}`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "Edgaze",
      title,
      description,
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default function WorkflowProductLayout({ children }: Props) {
  return <>{children}</>;
}
