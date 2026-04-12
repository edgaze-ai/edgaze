/**
 * Hosted onboarding link — Express marketplace payouts (redirect flow).
 * Prefer `/api/stripe/v2/connect/account-session` for embedded Connect.js from the creators UI.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserAndClient } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { assertNotImpersonating, ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import {
  createExpressAccountLink,
  createExpressMarketplaceConnectedAccount,
  getExpressConnectAccountPayoutStatus,
} from "@/lib/stripe/connect-marketplace";
import { replaceConnectAccountIfCountryMismatch } from "@/lib/stripe/replace-connect-account-for-country";
import { stripeConfig } from "@/lib/stripe/config";
import { isAllowedPayoutCountry } from "@lib/creators/allowed-countries";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const authResult = await getUserAndClient(req);
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = authResult;

    try {
      const actor = await resolveActorContext(req, user);
      assertNotImpersonating(actor.actorMode);
    } catch (e) {
      if (e instanceof ImpersonationForbiddenError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

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
    const payoutCountry = rawCountry && isAllowedPayoutCountry(rawCountry) ? rawCountry : null;
    if (!payoutCountry) {
      return NextResponse.json(
        { error: "Set your payout country on your profile before continuing." },
        { status: 400 },
      );
    }

    const handle = profile.handle ?? `user_${user.id.replace(/-/g, "").slice(0, 12)}`;

    const { data: existingAccount } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id, account_status")
      .eq("user_id", user.id)
      .single();

    let stripeAccountId: string;

    if (existingAccount) {
      const { stripeAccountId: resolved } = await replaceConnectAccountIfCountryMismatch(admin, {
        userId: user.id,
        payoutCountry,
        email: profile.email,
        handle,
        currentStripeAccountId: existingAccount.stripe_account_id,
      });
      stripeAccountId = resolved;

      const live = await getExpressConnectAccountPayoutStatus(stripeAccountId);
      if (live.readyForPayouts) {
        return NextResponse.json({
          success: true,
          accountId: stripeAccountId,
          status: "active",
          message: "Account already active",
        });
      }
    } else {
      const account = await createExpressMarketplaceConnectedAccount({
        email: profile.email,
        handle,
        userId: user.id,
        country: payoutCountry,
      });

      stripeAccountId = account.id;

      await admin.from("stripe_connect_accounts").insert({
        user_id: user.id,
        stripe_account_id: account.id,
        account_status: "pending",
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        country: account.country ?? null,
        currency: account.default_currency || "usd",
      });

      await admin
        .from("profiles")
        .update({ stripe_onboarding_status: "pending" })
        .eq("id", user.id);
    }

    const accountLink = await createExpressAccountLink({
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
    console.error("[STRIPE CONNECT] Onboard error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create onboarding link" },
      { status: 500 },
    );
  }
}
