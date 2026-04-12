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

    const status = await getExpressConnectAccountPayoutStatus(connectAccount.stripe_account_id);

    await syncCreatorPayoutAccount({
      supabase: admin,
      creatorId: user.id,
      stripeAccountId: connectAccount.stripe_account_id,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      payoutSetupComplete: status.readyForPayouts,
      source: "connect.callback",
    });

    await admin
      .from("stripe_connect_accounts")
      .update({
        onboarding_completed_at: status.detailsSubmitted ? new Date().toISOString() : null,
      })
      .eq("user_id", user.id);

    if (status.readyForPayouts) {
      return NextResponse.redirect(new URL("/onboarding/success", req.url));
    } else {
      return NextResponse.redirect(new URL("/onboarding?status=incomplete", req.url));
    }
  } catch (error: any) {
    console.error("[STRIPE CONNECT] Callback error:", error);
    return NextResponse.redirect(new URL("/onboarding?error=verification_failed", req.url));
  }
}
