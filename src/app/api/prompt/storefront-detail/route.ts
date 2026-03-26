import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export const dynamic = "force-dynamic";

function isListingFree(row: { is_paid?: boolean | null; monetisation_mode?: string | null }) {
  return row.monetisation_mode === "free" || row.is_paid === false;
}

/** Public prompt / hybrid listing metadata; masks prompt_text for paid listings. */
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const owner_handle = u.searchParams.get("owner_handle")?.trim();
    const edgaze_code = u.searchParams.get("edgaze_code")?.trim();
    if (!owner_handle || !edgaze_code) {
      return NextResponse.json({ error: "owner_handle and edgaze_code required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const baseQuery = () =>
      supabase
        .from("prompts")
        .select("*")
        .eq("owner_handle", owner_handle)
        .eq("edgaze_code", edgaze_code)
        .is("removed_at", null);

    let { data, error } = await baseQuery().in("visibility", ["public", "unlisted"]).maybeSingle();

    if ((error || !data) && owner_handle && edgaze_code) {
      const fb = await baseQuery().maybeSingle();
      if (!fb.error && fb.data) {
        data = fb.data;
        error = null;
      }
    }

    if (error || !data) {
      return NextResponse.json({ listing: null }, { status: 200 });
    }

    const row = { ...(data as Record<string, unknown>) };

    const free = isListingFree({
      is_paid: row.is_paid as boolean | null,
      monetisation_mode: row.monetisation_mode as string | null,
    });

    if (!free) {
      row.prompt_text = null;
      row.placeholders = null;
    }

    return NextResponse.json({ listing: row });
  } catch (e) {
    console.error("[prompt/storefront-detail]", e);
    return NextResponse.json({ listing: null }, { status: 200 });
  }
}
