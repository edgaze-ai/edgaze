// Admin-only: upsert rows into listing_owner_redirects for old storefront paths after ownership transfer.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = {
  listing_type: "workflow" | "prompt";
  listing_id: string;
  from_owner_handle: string;
  edgaze_code: string;
};

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const rows = body?.rows as Row[] | undefined;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: "Maximum 500 rows per request" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const normalized: Array<{
      listing_id: string;
      listing_type: string;
      from_owner_handle_norm: string;
      edgaze_code: string;
    }> = [];

    for (const r of rows) {
      if (!r || (r.listing_type !== "workflow" && r.listing_type !== "prompt")) {
        return NextResponse.json(
          { error: "Each row needs listing_type workflow|prompt" },
          { status: 400 },
        );
      }
      if (!r.listing_id || !UUID_RE.test(r.listing_id)) {
        return NextResponse.json(
          { error: "Each row needs a valid listing_id UUID" },
          { status: 400 },
        );
      }
      const from = (r.from_owner_handle ?? "").trim().toLowerCase();
      const code = (r.edgaze_code ?? "").trim();
      if (!from || !code) {
        return NextResponse.json(
          { error: "Each row needs from_owner_handle and edgaze_code" },
          { status: 400 },
        );
      }
      normalized.push({
        listing_id: r.listing_id,
        listing_type: r.listing_type,
        from_owner_handle_norm: from,
        edgaze_code: code,
      });
    }

    const { error: upErr } = await (supabase as any)
      .from("listing_owner_redirects")
      .upsert(normalized, {
        onConflict: "from_owner_handle_norm,edgaze_code",
      });

    if (upErr) {
      console.error("[bulk-listing-owner-redirects]", upErr);
      return NextResponse.json({ error: upErr.message ?? "Upsert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: normalized.length });
  } catch (e) {
    console.error("[bulk-listing-owner-redirects]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 },
    );
  }
}
