/**
 * Create Subscription Checkout - customer_account flow
 *
 * For V2 accounts, use customer_account (connected account ID) instead of customer.
 * Creates a hosted checkout session for the connected account to subscribe to platform.
 *
 * Requires STRIPE_PLATFORM_PRICE_ID (create in Stripe Dashboard for your platform plan).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { stripeConfig } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PLATFORM_PRICE_ID = process.env.STRIPE_PLATFORM_PRICE_ID;

export async function POST(req: Request) {
  try {
    if (!PLATFORM_PRICE_ID) {
      return NextResponse.json(
        {
          error:
            'STRIPE_PLATFORM_PRICE_ID not configured. Create a price in Stripe Dashboard for your platform plan.',
        },
        { status: 500 }
      );
    }

    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: connectAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id, account_status')
      .eq('user_id', user.id)
      .single();

    if (!connectAccount || connectAccount.account_status !== 'active') {
      return NextResponse.json(
        { error: 'Connect account must be active. Complete onboarding first.' },
        { status: 400 }
      );
    }

    const appUrl = stripeConfig.appUrl;

    const session = await stripe.checkout.sessions.create({
      customer_account: connectAccount.stripe_account_id,
      mode: 'subscription',
      line_items: [
        {
          price: PLATFORM_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard`,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('[STRIPE V2] Subscription checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
