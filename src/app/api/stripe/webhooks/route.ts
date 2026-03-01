import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    console.error('[WEBHOOK] Missing Stripe signature');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  console.log(`[WEBHOOK] Received: ${event.type} (${event.id})`);
  
  const supabase = createSupabaseAdminClient();
  
  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('id, processed')
    .eq('stripe_event_id', event.id)
    .single();
  
  if (existingEvent?.processed) {
    console.log(`[WEBHOOK] Event ${event.id} already processed, skipping`);
    return NextResponse.json({ received: true, skipped: true });
  }
  
  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data.object as any,
      processed: false,
      processing_attempts: 0
    });
  
  if (insertError?.code === '23505') {
    console.log(`[WEBHOOK] Event ${event.id} being processed by another worker`);
    return NextResponse.json({ received: true, skipped: true });
  }
  
  try {
    await processWebhookEvent(event, supabase);
    
    await supabase
      .from('stripe_webhook_events')
      .update({ 
        processed: true, 
        processed_at: new Date().toISOString(),
        processing_duration_ms: Date.now() - startTime
      })
      .eq('stripe_event_id', event.id);
    
    console.log(`[WEBHOOK] Successfully processed ${event.type} in ${Date.now() - startTime}ms`);
    
    return NextResponse.json({ received: true });
    
  } catch (error: any) {
    console.error(`[WEBHOOK] Processing failed for ${event.type}:`, error);
    
    await supabase.rpc('increment_webhook_attempts', {
      event_id: event.id,
      error_msg: error.message
    });
    
    return NextResponse.json(
      { error: 'Processing failed', message: error.message }, 
      { status: 500 }
    );
  }
}

