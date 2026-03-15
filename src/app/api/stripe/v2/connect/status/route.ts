/**
 * V2 Connect Status - Get account status from Stripe API directly
 *
 * Per spec: Always get account status from API (do not trust DB for status).
 * Returns onboarding completion and payment capability status.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getV2AccountStatus } from "@/lib/stripe/connect-v2";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: connectAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .single();

    if (!connectAccount) {
      return NextResponse.json({
        hasAccount: false,
        status: "not_started",
      });
    }

    const status = await getV2AccountStatus(connectAccount.stripe_account_id);
    const admin = createSupabaseAdminClient();
    const isActive = status.readyToProcessPayments && status.onboardingComplete;

    await syncCreatorPayoutAccount({
      supabase: admin,
      creatorId: user.id,
      stripeAccountId: connectAccount.stripe_account_id,
      chargesEnabled: status.readyToProcessPayments,
      payoutsEnabled: isActive,
      detailsSubmitted: status.onboardingComplete,
      source: "v2.status",
    });

    return NextResponse.json({
      hasAccount: true,
      accountId: status.accountId,
      status: isActive ? "active" : "pending",
      readyToProcessPayments: status.readyToProcessPayments,
      onboardingComplete: status.onboardingComplete,
      requirementsStatus: status.requirementsStatus,
    });
  } catch (error: any) {
    console.error("[STRIPE V2 CONNECT] Status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check account status" },
      { status: 500 },
    );
  }
}
