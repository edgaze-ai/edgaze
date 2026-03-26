import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export const dynamic = "force-dynamic";

function isListingFree(row: { is_paid?: boolean | null; monetisation_mode?: string | null }) {
  return row.monetisation_mode === "free" || row.is_paid === false;
}

/**
 * Public workflow product metadata. Masks graph_json/graph for paid listings (fetch via
 * /api/workflow/resolve-run-graph or Supabase when RLS allows).
 */
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const owner_handle = u.searchParams.get("owner_handle")?.trim();
    const edgaze_code = u.searchParams.get("edgaze_code")?.trim();
    if (!owner_handle || !edgaze_code) {
      return NextResponse.json({ error: "owner_handle and edgaze_code required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("workflows")
      .select(
        [
          "id",
          "owner_id",
          "owner_name",
          "owner_handle",
          "title",
          "description",
          "tags",
          "banner_url",
          "thumbnail_url",
          "edgaze_code",
          "is_public",
          "is_published",
          "monetisation_mode",
          "is_paid",
          "price_usd",
          "views_count",
          "likes_count",
          "demo_images",
          "output_demo_urls",
          "graph_json",
          "graph",
          "removed_at",
          "removed_reason",
          "removed_by",
          "demo_mode_enabled",
          "demo_token",
        ].join(","),
      )
      .eq("owner_handle", owner_handle)
      .eq("edgaze_code", edgaze_code)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      console.error("[workflow/storefront-detail]", error);
      return NextResponse.json({ listing: null }, { status: 200 });
    }
    if (!data) return NextResponse.json({ listing: null }, { status: 200 });

    const row = { ...(data as unknown as Record<string, unknown>) };
    if (row.is_public === false) return NextResponse.json({ listing: null }, { status: 200 });

    const free = isListingFree({
      is_paid: row.is_paid as boolean | null,
      monetisation_mode: row.monetisation_mode as string | null,
    });

    if (!free) {
      row.graph_json = null;
      row.graph = null;
    }

    return NextResponse.json({ listing: row });
  } catch (e) {
    console.error("[workflow/storefront-detail]", e);
    return NextResponse.json({ listing: null }, { status: 200 });
  }
}