async function processWebhookEvent(event: Stripe.Event, supabase: any) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase);
      break;
    
    case 'checkout.session.expired':
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session, supabase);
      break;
    
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent, supabase);
      break;
    
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, supabase);
      break;
    
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as Stripe.Charge, supabase);
      break;
    
    case 'charge.dispute.created':
      await handleChargeDisputed(event.data.object as Stripe.Dispute, supabase);
      break;
    
    case 'charge.dispute.closed':
      await handleChargeDisputeClosed(event.data.object as Stripe.Dispute, supabase);
      break;
    
    case 'account.updated':
      await handleAccountUpdated(event.data.object as Stripe.Account, supabase);
      break;
    
    case 'payout.paid':
      await handlePayoutPaid(event.data.object as Stripe.Payout, supabase);
      break;
    
    case 'payout.failed':
      await handlePayoutFailed(event.data.object as Stripe.Payout, supabase);
      break;
    
    default:
      console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: any) {
  if (session.payment_status !== 'paid') {
    console.error(`[WEBHOOK] Checkout completed but payment not paid: ${session.id}`);
    throw new Error('Payment not completed');
  }
  
  const workflowId = session.metadata?.workflow_id;
  const promptId = session.metadata?.prompt_id;
  const buyerId = session.metadata?.buyer_id;
  const creatorId = session.metadata?.creator_id;
  const purchaseType = session.metadata?.purchase_type;
  
  if (!buyerId || (!workflowId && !promptId) || !purchaseType) {
    throw new Error('Missing required metadata');
  }

  const resourceId = workflowId || promptId;
  const table = purchaseType === 'workflow' ? 'workflows' : 'prompts';
  
  const { data: resource } = await supabase
    .from(table)
    .select('owner_id')
    .eq('id', resourceId)
    .single();
  
  if (!resource) {
    throw new Error('Resource not found');
  }
  
  const { data: connectAccount } = await supabase
    .from('stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('user_id', resource.owner_id)
    .single();
  
  const purchaseTable = purchaseType === 'workflow' ? 'workflow_purchases' : 'prompt_purchases';
  const idColumn = purchaseType === 'workflow' ? 'workflow_id' : 'prompt_id';
  
  const platformFeeCents = Math.round((session.amount_total || 0) * 0.20);
  const creatorNetCents = (session.amount_total || 0) - platformFeeCents;

  const { data: purchase, error: purchaseError } = await supabase
    .from(purchaseTable)
    .upsert({
      [idColumn]: resourceId,
      buyer_id: buyerId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent,
      status: 'paid',
      amount_cents: session.amount_total,
      platform_fee_cents: platformFeeCents,
      creator_net_cents: creatorNetCents,
      currency: session.currency,
      payment_method_type: session.payment_method_types?.[0],
      created_at: new Date().toISOString()
    }, {
      onConflict: 'stripe_checkout_session_id',
      ignoreDuplicates: false
    })
    .select()
    .single();
  
  if (purchaseError && purchaseError.code !== '23505') {
    throw purchaseError;
  }
  
  await supabase
    .from('creator_earnings')
    .upsert({
      creator_id: resource.owner_id,
      stripe_account_id: connectAccount?.stripe_account_id,
      purchase_id: purchase?.id || resourceId,
      purchase_type: purchaseType,
      gross_amount_cents: session.amount_total,
      platform_fee_cents: platformFeeCents,
      net_amount_cents: creatorNetCents,
      currency: session.currency,
      status: 'available',
      stripe_payment_intent_id: session.payment_intent as string,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'stripe_payment_intent_id'
    });
  
  await supabase.rpc('increment_creator_balance', {
    creator_id: resource.owner_id,
    amount_cents: creatorNetCents
  });
  
  await supabase.from('audit_logs').insert({
    action: 'purchase.completed',
    actor_id: buyerId,
    resource_type: purchaseType,
    resource_id: resourceId,
    metadata: {
      session_id: session.id,
      amount_cents: session.amount_total
    },
    created_at: new Date().toISOString()
  });
  
  console.log(`[WEBHOOK] Access granted: ${purchaseType} ${resourceId} to user ${buyerId}`);
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session, supabase: any) {
  const workflowId = session.metadata?.workflow_id;
  const promptId = session.metadata?.prompt_id;
  const purchaseType = session.metadata?.purchase_type;

  if (!purchaseType) return;

  const purchaseTable = purchaseType === 'workflow' ? 'workflow_purchases' : 'prompt_purchases';

  await supabase
    .from(purchaseTable)
    .update({ status: 'expired' })
    .eq('stripe_checkout_session_id', session.id);
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  console.log(`[WEBHOOK] Payment succeeded: ${paymentIntent.id}`);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  await supabase.from('payment_failures').insert({
    stripe_payment_intent_id: paymentIntent.id,
    buyer_id: paymentIntent.metadata?.buyer_id,
    workflow_id: paymentIntent.metadata?.workflow_id || null,
    prompt_id: paymentIntent.metadata?.prompt_id || null,
    failure_code: paymentIntent.last_payment_error?.code,
    failure_message: paymentIntent.last_payment_error?.message,
    amount_cents: paymentIntent.amount,
    created_at: new Date().toISOString()
  });
}

async function handleChargeRefunded(charge: Stripe.Charge, supabase: any) {
  const refund = charge.refunds?.data[0];
  if (!refund) return;

  const isFullRefund = refund.amount === charge.amount;

  if (isFullRefund) {
    await supabase
      .from('workflow_purchases')
      .update({ 
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        refund_reason: refund.reason || 'unknown'
      })
      .eq('stripe_payment_intent_id', charge.payment_intent);

    await supabase
      .from('prompt_purchases')
      .update({ 
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        refund_reason: refund.reason || 'unknown'
      })
      .eq('stripe_payment_intent_id', charge.payment_intent);

    await supabase
      .from('creator_earnings')
      .update({ 
        status: 'refunded',
        refunded_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', charge.payment_intent as string);

    const { data: purchase } = await supabase
      .from('workflow_purchases')
      .select('creator_net_cents, workflow_id')
      .eq('stripe_payment_intent_id', charge.payment_intent)
      .single();

    if (purchase) {
      await supabase.rpc('adjust_creator_balance', {
        creator_id: charge.metadata?.creator_id,
        amount_cents: -purchase.creator_net_cents
      });
    }
  } else {
    const platformFeeRefund = Math.round(refund.amount * 0.20);
    const creatorRefund = refund.amount - platformFeeRefund;

    await supabase.rpc('apply_partial_refund', {
      payment_intent_id: charge.payment_intent as string,
      refund_amount: refund.amount,
      platform_fee_refund: platformFeeRefund,
      creator_refund: creatorRefund
    });

    await supabase.rpc('adjust_creator_balance', {
      creator_id: charge.metadata?.creator_id,
      amount_cents: -creatorRefund
    });
  }
}

async function handleChargeDisputed(dispute: Stripe.Dispute, supabase: any) {
  const charge = await stripe.charges.retrieve(dispute.charge as string);

  await supabase
    .from('workflow_purchases')
    .update({ 
      status: 'disputed',
      disputed_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', charge.payment_intent);

  await supabase
    .from('prompt_purchases')
    .update({ 
      status: 'disputed',
      disputed_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', charge.payment_intent);

  const { data: purchase } = await supabase
    .from('workflow_purchases')
    .select('id, buyer_id')
    .eq('stripe_payment_intent_id', charge.payment_intent)
    .single();

  if (purchase) {
    await supabase.from('chargebacks').insert({
      purchase_id: purchase.id,
      purchase_type: 'workflow',
      stripe_charge_id: charge.id,
      stripe_dispute_id: dispute.id,
      dispute_reason: dispute.reason,
      dispute_status: dispute.status,
      amount_cents: dispute.amount,
      created_at: new Date().toISOString()
    });
  }
}

async function handleChargeDisputeClosed(dispute: Stripe.Dispute, supabase: any) {
  const charge = await stripe.charges.retrieve(dispute.charge as string);

  if (dispute.status === 'won') {
    await supabase
      .from('workflow_purchases')
      .update({ status: 'paid' })
      .eq('stripe_payment_intent_id', charge.payment_intent);

    await supabase
      .from('prompt_purchases')
      .update({ status: 'paid' })
      .eq('stripe_payment_intent_id', charge.payment_intent);
  } else if (dispute.status === 'lost') {
    await supabase
      .from('workflow_purchases')
      .update({ status: 'refunded' })
      .eq('stripe_payment_intent_id', charge.payment_intent);

    await supabase
      .from('prompt_purchases')
      .update({ status: 'refunded' })
      .eq('stripe_payment_intent_id', charge.payment_intent);
  }

  await supabase
    .from('chargebacks')
    .update({ 
      dispute_status: dispute.status,
      resolved_at: new Date().toISOString()
    })
    .eq('stripe_dispute_id', dispute.id);
}

async function handleAccountUpdated(account: Stripe.Account, supabase: any) {
  const userId = account.metadata?.edgaze_user_id;
  if (!userId) return;

  await supabase
    .from('stripe_connect_accounts')
    .update({
      account_status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_account_id', account.id);

  if (account.charges_enabled && account.payouts_enabled) {
    await supabase
      .from('profiles')
      .update({
        stripe_onboarding_status: 'completed',
        can_receive_payments: true
      })
      .eq('id', userId);
  }
}

async function handlePayoutPaid(payout: Stripe.Payout, supabase: any) {
  const creatorId = payout.metadata?.edgaze_user_id;
  if (!creatorId) return;

  await supabase.from('creator_payouts').insert({
    creator_id: creatorId,
    stripe_account_id: payout.destination as string,
    stripe_payout_id: payout.id,
    amount_cents: payout.amount,
    currency: payout.currency,
    status: 'paid',
    arrival_date: new Date(payout.arrival_date * 1000).toISOString().split('T')[0],
    paid_at: new Date().toISOString(),
    created_at: new Date(payout.created * 1000).toISOString()
  });

  await supabase
    .from('creator_earnings')
    .update({ 
      status: 'paid',
      paid_at: new Date().toISOString()
    })
    .eq('creator_id', creatorId)
    .eq('status', 'available');
}

async function handlePayoutFailed(payout: Stripe.Payout, supabase: any) {
  const creatorId = payout.metadata?.edgaze_user_id;
  if (!creatorId) return;

  await supabase.from('creator_payouts').insert({
    creator_id: creatorId,
    stripe_account_id: payout.destination as string,
    stripe_payout_id: payout.id,
    amount_cents: payout.amount,
    status: 'failed',
    failure_code: payout.failure_code,
    failure_message: payout.failure_message,
    created_at: new Date(payout.created * 1000).toISOString()
  });
}
