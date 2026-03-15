import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { processStripeWebhookEvent } from "@/lib/stripe/webhook-processing";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const startTime = Date.now();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    console.error("[WEBHOOK] Missing Stripe signature");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error("[WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("[WEBHOOK] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.warn(`[WEBHOOK] Received: ${event.type} (${event.id})`);

  const supabase = createSupabaseAdminClient();

  const { data: existingEvent } = await supabase
    .from("stripe_webhook_events")
    .select("id, processed")
    .eq("stripe_event_id", event.id)
    .single();

  if (existingEvent?.processed) {
    console.warn(`[WEBHOOK] Event ${event.id} already processed, skipping`);
    return NextResponse.json({ received: true, skipped: true });
  }

  const { error: insertError } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object as Stripe.Event.Data.Object,
    processed: false,
    processing_attempts: 0,
  });

  if (insertError?.code === "23505") {
    console.warn(`[WEBHOOK] Event ${event.id} being processed by another worker`);
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    await processStripeWebhookEvent(event, supabase);

    await supabase
      .from("stripe_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_duration_ms: Date.now() - startTime,
        error_message: null,
      })
      .eq("stripe_event_id", event.id);

    console.warn(`[WEBHOOK] Successfully processed ${event.type} in ${Date.now() - startTime}ms`);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`[WEBHOOK] Processing failed for ${event.type}:`, error);

    await supabase.rpc("increment_webhook_attempts", {
      event_id: event.id,
      error_msg: error.message,
    });

    return NextResponse.json(
      { error: "Processing failed", message: error.message },
      { status: 500 },
    );
  }
}
