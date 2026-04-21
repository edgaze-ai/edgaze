import { NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reconcileCreatorPayoutAccount } from "@/lib/stripe/reconcile-payout-account";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveActorContext(req, user);
    const creatorId = actor.effectiveProfileId;
    const supabase = createSupabaseAdminClient();

    try {
      await reconcileCreatorPayoutAccount({
        supabase,
        creatorId,
        source: "creator.earnings",
      });
    } catch (reconcileError) {
      console.error("[CREATOR EARNINGS] Failed to reconcile payout account:", reconcileError);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("total_earnings_cents, available_balance_cents")
      .eq("id", creatorId)
      .single();

    const { data: earnings } = await supabase
      .from("creator_earnings")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    const pendingClaimRows = (earnings || []).filter(
      (e: { status: string }) => e.status === "pending_claim",
    );
    const pendingClaimCents = pendingClaimRows.reduce(
      (sum: number, e: { net_amount_cents?: number }) => sum + (e.net_amount_cents || 0),
      0,
    );
    const earliestDeadline =
      pendingClaimRows.length > 0
        ? pendingClaimRows.reduce(
            (min: string | null, e: { claim_deadline_at?: string | null }) => {
              const d = e.claim_deadline_at;
              if (!d) return min;
              return !min || d < min ? d : min;
            },
            null as string | null,
          )
        : null;
    const now = new Date();
    const daysRemaining = earliestDeadline
      ? Math.max(
          0,
          Math.ceil((new Date(earliestDeadline).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        )
      : 0;

    const { data: payouts } = await supabase
      .from("creator_payouts")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(5);

    const totalSales = earnings?.length || 0;
    const avgSaleCents =
      totalSales > 0 ? Math.round((profile?.total_earnings_cents || 0) / totalSales) : 0;

    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEarnings = earnings?.filter((e) => new Date(e.created_at) >= last30Days) || [];

    const nextPayout = payouts?.find((p) => p.status === "pending");

    return NextResponse.json({
      totalEarningsCents: profile?.total_earnings_cents || 0,
      availableBalanceCents: profile?.available_balance_cents || 0,
      totalSales,
      avgSaleCents,
      recentEarnings: recentEarnings.length,
      nextPayout: nextPayout
        ? {
            amountCents: nextPayout.amount_cents,
            arrivalDate: nextPayout.arrival_date,
          }
        : null,
      recentPayouts: payouts || [],
      pendingClaimCents: pendingClaimCents || 0,
      claimDeadline: earliestDeadline,
      daysRemaining,
    });
  } catch (error: any) {
    console.error("[CREATOR EARNINGS] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch earnings" },
      { status: 500 },
    );
  }
}
