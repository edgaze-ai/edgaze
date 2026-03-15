/**
 * V2 Connect Onboard - Create V2 account and return onboarding URL
 *
 * Uses Stripe Accounts V2 API. Never uses type: 'express'|'standard'|'custom'.
 * Stores user_id → account_id mapping in stripe_connect_accounts.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserAndClient } from "@/lib/auth/server";
import { isAllowedPayoutCountry } from "@lib/creators/allowed-countries";
import { createV2ConnectedAccount, createV2AccountLink } from "@/lib/stripe/connect-v2";
import { stripeConfig } from "@/lib/stripe/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Support Bearer token + cookies (same as account-session) for invite flow and creators portal
    const authResult = await getUserAndClient(req);
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = authResult;
    const admin = createSupabaseAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("handle, full_name, email, country")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.email) {
      return NextResponse.json({ error: "Email required for Stripe onboarding" }, { status: 400 });
    }

    const rawCountry = (profile.country as string)?.trim()?.toUpperCase();
    const country = rawCountry && isAllowedPayoutCountry(rawCountry) ? rawCountry : null;
    if (!country) {
      return NextResponse.json(
        { error: "Select your country first. Complete the country step before continuing." },
        { status: 400 },
      );
    }

    const { data: existingAccount } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id, account_status")
      .eq("user_id", user.id)
      .single();

    let stripeAccountId: string;

    if (existingAccount) {
      stripeAccountId = existingAccount.stripe_account_id;

      if (existingAccount.account_status === "active") {
        return NextResponse.json({
          success: true,
          accountId: stripeAccountId,
          status: "active",
          message: "Account already active",
        });
      }
    } else {
      const account = await createV2ConnectedAccount({
        displayName: profile.full_name || profile.handle || "Creator",
        contactEmail: profile.email,
        country,
        metadata: {
          edgaze_user_id: user.id,
          edgaze_handle: profile.handle || "",
        },
      });

      stripeAccountId = account.id;

      await admin.from("stripe_connect_accounts").insert({
        user_id: user.id,
        stripe_account_id: account.id,
        account_status: "pending",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        country: (account.identity as { country?: string })?.country || "us",
        currency: "usd",
      });

      await admin
        .from("profiles")
        .update({ stripe_onboarding_status: "pending" })
        .eq("id", user.id);
    }

    const accountLink = await createV2AccountLink({
      accountId: stripeAccountId,
      refreshUrl: `${stripeConfig.appUrl}/onboarding?refresh=true`,
      returnUrl: `${stripeConfig.appUrl}/onboarding/success?accountId=${stripeAccountId}`,
    });

    return NextResponse.json({
      success: true,
      url: accountLink.url,
      accountId: stripeAccountId,
    });
  } catch (error: any) {
    console.error("[STRIPE V2 CONNECT] Onboard error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create onboarding link" },
      { status: 500 },
    );
  }
}
