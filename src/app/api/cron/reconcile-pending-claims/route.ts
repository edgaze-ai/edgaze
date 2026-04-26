import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reconcilePendingClaimCreators } from "@/lib/stripe/reconcile-pending-claims";
import { verifyCronSecret } from "@/lib/auth/verify-cron-secret";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    const summary = await reconcilePendingClaimCreators(supabase, "cron.reconcile-pending-claims");

    if (summary.failures.length > 0) {
      console.error("[CRON] reconcile-pending-claims partial failures:", summary.failures);
    }

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error("[CRON] reconcile-pending-claims error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reconcile pending claims",
      },
      { status: 500 },
    );
  }
}
