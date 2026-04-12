/**
 * Stripe Connect — Express accounts as marketplace payout recipients.
 *
 * Edgaze is the merchant of record: buyers pay via platform Checkout, and creator earnings are
 * moved with `stripe.transfers.create({ destination: connected_account_id })`.
 *
 * Do NOT request `card_payments` on connected accounts. That configures the account to accept
 * card payments directly on the connected account, which is the wrong model here and pulls in
 * extra Stripe verification (and onboarding failures in regions where that path is heavier).
 * Request only `transfers` so the account can receive platform payouts.
 *
 * Country is omitted on `accounts.create` so Stripe-hosted / embedded onboarding can collect it
 * (see Stripe Account Create: `country` is optional). The app allowlist (`allowed-countries`) is
 * still a product gate elsewhere; we do not pass profile country into account creation.
 */

import type Stripe from "stripe";
import { stripe } from "./client";
import { stripeConfig } from "./config";

export async function createExpressMarketplaceConnectedAccount(params: {
  email?: string | null;
  handle: string;
  userId: string;
}): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: "express",
    email: params.email || undefined,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: "individual",
    business_profile: {
      name: params.handle,
      product_description: "AI workflows and prompts on Edgaze",
      url: `${stripeConfig.appUrl}/profile/@${params.handle}`,
    },
    settings: {
      branding: {
        // Stripe fetches this URL server-side; must 200 with a real image. /edgaze-icon.png is not in public/.
        icon: `${stripeConfig.appUrl.replace(/\/$/, "")}/brand/icons/icon-192x192.png`,
        primary_color: "#22d3ee",
        secondary_color: "#e879f9",
      },
      payouts: {
        schedule: {
          interval: "weekly",
          weekly_anchor: "monday",
        },
      },
    },
    metadata: {
      edgaze_user_id: params.userId,
      edgaze_handle: params.handle,
      edgaze_profile_url: `${stripeConfig.appUrl}/profile/@${params.handle}`,
    },
  });
}

export type ConnectAccountPayoutStatus = {
  accountId: string;
  /** Set after Stripe collects country during onboarding (may be null until then). */
  country: string | null;
  /** True when the account can receive Stripe transfers and payouts per Connect rules. */
  readyForPayouts: boolean;
  /**
   * @deprecated Misnamed for the old merchant `card_payments` model. Same as `readyForPayouts`.
   * Kept so existing clients keep working.
   */
  readyToProcessPayments: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  transfersCapabilityStatus: string | null;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
  requirementsEventuallyDue: string[];
  requirementsDisabledReason: string | null;
  edgazeUserId: string | null;
};

/**
 * Live status from Stripe (never trust DB alone). Uses Express Account fields relevant to payouts.
 */
export async function getExpressConnectAccountPayoutStatus(
  stripeAccountId: string,
): Promise<ConnectAccountPayoutStatus> {
  const account = await stripe.accounts.retrieve(stripeAccountId);

  const transfersStatus = account.capabilities?.transfers ?? null;
  const transfersActive = transfersStatus === "active";
  const disabledReason = account.requirements?.disabled_reason ?? null;

  const readyForPayouts = Boolean(
    account.payouts_enabled && account.details_submitted && transfersActive && !disabledReason,
  );

  const meta = account.metadata as Record<string, string> | undefined;

  return {
    accountId: account.id,
    country: account.country ?? null,
    edgazeUserId: meta?.edgaze_user_id ?? null,
    readyForPayouts,
    readyToProcessPayments: readyForPayouts,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    transfersCapabilityStatus: transfersStatus,
    requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
    requirementsPastDue: account.requirements?.past_due ?? [],
    requirementsEventuallyDue: account.requirements?.eventually_due ?? [],
    requirementsDisabledReason: disabledReason,
  };
}

/** Embedded Connect.js — account onboarding (Express). */
export async function createConnectAccountSessionForOnboarding(stripeAccountId: string) {
  const accountSession = await stripe.accountSessions.create({
    account: stripeAccountId,
    components: {
      account_onboarding: {
        enabled: true,
      },
    },
  });

  return { clientSecret: accountSession.client_secret };
}

/** Embedded Connect.js — earnings / payout dashboard components. */
export async function createConnectDashboardAccountSession(stripeAccountId: string) {
  const accountSession = await stripe.accountSessions.create({
    account: stripeAccountId,
    components: {
      notification_banner: { enabled: true },
      // No `payments` component: creators are payout recipients only (no card_payments on account).
      payouts: {
        enabled: true,
        features: {
          standard_payouts: true,
          external_account_collection: true,
          edit_payout_schedule: true,
        },
      },
      account_management: {
        enabled: true,
        features: { external_account_collection: true },
      },
      documents: { enabled: true },
      balances: { enabled: true },
    },
  });

  return { clientSecret: accountSession.client_secret };
}

/** Hosted onboarding link (redirect flow). */
export async function createExpressAccountLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
    collect: "eventually_due",
  });
}
