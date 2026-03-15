/**
 * Stripe webhook processing for Edgaze.
 *
 * Fee & payout flow:
 * - 20% platform fee is taken at charge time (application_fee_amount on PaymentIntent).
 * - Creator receives 80% (destination charge: transfer to Connect account; or held as pending_claim if no Connect).
 * - Payouts to creators are automatic: Stripe pays out Connect account balances on schedule (e.g. weekly).
 * - We record payout.paid / payout.failed for dashboard display; Stripe performs the actual bank transfers.
 */
import { createHash } from "crypto";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/stripe/config";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

type StoredWebhookEventRow = {
  stripe_event_id: string;
  event_type: string;
  payload: Stripe.Event.Data.Object;
  created_at: string;
};

type AccountSyncInput = {
  supabase: AdminSupabaseClient;
  creatorId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  source: string;
};

function buildPendingClaimTransferKey(creatorId: string, earningIds: string[]) {
  const digest = createHash("sha256")
    .update(JSON.stringify([creatorId, [...earningIds].sort()]))
    .digest("hex")
    .slice(0, 40);

  return `pending_claim_${digest}`;
}

export function buildReplayStripeEvent(row: StoredWebhookEventRow): Stripe.Event {
  return {
    id: row.stripe_event_id,
    object: "event",
    api_version: null,
    created: Math.floor(new Date(row.created_at).getTime() / 1000),
    data: {
      object: row.payload,
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: row.event_type,
  } as Stripe.Event;
}

export async function syncCreatorPayoutAccount({
  supabase,
  creatorId,
  stripeAccountId,
  chargesEnabled,
  payoutsEnabled,
  detailsSubmitted,
  source,
}: AccountSyncInput) {
  const isActive = chargesEnabled && payoutsEnabled;
  const now = new Date().toISOString();

  await supabase
    .from("stripe_connect_accounts")
    .update({
      account_status: isActive ? "active" : "pending",
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      details_submitted: detailsSubmitted,
      last_verified_at: now,
      updated_at: now,
    })
    .eq("stripe_account_id", stripeAccountId);

  await supabase
    .from("profiles")
    .update({
      stripe_onboarding_status: isActive ? "completed" : "pending",
      can_receive_payments: isActive,
    })
    .eq("id", creatorId);

  if (isActive) {
    await transferPendingClaimEarnings(creatorId, stripeAccountId, supabase, source);
  }
}

export async function transferPendingClaimEarnings(
  creatorId: string,
  stripeAccountId: string,
  supabase: AdminSupabaseClient,
  source: string,
) {
  const { data: claimedRows, error: claimError } = await supabase
    .from("creator_earnings")
    .update({ status: "pending" })
    .eq("creator_id", creatorId)
    .eq("status", "pending_claim")
    .gt("claim_deadline_at", new Date().toISOString())
    .select("id, net_amount_cents");

  if (claimError) {
    throw claimError;
  }

  if (!claimedRows || claimedRows.length === 0) {
    return;
  }

  const earningIds = claimedRows.map((row) => row.id).sort();
  const totalCents = claimedRows.reduce(
    (sum, row) => sum + Math.max(0, row.net_amount_cents || 0),
    0,
  );

  if (totalCents <= 0) {
    await supabase
      .from("creator_earnings")
      .update({ status: "pending_claim" })
      .eq("creator_id", creatorId)
      .eq("status", "pending")
      .in("id", earningIds);
    return;
  }

  const idempotencyKey = buildPendingClaimTransferKey(creatorId, earningIds);

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: totalCents,
        currency: "usd",
        destination: stripeAccountId,
        metadata: {
          edgaze_creator_id: creatorId,
          source,
          earning_count: String(earningIds.length),
        },
      },
      {
        idempotencyKey,
      },
    );

    const { data: activatedRows, error: activateError } = await supabase
      .from("creator_earnings")
      .update({
        status: "available",
        stripe_account_id: stripeAccountId,
        stripe_transfer_id: transfer.id,
      })
      .eq("creator_id", creatorId)
      .eq("status", "pending")
      .in("id", earningIds)
      .select("id, net_amount_cents");

    if (activateError) {
      throw activateError;
    }

    const activatedTotal = (activatedRows || []).reduce(
      (sum, row) => sum + Math.max(0, row.net_amount_cents || 0),
      0,
    );

    if (activatedTotal > 0) {
      await supabase.rpc("increment_creator_balance", {
        creator_id: creatorId,
        amount_cents: activatedTotal,
      });
    }

    console.warn(
      `[WEBHOOK] Transferred ${activatedTotal} cents pending claim to creator ${creatorId} via ${source}`,
    );
  } catch (error) {
    await supabase
      .from("creator_earnings")
      .update({ status: "pending_claim" })
      .eq("creator_id", creatorId)
      .eq("status", "pending")
      .in("id", earningIds);

    throw error;
  }
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  supabase: AdminSupabaseClient,
) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase);
      break;

    case "checkout.session.expired":
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session, supabase);
      break;

    case "payment_intent.succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, supabase);
      break;

    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge, supabase);
      break;

    case "charge.dispute.created":
      await handleChargeDisputed(event.data.object as Stripe.Dispute, supabase);
      break;

    case "charge.dispute.closed":
      await handleChargeDisputeClosed(event.data.object as Stripe.Dispute, supabase);
      break;

    case "account.updated":
      await handleAccountUpdated(event.data.object as Stripe.Account, supabase);
      break;

    case "payout.paid":
      await handlePayoutPaid(event, event.data.object as Stripe.Payout, supabase);
      break;

    case "payout.failed":
      await handlePayoutFailed(event, event.data.object as Stripe.Payout, supabase);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase);
      break;

    case "payment_method.attached":
    case "payment_method.detached":
    case "customer.updated":
    case "customer.tax_id.created":
    case "customer.tax_id.updated":
    case "customer.tax_id.deleted":
    case "billing_portal.configuration.created":
    case "billing_portal.configuration.updated":
    case "billing_portal.session.created":
      console.warn(`[WEBHOOK] ${event.type} - no DB action`);
      break;

    default:
      console.warn(`[WEBHOOK] Unhandled event type: ${event.type}`);
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: AdminSupabaseClient,
) {
  if (session.payment_status !== "paid") {
    console.error(`[WEBHOOK] Checkout completed but payment not paid: ${session.id}`);
    throw new Error("Payment not completed");
  }

  if (session.mode === "subscription") {
    return;
  }

  const workflowId = session.metadata?.workflow_id;
  const promptId = session.metadata?.prompt_id;
  const buyerId = session.metadata?.buyer_id;
  const purchaseType = session.metadata?.purchase_type;
  const sourceTable = session.metadata?.source_table;

  if (!buyerId || (!workflowId && !promptId) || !purchaseType) {
    throw new Error("Missing required metadata");
  }

  const resourceId = workflowId || promptId;
  const table =
    sourceTable === "prompts" ? "prompts" : purchaseType === "workflow" ? "workflows" : "prompts";

  const { data: resource } = await supabase
    .from(table)
    .select("owner_id")
    .eq("id", resourceId)
    .single();

  if (!resource) {
    throw new Error("Resource not found");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) {
    throw new Error("Missing payment_intent");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const isPlatformHeld = !paymentIntent.transfer_data?.destination;

  // Use actual application_fee from Stripe when set (destination/direct charge); else derive from config
  const amountTotal = session.amount_total ?? 0;
  const platformFeePercent = stripeConfig.platformFeePercentage / 100;
  let platformFeeCents =
    typeof paymentIntent.application_fee_amount === "number" &&
    paymentIntent.application_fee_amount >= 0
      ? paymentIntent.application_fee_amount
      : Math.round(amountTotal * platformFeePercent);
  platformFeeCents = Math.min(platformFeeCents, amountTotal);
  const creatorNetCents = Math.max(0, amountTotal - platformFeeCents);

  const { data: connectAccount } = await supabase
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("user_id", resource.owner_id)
    .single();

  const purchaseTable =
    sourceTable === "prompts"
      ? "prompt_purchases"
      : purchaseType === "workflow"
        ? "workflow_purchases"
        : "prompt_purchases";
  const idColumn = purchaseTable === "workflow_purchases" ? "workflow_id" : "prompt_id";

  const { data: purchase, error: purchaseError } = await supabase
    .from(purchaseTable)
    .upsert(
      {
        [idColumn]: resourceId,
        buyer_id: buyerId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        status: "paid",
        amount_cents: session.amount_total,
        platform_fee_cents: platformFeeCents,
        creator_net_cents: creatorNetCents,
        currency: session.currency,
        payment_method_type: session.payment_method_types?.[0],
        created_at: new Date().toISOString(),
      },
      {
        onConflict: "stripe_checkout_session_id",
        ignoreDuplicates: false,
      },
    )
    .select()
    .single();

  if (purchaseError && purchaseError.code !== "23505") {
    throw purchaseError;
  }

  const claimDeadline = isPlatformHeld
    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await supabase.from("creator_earnings").upsert(
    {
      creator_id: resource.owner_id,
      stripe_account_id: isPlatformHeld ? null : connectAccount?.stripe_account_id,
      purchase_id: purchase?.id || resourceId,
      purchase_type: purchaseType,
      gross_amount_cents: session.amount_total,
      platform_fee_cents: platformFeeCents,
      net_amount_cents: creatorNetCents,
      currency: session.currency,
      status: isPlatformHeld ? "pending_claim" : "available",
      claim_deadline_at: claimDeadline,
      stripe_payment_intent_id: paymentIntentId,
      created_at: new Date().toISOString(),
    },
    {
      onConflict: "stripe_payment_intent_id",
    },
  );

  if (!isPlatformHeld) {
    await supabase.rpc("increment_creator_balance", {
      creator_id: resource.owner_id,
      amount_cents: creatorNetCents,
    });
  }

  await supabase.from("audit_logs").insert({
    action: "purchase.completed",
    actor_id: buyerId,
    resource_type: purchaseType,
    resource_id: resourceId,
    metadata: {
      session_id: session.id,
      amount_cents: session.amount_total,
      platform_held: isPlatformHeld,
    },
    created_at: new Date().toISOString(),
  });

  console.warn(
    `[WEBHOOK] Access granted: ${purchaseType} ${resourceId} to user ${buyerId} (platform_held=${isPlatformHeld})`,
  );
}

async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
  supabase: AdminSupabaseClient,
) {
  const purchaseType = session.metadata?.purchase_type;
  const sourceTable = session.metadata?.source_table;

  if (!purchaseType) return;

  const purchaseTable =
    sourceTable === "prompts"
      ? "prompt_purchases"
      : purchaseType === "workflow"
        ? "workflow_purchases"
        : "prompt_purchases";

  await supabase
    .from(purchaseTable)
    .update({ status: "expired" })
    .eq("stripe_checkout_session_id", session.id);
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.warn(`[WEBHOOK] Payment succeeded: ${paymentIntent.id}`);
}

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  supabase: AdminSupabaseClient,
) {
  await supabase.from("payment_failures").insert({
    stripe_payment_intent_id: paymentIntent.id,
    buyer_id: paymentIntent.metadata?.buyer_id,
    workflow_id: paymentIntent.metadata?.workflow_id || null,
    prompt_id: paymentIntent.metadata?.prompt_id || null,
    failure_code: paymentIntent.last_payment_error?.code,
    failure_message: paymentIntent.last_payment_error?.message,
    amount_cents: paymentIntent.amount,
    created_at: new Date().toISOString(),
  });
}

