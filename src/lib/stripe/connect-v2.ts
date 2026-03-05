/**
 * Stripe Connect V2 API - Production-ready integration
 *
 * Uses Stripe Accounts V2 API for connected account management.
 * Per Stripe docs: Do NOT use top-level type ('express'|'standard'|'custom').
 * V2 API uses configuration-based approach instead.
 *
 * IMPORTANT: Use stripeClient (exported as `stripe`) for all Stripe requests.
 * API version 2026-02-25.clover is used automatically by the SDK.
 *
 * @see https://docs.stripe.com/api/v2/core/accounts
 * @see https://docs.stripe.com/changelog/clover/2025-12-15/accounts-v2
 */

import { stripe } from './client';
import { stripeConfig } from './config';

/**
 * Create a V2 connected account for a creator.
 * Uses only the properties specified - never pass type at top level.
 *
 * PLACEHOLDER: STRIPE_SECRET_KEY must be set in .env. If missing, throws
 * a helpful error at runtime.
 */
export async function createV2ConnectedAccount(params: {
  displayName: string;
  contactEmail: string;
  country?: string;
  metadata?: Record<string, string>;
}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is required. Add it to your .env file. Get keys at https://dashboard.stripe.com/apikeys'
    );
  }

  const account = await stripe.v2.core.accounts.create({
    display_name: params.displayName,
    contact_email: params.contactEmail,
    identity: {
      country: (params.country || 'us').toLowerCase() as 'us',
    },
    dashboard: 'full',
    defaults: {
      responsibilities: {
        fees_collector: 'stripe',
        losses_collector: 'stripe',
      },
    },
    configuration: {
      customer: {},
      merchant: {
        capabilities: {
          card_payments: {
            requested: true,
          },
        },
      },
    },
    metadata: params.metadata || {},
  });

  return account;
}

/**
 * Create V2 account link for onboarding.
 * User clicks "Onboard to collect payments" → redirected to Stripe hosted flow.
 */
export async function createV2AccountLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is required. Add it to your .env file.'
    );
  }

  const accountLink = await stripe.v2.core.accountLinks.create({
    account: params.accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['merchant', 'customer'],
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
      },
    },
  });

  return accountLink;
}

/**
 * Get V2 account status from Stripe API directly (never trust DB for status).
 * Use for onboarding completion check and dashboard display.
 */
export async function getV2AccountStatus(stripeAccountId: string) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is required.');
  }

  const account = await stripe.v2.core.accounts.retrieve(stripeAccountId, {
    include: ['configuration.merchant', 'requirements'],
  });

  const merchantConfig = account.configuration?.merchant as { capabilities?: { card_payments?: { status?: string } } } | undefined;
  const readyToProcessPayments =
    merchantConfig?.capabilities?.card_payments?.status === 'active';

  const requirementsSummary = account.requirements?.summary as { minimum_deadline?: { status?: string } } | undefined;
  const requirementsStatus = requirementsSummary?.minimum_deadline?.status;
  const onboardingComplete =
    requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';

  return {
    accountId: account.id,
    readyToProcessPayments,
    onboardingComplete,
    requirementsStatus: requirementsStatus || 'unknown',
  };
}
