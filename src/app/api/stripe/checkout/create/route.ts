import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { stripeConfig, calculatePaymentSplit } from '@/lib/stripe/config';
import { MIN_TRANSACTION_USD, WORKFLOW_MIN_USD } from '@/lib/marketplace/pricing';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { workflowId, promptId, type } = body;

    if (!type || (type !== 'workflow' && type !== 'prompt')) {
      return NextResponse.json(
        { error: 'Invalid purchase type' },
        { status: 400 }
      );
    }

    const resourceId = type === 'workflow' ? workflowId : promptId;
    if (!resourceId) {
      return NextResponse.json(
        { error: 'Resource ID required' },
        { status: 400 }
      );
    }

    const table = type === 'workflow' ? 'workflows' : 'prompts';
    const { data: resource, error: resourceError } = await supabase
      .from(table)
      .select('id, title, description, price_usd, is_paid, owner_id, thumbnail_url, edgaze_code')
      .eq('id', resourceId)
      .single();

    if (resourceError || !resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    if (!resource.is_paid || !resource.price_usd || resource.price_usd <= 0) {
      return NextResponse.json(
        { error: 'Resource is not for sale' },
        { status: 400 }
      );
    }

    const minAmount = type === 'workflow' ? WORKFLOW_MIN_USD : MIN_TRANSACTION_USD;
    if (resource.price_usd < minAmount) {
      return NextResponse.json(
        { error: `Minimum transaction amount is $${minAmount}` },
        { status: 400 }
      );
    }

    if (resource.owner_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot purchase your own content' },
        { status: 400 }
      );
    }

    const purchaseTable = type === 'workflow' ? 'workflow_purchases' : 'prompt_purchases';
    const { data: existingPurchase } = await supabase
      .from(purchaseTable)
      .select('id, status')
      .eq(type === 'workflow' ? 'workflow_id' : 'prompt_id', resourceId)
      .eq('buyer_id', user.id)
      .eq('status', 'paid')
      .is('refunded_at', null)
      .single();

    if (existingPurchase) {
      return NextResponse.json(
        { error: 'You already own this content' },
        { status: 400 }
      );
    }

    const { data: creator } = await supabase
      .from('profiles')
      .select('handle, full_name, email')
      .eq('id', resource.owner_id)
      .single();

    const { data: connectAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id, account_status, charges_enabled')
      .eq('user_id', resource.owner_id)
      .single();

    if (!connectAccount || connectAccount.account_status !== 'active' || !connectAccount.charges_enabled) {
      return NextResponse.json(
        { error: 'Creator cannot receive payments at this time' },
        { status: 400 }
      );
    }

    const { data: buyer } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    const amountCents = Math.round(resource.price_usd * 100);
    const { platformFeeCents, creatorNetCents } = calculatePaymentSplit(amountCents);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'link'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: resource.title,
            description: resource.description || undefined,
            images: resource.thumbnail_url ? [resource.thumbnail_url] : undefined,
            metadata: {
              edgaze_code: resource.edgaze_code || '',
              creator_handle: creator?.handle || '',
              creator_name: creator?.full_name || '',
              type
            }
          },
          unit_amount: amountCents
        },
        quantity: 1
      }],
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: connectAccount.stripe_account_id
        },
        metadata: {
          workflow_id: type === 'workflow' ? resourceId : '',
          prompt_id: type === 'prompt' ? resourceId : '',
          buyer_id: user.id,
          creator_id: resource.owner_id,
          purchase_type: type,
          edgaze_code: resource.edgaze_code || ''
        },
        statement_descriptor: 'EDGAZE',
        statement_descriptor_suffix: (resource.edgaze_code || '').slice(0, 10)
      },
      success_url: `${stripeConfig.appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&resource_id=${resourceId}&type=${type}`,
      cancel_url: type === 'prompt'
        ? `${stripeConfig.appUrl}/p/${creator?.handle || 'creator'}/${resource.edgaze_code || ''}`
        : `${stripeConfig.appUrl}/${creator?.handle || 'creator'}/${resource.edgaze_code || ''}`,
      customer_email: buyer?.email,
      metadata: {
        workflow_id: type === 'workflow' ? resourceId : '',
        prompt_id: type === 'prompt' ? resourceId : '',
        buyer_id: user.id,
        creator_id: resource.owner_id,
        purchase_type: type
      },
      custom_text: {
        submit: {
          message: 'Secure payment powered by Stripe'
        }
      }
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });

  } catch (error: any) {
    console.error('[STRIPE CHECKOUT] Create session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
