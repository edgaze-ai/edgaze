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
} from "@/lib/stripe/connect-marketplace";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";

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
      .select("handle, full_name, email")
      .eq("id", user.id)
      .single();

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

    const { data: existingAccount } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id, account_status")
      .eq("user_id", user.id)
      .single();

    let stripeAccountId: string;

    if (existingAccount) {
      stripeAccountId = existingAccount.stripe_account_id;

      const status = await getExpressConnectAccountPayoutStatus(stripeAccountId);

      await syncCreatorPayoutAccount({
        supabase: admin,
        creatorId: user.id,
        stripeAccountId,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        detailsSubmitted: status.detailsSubmitted,
        payoutSetupComplete: status.readyForPayouts,
        source: "v2.account-session",
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
      });

      stripeAccountId = account.id;

      await admin.from("stripe_connect_accounts").insert({
        user_id: user.id,
        stripe_account_id: stripeAccountId,
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
