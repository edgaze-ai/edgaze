/**
 * V2 Connect Refresh - Create new account link for existing account
 *
 * Use when user needs to complete or update onboarding.
 * Calls Stripe V2 Account Links API.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createV2AccountLink } from "@/lib/stripe/connect-v2";
import { stripeConfig } from "@/lib/stripe/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
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
      return NextResponse.json(
        { error: "No Connect account. Start onboarding first." },
        { status: 400 },
      );
    }

    const accountLink = await createV2AccountLink({
      accountId: connectAccount.stripe_account_id,
      refreshUrl: `${stripeConfig.appUrl}/onboarding?refresh=true`,
      returnUrl: `${stripeConfig.appUrl}/onboarding/success?accountId=${connectAccount.stripe_account_id}`,
    });

    return NextResponse.json({
      success: true,
      url: accountLink.url,
    });
  } catch (error: any) {
    console.error("[STRIPE V2 CONNECT] Refresh error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account link" },
      { status: 500 },
    );
  }
}
