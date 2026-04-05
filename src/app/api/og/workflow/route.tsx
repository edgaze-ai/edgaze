import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { workflowPreviewImageUrl } from "@lib/listing-preview-image";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import {
  imageResponseFromElement,
  imageResponseFromListingCard,
  minimalBrandedListingCard,
  ogImageResponseInit,
  remoteImageLikelyRenderable,
} from "@lib/og/og-image-response";

export const runtime = "nodejs";
export const alt = "Edgaze workflow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function buildResponse(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerHandle = searchParams.get("ownerHandle") ?? searchParams.get("owner");
  const edgazeCode = searchParams.get("edgazeCode") ?? searchParams.get("code");

  let title = "Workflow";
  let creatorName = "Creator";
  let priceLabel = "Free";
  let rawImageUrl: string | undefined;

  if (ownerHandle && edgazeCode) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("workflows")
        .select(
          "title, owner_name, price_usd, is_paid, thumbnail_url, banner_url, demo_images, output_demo_urls",
        )
        .eq("owner_handle", ownerHandle)
        .eq("edgaze_code", edgazeCode)
        .eq("is_published", true)
        .is("removed_at", null)
        .maybeSingle();

      if (data) {
        const row = data as {
          title: string | null;
          owner_name: string | null;
          price_usd: number | null;
          is_paid: boolean | null;
          thumbnail_url: string | null;
          banner_url: string | null;
          demo_images: unknown;
          output_demo_urls: unknown;
        };
        title = row.title?.trim() || title;
        creatorName = row.owner_name?.trim() || `@${ownerHandle}` || creatorName;
        if (row.is_paid && row.price_usd != null && row.price_usd > 0) {
          priceLabel = `$${Number(row.price_usd).toFixed(2)}`;
        } else {
          priceLabel = "Free";
        }
        rawImageUrl = workflowPreviewImageUrl(row);
      }
    } catch {
      // fail-soft: defaults above
    }
  }

  let imageUrl: string | null | undefined = rawImageUrl;
  if (imageUrl && !(await remoteImageLikelyRenderable(imageUrl))) {
    imageUrl = undefined;
  }

  return imageResponseFromListingCard({
    title,
    creatorName,
    priceLabel,
    imageUrl: imageUrl ?? undefined,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await buildResponse(request);
  } catch {
    try {
      return imageResponseFromElement(minimalBrandedListingCard());
    } catch {
      return new ImageResponse(minimalBrandedListingCard(), ogImageResponseInit());
    }
  }
}
