import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/stripe/config";

export const dynamic = "force-dynamic";

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
      return NextResponse.json({ error: "Connect account not found" }, { status: 404 });
    }

    const accountLink = await stripe.accountLinks.create({
      account: connectAccount.stripe_account_id,
      refresh_url: `${stripeConfig.appUrl}/onboarding?refresh=true`,
      return_url: `${stripeConfig.appUrl}/onboarding/success`,
      type: "account_onboarding",
      collect: "eventually_due",
    });

    return NextResponse.json({
      success: true,
      url: accountLink.url,
    });
  } catch (error: any) {
    console.error("[STRIPE CONNECT] Refresh error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to refresh onboarding link" },
      { status: 500 },
    );
  }
}
