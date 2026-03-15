/**
 * Stripe Thin Events Webhook - V2 Account Requirements
 *
 * Listens for V2 account requirement and capability updates.
 * Configure in Stripe Dashboard: Developers → Webhooks → Add destination
 * - Events from: Connected accounts
 * - Payload style: Thin
 * - Events: v2.core.account[requirements].updated,
 *           v2.core.account[configuration.merchant].capability_status_updated,
 *           v2.core.account[configuration.customer].capability_status_updated
 *
 * Local testing:
 * stripe listen --thin-events 'v2.core.account[requirements].updated,...' --forward-thin-to http://localhost:3000/api/stripe/webhooks/thin
 *
 * Requires STRIPE_THIN_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET as fallback).
 * @see https://docs.stripe.com/webhooks?snapshot-or-thin=thin
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const THIN_SECRET = process.env.STRIPE_THIN_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!THIN_SECRET) {
    console.error("[WEBHOOK THIN] STRIPE_THIN_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET required");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let thinEvent: { id: string; type: string };

  try {
    // Thin events: payload has id and type. Stripe SDK constructEvent works if payload
    // is valid signed JSON. For thin events, use constructEvent - the payload structure
    // includes id, type, object: "event" etc. If parseThinEvent exists, use it instead.
    const event = stripe.webhooks.constructEvent(body, signature, THIN_SECRET);
    thinEvent = { id: event.id, type: event.type };
  } catch (err: any) {
    console.error("[WEBHOOK THIN] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.warn(`[WEBHOOK THIN] Received: ${thinEvent.type} (${thinEvent.id})`);

  try {
    // Fetch full event from V2 API to get account context and details
    const fullEvent = await (stripe as any).v2.core.events.retrieve(thinEvent.id);

    const eventType = typeof fullEvent.type === "string" ? fullEvent.type : (fullEvent as any).type;
    const accountId =
      (fullEvent as any).account ||
      (fullEvent as any).context ||
      (fullEvent?.data as any)?.object?.id;

    switch (eventType) {
      case "v2.core.account[requirements].updated":
        await handleRequirementsUpdated(accountId);
        break;
      case "v2.core.account[configuration.merchant].capability_status_updated":
      case "v2.core.account[.recipient].capability_status_updated":
      case "v2.core.account[configuration.customer].capability_status_updated":
        await handleCapabilityStatusUpdated(accountId);
        break;
      default:
        console.warn(`[WEBHOOK THIN] Unhandled: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`[WEBHOOK THIN] Processing failed:`, error);
    return NextResponse.json(
      { error: "Processing failed", message: error.message },
      { status: 500 },
    );
  }
}

async function handleRequirementsUpdated(accountId: string | undefined) {
  if (!accountId) {
    console.warn("[WEBHOOK THIN] No account ID in requirements.updated event");
    return;
  }

  const supabase = createSupabaseAdminClient();

  // Fetch latest account status from Stripe API
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements"],
  });

  const merchantConfig = account.configuration?.merchant as
    | { capabilities?: { card_payments?: { status?: string } } }
    | undefined;
  const readyToProcess = merchantConfig?.capabilities?.card_payments?.status === "active";
  const requirementsSummary = account.requirements?.summary as
    | { minimum_deadline?: { status?: string } }
    | undefined;
  const requirementsStatus = requirementsSummary?.minimum_deadline?.status;
  const onboardingComplete =
    requirementsStatus !== "currently_due" && requirementsStatus !== "past_due";
  const payoutsEnabled = readyToProcess && onboardingComplete;
  const userId = (account.metadata as Record<string, string>)?.edgaze_user_id;

  if (userId) {
    await syncCreatorPayoutAccount({
      supabase,
      creatorId: userId,
      stripeAccountId: accountId,
      chargesEnabled: readyToProcess,
      payoutsEnabled,
      detailsSubmitted: onboardingComplete,
      source: "v2.core.account[requirements].updated",
    });
  } else {
    await supabase
      .from("stripe_connect_accounts")
      .update({
        account_status: payoutsEnabled ? "active" : "pending",
        charges_enabled: readyToProcess,
        payouts_enabled: payoutsEnabled,
        details_submitted: onboardingComplete,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_account_id", accountId);
  }

  console.warn(
    `[WEBHOOK THIN] Updated account ${accountId}: ready=${readyToProcess} complete=${onboardingComplete}`,
  );
}

async function handleCapabilityStatusUpdated(accountId: string | undefined) {
  if (!accountId) return;

  const supabase = createSupabaseAdminClient();
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements"],
  });

  const merchantConfig = account.configuration?.merchant as
    | { capabilities?: { card_payments?: { status?: string } } }
    | undefined;
  const readyToProcess = merchantConfig?.capabilities?.card_payments?.status === "active";
  const requirementsSummary = account.requirements?.summary as
    | { minimum_deadline?: { status?: string } }
    | undefined;
  const requirementsStatus = requirementsSummary?.minimum_deadline?.status;
  const onboardingComplete =
    requirementsStatus !== "currently_due" && requirementsStatus !== "past_due";
  const payoutsEnabled = readyToProcess && onboardingComplete;
  const userId = (account.metadata as Record<string, string>)?.edgaze_user_id;

  if (userId) {
    await syncCreatorPayoutAccount({
      supabase,
      creatorId: userId,
      stripeAccountId: accountId,
      chargesEnabled: readyToProcess,
      payoutsEnabled,
      detailsSubmitted: onboardingComplete,
      source: "v2.core.account capability update",
    });
  } else {
    await supabase
      .from("stripe_connect_accounts")
      .update({
        account_status: payoutsEnabled ? "active" : "pending",
        charges_enabled: readyToProcess,
        payouts_enabled: payoutsEnabled,
        details_submitted: onboardingComplete,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_account_id", accountId);
  }

  console.warn(
    `[WEBHOOK THIN] Capability updated for ${accountId}: ready=${readyToProcess} complete=${onboardingComplete}`,
  );
}
