import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: expired, error } = await supabase
    .from("creator_earnings")
    .update({ status: "eligibility_expired" })
    .eq("status", "pending_claim")
    .lt("claim_deadline_at", now)
    .select("id");

  if (error) {
    console.error("[CRON] expire-pending-claims error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = Array.isArray(expired) ? expired.length : 0;
  if (count > 0) {
    console.warn(`[CRON] Expired ${count} pending claim earnings (eligibility_expired)`);
  }

  return NextResponse.json({
    success: true,
    expiredCount: count,
  });
}
