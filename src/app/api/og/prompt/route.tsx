import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { promptPreviewImageUrl } from "@lib/listing-preview-image";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import {
  imageResponseFromElement,
  imageResponseFromListingCard,
  loadBrandMarkDataUrl,
  minimalBrandedListingCard,
  ogImageResponseInit,
  remoteImageLikelyRenderable,
} from "@lib/og/og-image-response";

export const runtime = "nodejs";

async function buildResponse(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerHandle = searchParams.get("ownerHandle") ?? searchParams.get("owner");
  const edgazeCode = searchParams.get("edgazeCode") ?? searchParams.get("code");

  let title = "Prompt";
  let creatorName = "Creator";
  let priceLabel = "Free";
  let rawImageUrl: string | undefined;

  if (ownerHandle && edgazeCode) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("prompts")
        .select(
          "title, owner_name, price_usd, is_paid, thumbnail_url, demo_images, output_demo_urls",
        )
        .eq("owner_handle", ownerHandle)
        .eq("edgaze_code", edgazeCode)
        .is("removed_at", null)
        .in("visibility", ["public", "unlisted"])
        .maybeSingle();

      if (data) {
        const row = data as {
          title: string | null;
          owner_name: string | null;
          price_usd: number | null;
          is_paid: boolean | null;
          thumbnail_url: string | null;
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
        rawImageUrl = promptPreviewImageUrl(row);
      }
    } catch {
      // fail-soft: defaults above
    }
  }

  let imageUrl: string | null | undefined = rawImageUrl;
  if (imageUrl && !(await remoteImageLikelyRenderable(imageUrl))) {
    imageUrl = undefined;
  }

  const brandMarkSrc = await loadBrandMarkDataUrl();

  return imageResponseFromListingCard({
    title,
    creatorName,
    priceLabel,
    imageUrl: imageUrl ?? undefined,
    brandMarkSrc,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await buildResponse(request);
  } catch {
    try {
      const brandMarkSrc = await loadBrandMarkDataUrl();
      return imageResponseFromElement(minimalBrandedListingCard(brandMarkSrc));
    } catch {
      return new ImageResponse(minimalBrandedListingCard(), ogImageResponseInit());
    }
  }
}
