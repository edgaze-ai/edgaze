/**
 * Account Session — embedded Connect onboarding (Express, marketplace payouts).
 *
 * Creates a transfers-only Express connected account (no card_payments). Returns client_secret
 * for Connect.js. Auth: Bearer token (see AUTH.md).
 */

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { assertNotImpersonating, ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createConnectAccountSessionForOnboarding,
  createExpressMarketplaceConnectedAccount,
  getExpressConnectAccountPayoutStatus,
  tryDeleteConnectedAccount,
} from "@/lib/stripe/connect-marketplace";
import { replaceConnectAccountIfCountryMismatch } from "@/lib/stripe/replace-connect-account-for-country";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";
import { isAllowedPayoutCountry } from "@lib/creators/allowed-countries";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveActorContext(req, user);
    assertNotImpersonating(actor.actorMode);

    const admin = createSupabaseAdminClient();
    const { data: profileRow } = await admin
      .from("profiles")
      .select("handle, full_name, email, country")
      .eq("id", user.id)
      .single();

    const rawCountry = (profileRow?.country as string)?.trim()?.toUpperCase();
    const payoutCountry = rawCountry && isAllowedPayoutCountry(rawCountry) ? rawCountry : null;

    const profile = {
      email: profileRow?.email ?? user.email ?? "",
      full_name:
        profileRow?.full_name ??
        (user.user_metadata?.full_name as string) ??
        (user.user_metadata?.name as string) ??
        user.email?.split("@")[0] ??
        "Creator",
      handle: profileRow?.handle ?? `user_${user.id.replace(/-/g, "").slice(0, 12)}`,
    };

    if (!profile.email) {
      return NextResponse.json({ error: "Email required for Stripe onboarding" }, { status: 400 });
    }

    if (!payoutCountry) {
      return NextResponse.json(
        {
          error:
            "Choose your payout country on your profile (or on the onboarding page) before bank setup. It must match where you receive payouts.",
          code: "missing_payout_country",
        },
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
      const { stripeAccountId: resolvedId, replaced } =
        await replaceConnectAccountIfCountryMismatch(admin, {
          userId: user.id,
          payoutCountry,
          email: profile.email,
          handle: profile.handle,
          currentStripeAccountId: existingAccount.stripe_account_id,
        });
      stripeAccountId = resolvedId;

      const status = await getExpressConnectAccountPayoutStatus(stripeAccountId);

      await syncCreatorPayoutAccount({
        supabase: admin,
        creatorId: user.id,
        stripeAccountId,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        detailsSubmitted: status.detailsSubmitted,
        payoutSetupComplete: status.readyForPayouts,
        source: replaced ? "v2.account-session.country_replace" : "v2.account-session",
      });

      if (status.readyForPayouts) {
        const { clientSecret } = await createConnectAccountSessionForOnboarding(stripeAccountId);
        return NextResponse.json({
          clientSecret,
          accountId: stripeAccountId,
          status: "active",
        });
      }
    } else {
      const account = await createExpressMarketplaceConnectedAccount({
        email: profile.email,
        handle: profile.handle,
        userId: user.id,
        country: payoutCountry,
      });

      const insertPayload = {
        user_id: user.id,
        stripe_account_id: account.id,
        account_status: "pending" as const,
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        country: account.country ?? null,
        currency: account.default_currency || "usd",
      };

      const { error: insErr } = await admin.from("stripe_connect_accounts").insert(insertPayload);

      if (insErr) {
        const pgCode = (insErr as { code?: string }).code;
        if (pgCode === "23505") {
          await tryDeleteConnectedAccount(account.id);
          const { data: winner } = await admin
            .from("stripe_connect_accounts")
            .select("stripe_account_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!winner?.stripe_account_id) {
            throw new Error(insErr.message);
          }
          stripeAccountId = winner.stripe_account_id;
        } else {
          await tryDeleteConnectedAccount(account.id);
          throw new Error(insErr.message);
        }
      } else {
        stripeAccountId = account.id;
        await admin
          .from("profiles")
          .update({ stripe_onboarding_status: "pending" })
          .eq("id", user.id);
      }
    }

    const session = await createConnectAccountSessionForOnboarding(stripeAccountId);

    return NextResponse.json({
      clientSecret: session.clientSecret,
      accountId: stripeAccountId,
    });
  } catch (error: any) {
    if (error instanceof ImpersonationForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[STRIPE CONNECT] Account session error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account session" },
      { status: 500 },
    );
  }
}
