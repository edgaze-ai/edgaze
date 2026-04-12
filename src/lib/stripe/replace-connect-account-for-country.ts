import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createExpressMarketplaceConnectedAccount,
  retrieveExpressAccountCountry,
  tryDeleteConnectedAccount,
} from "./connect-marketplace";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Stripe cannot change a connected account’s country after creation. If the profile payout country
 * no longer matches the live Stripe account, provision a new Express account and replace our row.
 *
 * We delete and re-insert `stripe_connect_accounts` so we never assign a new `stripe_account_id`
 * on the same row while child FKs still point at the old id (Postgres would reject that).
 * After a successful swap, we best-effort delete the old Stripe account so it stops sending
 * webhooks and doesn’t appear as a duplicate in the Dashboard.
 */
export async function replaceConnectAccountIfCountryMismatch(
  admin: AdminClient,
  params: {
    userId: string;
    payoutCountry: string;
    email: string;
    handle: string;
    currentStripeAccountId: string;
  },
): Promise<{ stripeAccountId: string; replaced: boolean }> {
  const { userId, payoutCountry, email, handle, currentStripeAccountId } = params;
  const live = await retrieveExpressAccountCountry(currentStripeAccountId);
  if (live === payoutCountry) {
    return { stripeAccountId: currentStripeAccountId, replaced: false };
  }

  const previousStripeId = currentStripeAccountId;
  const fresh = await createExpressMarketplaceConnectedAccount({
    email,
    handle,
    userId,
    country: payoutCountry,
  });

  try {
    const { error: delErr } = await admin
      .from("stripe_connect_accounts")
      .delete()
      .eq("user_id", userId);
    if (delErr) {
      throw new Error(delErr.message);
    }

    const { error: insErr } = await admin.from("stripe_connect_accounts").insert({
      user_id: userId,
      stripe_account_id: fresh.id,
      account_status: "pending",
      charges_enabled: fresh.charges_enabled ?? false,
      payouts_enabled: fresh.payouts_enabled ?? false,
      details_submitted: fresh.details_submitted ?? false,
      country: fresh.country ?? payoutCountry,
      currency: fresh.default_currency || "usd",
    });
    if (insErr) {
      throw new Error(insErr.message);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        stripe_onboarding_status: "pending",
        can_receive_payments: false,
      })
      .eq("id", userId);

    if (profileError) {
      throw new Error(profileError.message);
    }
  } catch (e) {
    await tryDeleteConnectedAccount(fresh.id);
    throw e;
  }

  await tryDeleteConnectedAccount(previousStripeId);

  return { stripeAccountId: fresh.id, replaced: true };
}
