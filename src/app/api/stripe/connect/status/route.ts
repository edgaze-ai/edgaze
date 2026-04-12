import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getExpressConnectAccountPayoutStatus } from "@/lib/stripe/connect-marketplace";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: connectAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!connectAccount) {
      return NextResponse.json({
        hasAccount: false,
        status: "not_started",
      });
    }

    const status = await getExpressConnectAccountPayoutStatus(connectAccount.stripe_account_id);

    const needsUpdate =
      connectAccount.charges_enabled !== status.chargesEnabled ||
      connectAccount.payouts_enabled !== status.payoutsEnabled ||
      connectAccount.details_submitted !== status.detailsSubmitted;

    if (needsUpdate || status.readyForPayouts) {
      await syncCreatorPayoutAccount({
        supabase: admin,
        creatorId: user.id,
        stripeAccountId: connectAccount.stripe_account_id,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        detailsSubmitted: status.detailsSubmitted,
        payoutSetupComplete: status.readyForPayouts,
        source: "connect.status",
      });
    }

    return NextResponse.json({
      hasAccount: true,
      accountId: connectAccount.stripe_account_id,
      status: status.readyForPayouts ? "active" : "pending",
      readyForPayouts: status.readyForPayouts,
      readyToProcessPayments: status.readyToProcessPayments,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      transfersCapabilityStatus: status.transfersCapabilityStatus,
      requirementsCurrentlyDue: status.requirementsCurrentlyDue,
      requirementsPastDue: status.requirementsPastDue,
      requirementsEventuallyDue: status.requirementsEventuallyDue,
      requirementsDisabledReason: status.requirementsDisabledReason,
      country: status.country,
    });
  } catch (error: any) {
    console.error("[STRIPE CONNECT] Status check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check account status" },
      { status: 500 },
    );
  }
}
