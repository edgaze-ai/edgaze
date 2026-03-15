/**
 * Account Session - Create session for embedded Connect onboarding
 *
 * Returns client_secret for Connect.js. Reuses onboard logic to get/create
 * connected account, then creates Account Session instead of Account Link.
 * Marketplace: 20% platform commission via application fees on charges.
 *
 * Auth: Bearer token only (per AUTH.md). Client must send Authorization: Bearer <accessToken>.
 * Profile fetched via admin client using verified user.id from token.
 */

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createV2ConnectedAccount,
  createAccountSession,
  getV2AccountStatus,
} from "@/lib/stripe/connect-v2";
import { isAllowedPayoutCountry } from "@lib/creators/allowed-countries";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profileRow } = await admin
      .from("profiles")
      .select("handle, full_name, email, country")
      .eq("id", user.id)
      .single();

    const rawCountry = (profileRow?.country as string)?.trim()?.toUpperCase();
    const country = rawCountry && isAllowedPayoutCountry(rawCountry) ? rawCountry : null;

    const profile = {
      email: profileRow?.email ?? user.email ?? "",
      full_name:
        profileRow?.full_name ??
        (user.user_metadata?.full_name as string) ??
        (user.user_metadata?.name as string) ??
        user.email?.split("@")[0] ??
        "Creator",
      handle: profileRow?.handle ?? `user_${user.id.replace(/-/g, "").slice(0, 12)}`,
      country,
    };

    if (!profile.email) {
      return NextResponse.json({ error: "Email required for Stripe onboarding" }, { status: 400 });
    }

    if (!profile.country) {
      return NextResponse.json(
        { error: "Select your country first. Go back and choose your country before continuing." },
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

      const status = await getV2AccountStatus(stripeAccountId);
      const isActive = status.readyToProcessPayments && status.onboardingComplete;

      await syncCreatorPayoutAccount({
        supabase: admin,
        creatorId: user.id,
        stripeAccountId,
        chargesEnabled: status.readyToProcessPayments,
        payoutsEnabled: isActive,
        detailsSubmitted: status.onboardingComplete,
        source: "v2.account-session",
      });

      if (isActive) {
        const { clientSecret } = await createAccountSession(stripeAccountId);
        return NextResponse.json({
          clientSecret,
          accountId: stripeAccountId,
          status: "active",
        });
      }
    } else {
      const account = await createV2ConnectedAccount({
        displayName: profile.full_name || profile.handle || "Creator",
        contactEmail: profile.email,
        country: profile.country,
        metadata: {
          edgaze_user_id: user.id,
          edgaze_handle: profile.handle || "",
        },
      });

      stripeAccountId = account.id;

      await admin.from("stripe_connect_accounts").insert({
        user_id: user.id,
        stripe_account_id: stripeAccountId,
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

    const session = await createAccountSession(stripeAccountId);

    return NextResponse.json({
      clientSecret: session.clientSecret,
      accountId: stripeAccountId,
    });
  } catch (error: any) {
    console.error("[STRIPE V2 CONNECT] Account session error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account session" },
      { status: 500 },
    );
  }
}
