export const stripeConfig = {
  apiVersion: '2026-02-25.clover' as const,
  secretKey: process.env.STRIPE_SECRET_KEY!,
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID,
  platformFeePercentage: parseInt(process.env.STRIPE_PLATFORM_FEE_PERCENTAGE || '20', 10),
  minimumPayoutCents: parseInt(process.env.STRIPE_MINIMUM_PAYOUT_CENTS || '1000', 10),
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  maxRetries: 3,
  retryDelay: 1000,
} as const;

export function validateStripeConfig() {
  // Skip validation during build time
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  const required = [
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Stripe environment variables: ${missing.join(', ')}. ` +
        `Add them to .env.local. Get keys at https://dashboard.stripe.com/apikeys`
    );
  }

  if (stripeConfig.platformFeePercentage < 0 || stripeConfig.platformFeePercentage > 100) {
    throw new Error('STRIPE_PLATFORM_FEE_PERCENTAGE must be between 0 and 100');
  }

  if (stripeConfig.minimumPayoutCents < 0) {
    throw new Error('STRIPE_MINIMUM_PAYOUT_CENTS must be positive');
  }
}

export function calculatePaymentSplit(amountCents: number) {
  const platformFeeCents = Math.round(amountCents * (stripeConfig.platformFeePercentage / 100));
  const creatorNetCents = amountCents - platformFeeCents;

  return {
    grossAmountCents: amountCents,
    platformFeeCents,
    creatorNetCents,
  };
}

export function isPaymentsEnabled(): boolean {
  return process.env.ENABLE_PAYMENTS === 'true';
}

export function isStripeConnectEnabled(): boolean {
  return process.env.ENABLE_STRIPE_CONNECT === 'true';
}
