import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeTrendingAdminSnapshot } from "@/lib/trending/compute-this-week";

export const dynamic = "force-dynamic";

const TRENDING_TAG = "trending-this-week";

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const snapshot = await computeTrendingAdminSnapshot();

    const [dw, dp] = await Promise.all([
      supabase
        .from("workflows")
        .select(
          "id,title,edgaze_code,owner_handle,owner_name,thumbnail_url,updated_at,is_published,visibility",
        )
        .eq("exclude_from_trending", true)
        .is("removed_at", null)
        .order("updated_at", { ascending: false })
        .limit(150),
      supabase
        .from("prompts")
        .select(
          "id,title,edgaze_code,owner_handle,owner_name,thumbnail_url,updated_at,visibility,type",
        )
        .eq("exclude_from_trending", true)
        .is("removed_at", null)
        .order("updated_at", { ascending: false })
        .limit(150),
    ]);

    if (dw.error) {
      console.error("[admin/trending] disqualified workflows:", dw.error);
    }
    if (dp.error) {
      console.error("[admin/trending] disqualified prompts:", dp.error);
    }

    return NextResponse.json({
      trending_workflows: snapshot.trending_workflows,
      trending_prompts: snapshot.trending_prompts,
      disqualified_workflows: dw.data ?? [],
      disqualified_prompts: dp.data ?? [],
    });
  } catch (e: unknown) {
    console.error("[admin/trending] GET", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await req.json()) as {
      listing_type?: string;
      listing_id?: string;
      exclude?: boolean;
    };

    const listingType = body.listing_type;
    const listingId = typeof body.listing_id === "string" ? body.listing_id.trim() : "";
    if (typeof body.exclude !== "boolean") {
      return NextResponse.json({ error: "exclude must be a boolean" }, { status: 400 });
    }
    const exclude = body.exclude;

    if (listingType !== "workflow" && listingType !== "prompt") {
      return NextResponse.json(
        { error: "listing_type must be workflow or prompt" },
        { status: 400 },
      );
    }
    if (!listingId) {
      return NextResponse.json({ error: "listing_id is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const table = listingType === "workflow" ? "workflows" : "prompts";

    const { error } = await supabase
      .from(table)
      .update({ exclude_from_trending: exclude, updated_at: new Date().toISOString() })
      .eq("id", listingId);

    if (error) {
      console.error("[admin/trending] update", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateTag(TRENDING_TAG, "default");

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[admin/trending] POST", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
