/**
 * Connect status — Express marketplace payout readiness (live Stripe API).
 */

import { NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getExpressConnectAccountPayoutStatus } from "@/lib/stripe/connect-marketplace";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveActorContext(req, user);
    const creatorId = actor.effectiveProfileId;
    const admin = createSupabaseAdminClient();

    const { data: connectAccount } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", creatorId)
      .single();

    if (!connectAccount) {
      return NextResponse.json({
        hasAccount: false,
        status: "not_started",
      });
    }

    const status = await getExpressConnectAccountPayoutStatus(connectAccount.stripe_account_id);

    await syncCreatorPayoutAccount({
      supabase: admin,
      creatorId,
      stripeAccountId: connectAccount.stripe_account_id,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      payoutSetupComplete: status.readyForPayouts,
      source: "v2.status",
    });

    return NextResponse.json({
      hasAccount: true,
      accountId: status.accountId,
      country: status.country,
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
    });
  } catch (error: any) {
    console.error("[STRIPE CONNECT] Status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check account status" },
      { status: 500 },
    );
  }
}
