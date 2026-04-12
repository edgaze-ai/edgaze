/**
 * Stripe Thin Events Webhook — optional; standard `account.updated` on the main webhook is primary.
 *
 * If you still route thin events here, we resolve Connect Express accounts via the Accounts API
 * (not Accounts v2). Legacy v2-only account IDs will not match — rely on `account.updated` instead.
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getExpressConnectAccountPayoutStatus } from "@/lib/stripe/connect-marketplace";
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
    const event = stripe.webhooks.constructEvent(body, signature, THIN_SECRET);
    thinEvent = { id: event.id, type: event.type };
  } catch (err: any) {
    console.error("[WEBHOOK THIN] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.warn(`[WEBHOOK THIN] Received: ${thinEvent.type} (${thinEvent.id})`);

  try {
    const fullEvent = await (stripe as any).v2.core.events.retrieve(thinEvent.id);

    const eventType = typeof fullEvent.type === "string" ? fullEvent.type : (fullEvent as any).type;
    const accountId =
      (fullEvent as any).account ||
      (fullEvent as any).context ||
      (fullEvent?.data as any)?.object?.id;

    switch (eventType) {
      case "v2.core.account[requirements].updated":
      case "v2.core.account[configuration.merchant].capability_status_updated":
      case "v2.core.account[.recipient].capability_status_updated":
      case "v2.core.account[configuration.customer].capability_status_updated":
        await syncExpressAccountFromThin(accountId);
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

async function syncExpressAccountFromThin(accountId: string | undefined) {
  if (!accountId) {
    console.warn("[WEBHOOK THIN] No account ID in event");
    return;
  }

  const supabase = createSupabaseAdminClient();

  try {
    const status = await getExpressConnectAccountPayoutStatus(accountId);
    const userId = status.edgazeUserId;

    if (userId) {
      await syncCreatorPayoutAccount({
        supabase,
        creatorId: userId,
        stripeAccountId: accountId,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        detailsSubmitted: status.detailsSubmitted,
        payoutSetupComplete: status.readyForPayouts,
        source: "webhooks.thin",
      });
    } else {
      await supabase
        .from("stripe_connect_accounts")
        .update({
          account_status: status.readyForPayouts ? "active" : "pending",
          charges_enabled: status.chargesEnabled,
          payouts_enabled: status.payoutsEnabled,
          details_submitted: status.detailsSubmitted,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_account_id", accountId);
    }

    console.warn(
      `[WEBHOOK THIN] Updated account ${accountId}: readyForPayouts=${status.readyForPayouts}`,
    );
  } catch (e: any) {
    console.warn(
      `[WEBHOOK THIN] Could not sync ${accountId} as Express (may be legacy v2 id): ${e?.message}`,
    );
  }
}
