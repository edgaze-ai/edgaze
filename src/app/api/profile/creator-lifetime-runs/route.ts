import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Public: total completed analytics runs for a creator (all listings).
 */
export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get("creator_id")?.trim();
  if (!creatorId || !UUID_RE.test(creatorId)) {
    return NextResponse.json({ totalRuns: 0 }, { status: 200 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("creator_user_id", creatorId)
      .not("ended_at", "is", null)
      .in("status", ["success", "error", "canceled"]);

    if (error) {
      console.error("[creator-lifetime-runs]", error);
      return NextResponse.json({ totalRuns: 0 }, { status: 200 });
    }
    return NextResponse.json({ totalRuns: count ?? 0 });
  } catch (e) {
    console.error("[creator-lifetime-runs]", e);
    return NextResponse.json({ totalRuns: 0 }, { status: 200 });
  }
}