async function handleChargeRefunded(charge: Stripe.Charge, supabase: AdminSupabaseClient) {
  const refund = charge.refunds?.data[0];
  if (!refund) return;

  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const { data: earning } = await supabase
    .from("creator_earnings")
    .select("id, status, creator_id, net_amount_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .single();

  const isFullRefund = refund.amount === charge.amount;

  if (isFullRefund) {
    await supabase
      .from("workflow_purchases")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        refund_reason: refund.reason || "unknown",
      })
      .eq("stripe_payment_intent_id", paymentIntentId);

    await supabase
      .from("prompt_purchases")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        refund_reason: refund.reason || "unknown",
      })
      .eq("stripe_payment_intent_id", paymentIntentId);

    const newStatus = earning?.status === "pending_claim" ? "cancelled" : "refunded";
    await supabase
      .from("creator_earnings")
      .update({
        status: newStatus,
        refunded_at: new Date().toISOString(),
      })
      .eq("stripe_payment_intent_id", paymentIntentId);

    if (earning && earning.status !== "pending_claim" && earning.status !== "cancelled") {
      await supabase.rpc("adjust_creator_balance", {
        creator_id: earning.creator_id,
        amount_cents: -(earning.net_amount_cents || 0),
      });
    }
  } else {
    const platformFeePercent = stripeConfig.platformFeePercentage / 100;
    const platformFeeRefund = Math.round(refund.amount * platformFeePercent);
    const creatorRefund = refund.amount - platformFeeRefund;

    await supabase.rpc("apply_partial_refund", {
      payment_intent_id: paymentIntentId,
      refund_amount: refund.amount,
      platform_fee_refund: platformFeeRefund,
      creator_refund: creatorRefund,
    });

    if (earning && earning.status !== "pending_claim" && earning.status !== "cancelled") {
      await supabase.rpc("adjust_creator_balance", {
        creator_id: charge.metadata?.creator_id || earning.creator_id,
        amount_cents: -creatorRefund,
      });
    } else if (earning?.status === "pending_claim") {
      const { data: currentEarning } = await supabase
        .from("creator_earnings")
        .select("net_amount_cents")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .single();

      const newNet = Math.max(0, (currentEarning?.net_amount_cents || 0) - creatorRefund);

      await supabase
        .from("creator_earnings")
        .update({ net_amount_cents: newNet })
        .eq("stripe_payment_intent_id", paymentIntentId);

      if (newNet <= 0) {
        await supabase
          .from("creator_earnings")
          .update({ status: "cancelled", refunded_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", paymentIntentId);
      }
    }
  }
}

async function handleChargeDisputed(dispute: Stripe.Dispute, supabase: AdminSupabaseClient) {
  const charge = await stripe.charges.retrieve(dispute.charge as string);

  await supabase
    .from("workflow_purchases")
    .update({
      status: "disputed",
      disputed_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", charge.payment_intent);

  await supabase
    .from("prompt_purchases")
    .update({
      status: "disputed",
      disputed_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", charge.payment_intent);

  const { data: purchase } = await supabase
    .from("workflow_purchases")
    .select("id, buyer_id")
    .eq("stripe_payment_intent_id", charge.payment_intent)
    .single();

  if (purchase) {
    await supabase.from("chargebacks").insert({
      purchase_id: purchase.id,
      purchase_type: "workflow",
      stripe_charge_id: charge.id,
      stripe_dispute_id: dispute.id,
      dispute_reason: dispute.reason,
      dispute_status: dispute.status,
      amount_cents: dispute.amount,
      created_at: new Date().toISOString(),
    });
  }
}

async function handleChargeDisputeClosed(dispute: Stripe.Dispute, supabase: AdminSupabaseClient) {
  const charge = await stripe.charges.retrieve(dispute.charge as string);

  if (dispute.status === "won") {
    await supabase
      .from("workflow_purchases")
      .update({ status: "paid" })
      .eq("stripe_payment_intent_id", charge.payment_intent);

    await supabase
      .from("prompt_purchases")
      .update({ status: "paid" })
      .eq("stripe_payment_intent_id", charge.payment_intent);
  } else if (dispute.status === "lost") {
    await supabase
      .from("workflow_purchases")
      .update({ status: "refunded" })
      .eq("stripe_payment_intent_id", charge.payment_intent);

    await supabase
      .from("prompt_purchases")
      .update({ status: "refunded" })
      .eq("stripe_payment_intent_id", charge.payment_intent);
  }

  await supabase
    .from("chargebacks")
    .update({
      dispute_status: dispute.status,
      resolved_at: new Date().toISOString(),
    })
    .eq("stripe_dispute_id", dispute.id);
}

async function handleAccountUpdated(account: Stripe.Account, supabase: AdminSupabaseClient) {
  const { data: connectRow } = await supabase
    .from("stripe_connect_accounts")
    .select("user_id")
    .eq("stripe_account_id", account.id)
    .single();

  const userId = connectRow?.user_id ?? account.metadata?.edgaze_user_id;
  if (!userId) return;

  await syncCreatorPayoutAccount({
    supabase,
    creatorId: userId,
    stripeAccountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    source: "account.updated",
  });
}

async function handlePayoutPaid(
  event: Stripe.Event,
  payout: Stripe.Payout,
  supabase: AdminSupabaseClient,
) {
  // Connect: event.account is the connected account id when event is for that account
  const stripeAccountId = (event as Stripe.Event & { account?: string }).account;
  let creatorId = payout.metadata?.edgaze_user_id as string | undefined;
  if (!creatorId && stripeAccountId) {
    const { data: row } = await supabase
      .from("stripe_connect_accounts")
      .select("user_id")
      .eq("stripe_account_id", stripeAccountId)
      .single();
    creatorId = row?.user_id;
  }
  if (!creatorId) {
    console.warn("[WEBHOOK] payout.paid: no creator_id (metadata or account), skipping DB record");
    return;
  }

  await supabase.from("creator_payouts").insert({
    creator_id: creatorId,
    stripe_account_id: stripeAccountId || payout.destination,
    stripe_payout_id: payout.id,
    amount_cents: payout.amount,
    currency: payout.currency ?? "usd",
    status: "paid",
    arrival_date: payout.arrival_date
      ? new Date(payout.arrival_date * 1000).toISOString().split("T")[0]
      : null,
    paid_at: new Date().toISOString(),
    created_at: new Date(payout.created * 1000).toISOString(),
  });

  await supabase
    .from("creator_earnings")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("creator_id", creatorId)
    .eq("status", "available");
}

async function handlePayoutFailed(
  event: Stripe.Event,
  payout: Stripe.Payout,
  supabase: AdminSupabaseClient,
) {
  const stripeAccountId = (event as Stripe.Event & { account?: string }).account;
  let creatorId = payout.metadata?.edgaze_user_id as string | undefined;
  if (!creatorId && stripeAccountId) {
    const { data: row } = await supabase
      .from("stripe_connect_accounts")
      .select("user_id")
      .eq("stripe_account_id", stripeAccountId)
      .single();
    creatorId = row?.user_id;
  }
  if (!creatorId) {
    console.warn("[WEBHOOK] payout.failed: no creator_id, skipping DB record");
    return;
  }

  await supabase.from("creator_payouts").insert({
    creator_id: creatorId,
    stripe_account_id: stripeAccountId || payout.destination,
    stripe_payout_id: payout.id,
    amount_cents: payout.amount,
    currency: payout.currency ?? "usd",
    status: "failed",
    failure_code: payout.failure_code ?? null,
    failure_message: payout.failure_message ?? null,
    created_at: new Date(payout.created * 1000).toISOString(),
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription, supabase: AdminSupabaseClient) {
  const accountId = (sub as { customer_account?: string }).customer_account || sub.customer;
  if (!accountId || typeof accountId !== "string") return;

  const { data: connectAccount } = await supabase
    .from("stripe_connect_accounts")
    .select("user_id")
    .eq("stripe_account_id", accountId)
    .single();

  if (!connectAccount) return;

  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id;
  const quantity = item?.quantity ?? 1;
  const currentPeriodEnd = (sub as { current_period_end?: number }).current_period_end;

  await supabase.from("connect_account_subscriptions").upsert(
    {
      stripe_account_id: accountId,
      user_id: connectAccount.user_id,
      stripe_subscription_id: sub.id,
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : (sub.customer as { id?: string })?.id,
      status: sub.status as string,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      price_id: priceId,
      quantity,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "stripe_account_id",
    },
  );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription, supabase: AdminSupabaseClient) {
  const accountId = (sub as { customer_account?: string }).customer_account || sub.customer;
  if (!accountId || typeof accountId !== "string") return;

  await supabase
    .from("connect_account_subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", accountId);
}
