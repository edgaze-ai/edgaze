/**
 * Create Checkout Session - Direct Charge with Application Fee
 *
 * Uses Stripe Client for all requests. Hosted checkout charges go to the
 * connected account. application_fee_amount = platform's share (from
 * STRIPE_PLATFORM_FEE_PERCENTAGE, default 20%). Pass stripeAccount in
 * options for Direct Charge.
 *
 * Buyer must be authenticated. Metadata includes buyer_id for access grants.
 * PLACEHOLDER: STRIPE_SECRET_KEY required. Missing key throws at runtime.
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { stripeConfig } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      connectedAccountId,
      productId,
      priceId,
      quantity = 1,
      successUrl,
      cancelUrl,
      metadata = {},
    } = body;

    if (!connectedAccountId || (!productId && !priceId)) {
      return NextResponse.json(
        { error: 'connectedAccountId and (productId or priceId) required' },
        { status: 400 }
      );
    }

    const appUrl = stripeConfig.appUrl;
    const success = successUrl || `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = cancelUrl || `${appUrl}/store`;

    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    let amountTotalCents: number;

    if (priceId) {
      const price = await stripe.prices.retrieve(
        priceId,
        {},
        { stripeAccount: connectedAccountId }
      );
      amountTotalCents = (price.unit_amount || 0) * quantity;
      lineItem = { price: priceId, quantity };
    } else {
      const product = await stripe.products.retrieve(
        productId,
        { expand: ['default_price'] },
        { stripeAccount: connectedAccountId }
      );
      const defaultPrice = product.default_price;
      if (!defaultPrice || typeof defaultPrice === 'string') {
        return NextResponse.json(
          { error: 'Product has no default price' },
          { status: 400 }
        );
      }
      const price = defaultPrice as { unit_amount: number | null; currency: string };
      amountTotalCents = (price.unit_amount || 0) * quantity;
      lineItem = {
        price_data: {
          currency: (price.currency || 'usd') as string,
          product_data: {
            name: product.name,
            description: product.description || undefined,
            images: product.images || undefined,
          },
          unit_amount: price.unit_amount || 0,
        },
        quantity,
      };
    }

    const platformFeePercent = stripeConfig.platformFeePercentage / 100;
    const applicationFeeAmount = Math.round(amountTotalCents * platformFeePercent);

    const session = await stripe.checkout.sessions.create(
      {
        line_items: [lineItem],
        mode: 'payment',
        success_url: success,
        cancel_url: cancel,
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          metadata: {
            buyer_id: user.id,
            ...metadata,
          },
        },
        metadata: {
          buyer_id: user.id,
          connected_account_id: connectedAccountId,
          ...metadata,
        },
      },
      {
        stripeAccount: connectedAccountId,
      }
    );

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('[STRIPE V2] Create checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
