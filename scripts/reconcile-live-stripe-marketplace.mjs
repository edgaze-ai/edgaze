#!/usr/bin/env node

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

function parseArgs(argv) {
  const args = {
    since: null,
    limit: 100,
    apply: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--since") {
      args.since = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      args.limit = Number.parseInt(argv[i + 1] ?? "100", 10) || 100;
      i += 1;
    }
  }

  return args;
}

function resolveSinceEpoch(sinceArg) {
  if (!sinceArg || sinceArg === "today") {
    const now = new Date();
    const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor(utcMidnight / 1000);
  }

  if (/^\d+$/.test(sinceArg)) {
    return Number.parseInt(sinceArg, 10);
  }

  const parsed = new Date(sinceArg);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --since value: ${sinceArg}`);
  }
  return Math.floor(parsed.getTime() / 1000);
}

function paymentSplit(amountCents, metadata) {
  const amount = Math.max(0, amountCents || 0);
  const feeFromMetadata = Number.parseInt(metadata?.platform_fee_cents || "", 10);
  const platformFeeCents = Number.isFinite(feeFromMetadata)
    ? Math.max(0, Math.min(amount, feeFromMetadata))
    : Math.round(amount * 0.2);
  return {
    platformFeeCents,
    creatorNetCents: Math.max(0, amount - platformFeeCents),
  };
}

function purchaseTarget(metadata) {
  const purchaseType = metadata?.purchase_type || null;
  const sourceTable = metadata?.source_table || null;
  const resourceId = metadata?.workflow_id || metadata?.prompt_id || null;

  const purchaseTable =
    sourceTable === "prompts"
      ? "prompt_purchases"
      : purchaseType === "workflow"
        ? "workflow_purchases"
        : "prompt_purchases";
  const idColumn = purchaseTable === "workflow_purchases" ? "workflow_id" : "prompt_id";

  return {
    purchaseType,
    purchaseTable,
    idColumn,
    resourceId,
  };
}

function transferIdempotencyKey(paymentIntentId, stripeAccountId, amountCents) {
  const digest = crypto
    .createHash("sha256")
    .update(`v2:${paymentIntentId}:${stripeAccountId}:${amountCents}`)
    .digest("hex")
    .slice(0, 40);
  return `repair_transfer_${digest}`;
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function isReadyForMarketplaceTransfers(account) {
  if (account?.requirements?.disabled_reason) return false;
  if (!account?.details_submitted) return false;
  const transfers = account?.capabilities?.transfers ?? null;
  if (transfers === "inactive") return false;
  return true;
}

async function main() {
  const { since, limit, apply } = parseArgs(process.argv);
  const sinceEpoch = resolveSinceEpoch(since);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing STRIPE_SECRET_KEY or Supabase environment variables");
  }

  const stripe = new Stripe(stripeKey);
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const sessions = await stripe.checkout.sessions.list({
    created: { gte: sinceEpoch },
    limit,
  });

  const candidates = sessions.data.filter(
    (session) =>
      session.livemode === true &&
      session.mode === "payment" &&
      session.payment_status === "paid" &&
      !!session.payment_intent &&
      !!session.metadata?.buyer_id &&
      !!session.metadata?.creator_id &&
      !!session.metadata?.purchase_type,
  );

  const summary = {
    scanned: candidates.length,
    repairedPurchases: 0,
    repairedEarnings: 0,
    repairedTransfers: 0,
    alreadyHealthy: 0,
    skipped: 0,
    failures: [],
  };

  for (const session of candidates) {
    try {
      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
      const metadata = session.metadata || {};
      const creatorId = metadata.creator_id;
      const buyerId = metadata.buyer_id;
      const { purchaseType, purchaseTable, idColumn, resourceId } = purchaseTarget(metadata);

      if (!paymentIntentId || !creatorId || !buyerId || !purchaseType || !resourceId) {
        summary.skipped += 1;
        continue;
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const latestChargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id || null;
      const amountCents = session.amount_total || paymentIntent.amount || 0;
      const { platformFeeCents, creatorNetCents } = paymentSplit(amountCents, metadata);

      const [
        { data: connectRow },
        { data: existingPurchase },
        { data: existingEarning },
        { data: existingBuyerResourcePurchase },
      ] =
        await Promise.all([
          supabase
            .from("stripe_connect_accounts")
            .select(
              "stripe_account_id, account_status, charges_enabled, payouts_enabled, details_submitted",
            )
            .eq("user_id", creatorId)
            .maybeSingle(),
          supabase
            .from(purchaseTable)
            .select("id, status, stripe_checkout_session_id, stripe_payment_intent_id")
            .eq("stripe_checkout_session_id", session.id)
            .maybeSingle(),
          supabase
            .from("creator_earnings")
            .select("id, status, stripe_transfer_id, stripe_account_id")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .maybeSingle(),
          supabase
            .from(purchaseTable)
            .select("id, status, stripe_checkout_session_id, stripe_payment_intent_id")
            .eq(idColumn, resourceId)
            .eq("buyer_id", buyerId)
            .maybeSingle(),
        ]);

      let purchaseId = existingPurchase?.id || null;

      let connectAccount = null;
      let connectReady = false;

      if (connectRow?.stripe_account_id) {
        connectAccount = await stripe.accounts.retrieve(connectRow.stripe_account_id);
        connectReady = isReadyForMarketplaceTransfers(connectAccount);
      }

      const paymentDestination =
        typeof paymentIntent.transfer_data?.destination === "string"
          ? paymentIntent.transfer_data.destination
          : paymentIntent.transfer_data?.destination?.id || null;

      const targetStripeAccountId = paymentDestination || connectRow?.stripe_account_id || null;
      const shouldHoldOnPlatform = !paymentDestination;

      if (!existingPurchase && apply) {
        const purchasePayload = {
          [idColumn]: resourceId,
          buyer_id: buyerId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
          status: "paid",
          amount_cents: amountCents,
          platform_fee_cents: platformFeeCents,
          creator_net_cents: creatorNetCents,
          payment_method_type: session.payment_method_types?.[0] || null,
          created_at: new Date(session.created * 1000).toISOString(),
        };

        if (purchaseTable === "workflow_purchases") {
          purchasePayload.currency = session.currency || null;
        }

        const purchaseWrite = existingBuyerResourcePurchase?.id
          ? supabase
              .from(purchaseTable)
              .update(purchasePayload)
              .eq("id", existingBuyerResourcePurchase.id)
              .select("id")
              .maybeSingle()
          : supabase
              .from(purchaseTable)
              .upsert(purchasePayload, {
                onConflict: "stripe_checkout_session_id",
              })
              .select("id")
              .maybeSingle();

        const { data, error } = await purchaseWrite;
        if (error) throw error;
        purchaseId = data?.id || purchaseId;
        summary.repairedPurchases += 1;
      }

      let earningId = existingEarning?.id || null;
      let earningStatus = existingEarning?.status || null;
      let earningTransferId = existingEarning?.stripe_transfer_id || null;

      if (!existingEarning && apply) {
        const { data, error } = await supabase
          .from("creator_earnings")
          .upsert(
            {
              creator_id: creatorId,
              stripe_account_id: shouldHoldOnPlatform ? null : targetStripeAccountId,
              purchase_id: purchaseId || resourceId,
              purchase_type: purchaseType,
              gross_amount_cents: amountCents,
              platform_fee_cents: platformFeeCents,
              net_amount_cents: creatorNetCents,
              currency: session.currency,
              status: shouldHoldOnPlatform ? "pending_claim" : "available",
              claim_deadline_at: shouldHoldOnPlatform
                ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
                : null,
              stripe_payment_intent_id: paymentIntentId,
              created_at: new Date(session.created * 1000).toISOString(),
            },
            { onConflict: "stripe_payment_intent_id" },
          )
          .select("id, status, stripe_transfer_id")
          .maybeSingle();
        if (error) throw error;
        earningId = data?.id || earningId;
        earningStatus = data?.status || earningStatus;
        earningTransferId = data?.stripe_transfer_id || earningTransferId;
        summary.repairedEarnings += 1;

        if (paymentDestination && creatorNetCents > 0) {
          await supabase.rpc("increment_creator_balance", {
            creator_id: creatorId,
            amount_cents: creatorNetCents,
          });
        }
      }

      const needsRepairTransfer =
        creatorNetCents > 0 &&
        connectReady &&
        !!connectRow?.stripe_account_id &&
        !paymentDestination &&
        !!earningId &&
        earningStatus === "pending_claim" &&
        !earningTransferId;

      if (needsRepairTransfer && apply) {
        const transfer = await stripe.transfers.create(
          {
            amount: creatorNetCents,
            currency: session.currency || "usd",
            destination: connectRow.stripe_account_id,
            ...(latestChargeId ? { source_transaction: latestChargeId } : {}),
            metadata: {
              repair_source: "reconcile-live-stripe-marketplace",
              creator_id: creatorId,
              payment_intent_id: paymentIntentId,
              checkout_session_id: session.id,
              purchase_type: purchaseType,
            },
          },
          {
            idempotencyKey: transferIdempotencyKey(
              paymentIntentId,
              connectRow.stripe_account_id,
              creatorNetCents,
            ),
          },
        );

        const { error } = await supabase
          .from("creator_earnings")
          .update({
            status: "available",
            stripe_account_id: connectRow.stripe_account_id,
            stripe_transfer_id: transfer.id,
            claim_deadline_at: null,
          })
          .eq("id", earningId)
          .eq("status", "pending_claim");
        if (error) throw error;

        await supabase.rpc("increment_creator_balance", {
          creator_id: creatorId,
          amount_cents: creatorNetCents,
        });

        summary.repairedTransfers += 1;
      }

      if (
        existingPurchase &&
        existingEarning &&
        (paymentDestination || existingEarning.status === "available" || earningTransferId)
      ) {
        summary.alreadyHealthy += 1;
      }

      if (!apply) {
        const statusLabel = needsRepairTransfer
          ? "would_create_transfer"
          : !existingPurchase || !existingEarning
            ? "would_backfill_records"
            : "healthy_or_pending";
        writeJson({
          sessionId: session.id,
          paymentIntentId,
          creatorId,
          purchaseType,
          resourceId,
          connectAccountId: connectRow?.stripe_account_id || null,
          connectReady,
          paymentDestination,
          existingPurchase: !!existingPurchase,
          existingEarning: !!existingEarning,
          earningStatus,
          status: statusLabel,
        });
      }
    } catch (error) {
      summary.failures.push({
        sessionId: session.id,
        error: formatError(error),
      });
    }
  }

  writeJson({ sinceEpoch, apply, summary });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
