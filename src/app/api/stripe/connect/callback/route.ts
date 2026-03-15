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
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    const { data: connectAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .single();

    if (!connectAccount) {
      return NextResponse.redirect(new URL("/onboarding?error=account_not_found", req.url));
    }

    const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);

    await syncCreatorPayoutAccount({
      supabase: admin,
      creatorId: user.id,
      stripeAccountId: connectAccount.stripe_account_id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      source: "connect.callback",
    });

    await admin
      .from("stripe_connect_accounts")
      .update({
        onboarding_completed_at: account.details_submitted ? new Date().toISOString() : null,
      })
      .eq("user_id", user.id);

    if (account.charges_enabled && account.payouts_enabled) {
      return NextResponse.redirect(new URL("/onboarding/success", req.url));
    } else {
      return NextResponse.redirect(new URL("/onboarding?status=incomplete", req.url));
    }
  } catch (error: any) {
    console.error("[STRIPE CONNECT] Callback error:", error);
    return NextResponse.redirect(new URL("/onboarding?error=verification_failed", req.url));
  }
}
