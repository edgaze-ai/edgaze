import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
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

    const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);

    const needsUpdate =
      connectAccount.charges_enabled !== account.charges_enabled ||
      connectAccount.payouts_enabled !== account.payouts_enabled ||
      connectAccount.details_submitted !== account.details_submitted;

    if (needsUpdate || (account.charges_enabled && account.payouts_enabled)) {
      await syncCreatorPayoutAccount({
        supabase: admin,
        creatorId: user.id,
        stripeAccountId: connectAccount.stripe_account_id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        source: "connect.status",
      });
    }

    return NextResponse.json({
      hasAccount: true,
      accountId: connectAccount.stripe_account_id,
      status: account.charges_enabled && account.payouts_enabled ? "active" : "pending",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      country: account.country,
      currency: account.default_currency,
    });
  } catch (error: any) {
    console.error("[STRIPE CONNECT] Status check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check account status" },
      { status: 500 },
    );
  }
}
