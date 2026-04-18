import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { resolvePublishedWorkflowRowForPath } from "@lib/supabase/workflow-storefront-resolve";

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
    const resolved = await resolvePublishedWorkflowRowForPath(supabase, owner_handle, edgaze_code);

    if (!resolved || typeof resolved !== "object") {
      return NextResponse.json({ listing: null }, { status: 200 });
    }

    const row = { ...(resolved as Record<string, unknown>) };
    // Keep the response shape tolerant while older databases do not expose newer storefront fields.
    if (!Object.prototype.hasOwnProperty.call(row, "sample_output")) {
      row.sample_output = null;
    }
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
