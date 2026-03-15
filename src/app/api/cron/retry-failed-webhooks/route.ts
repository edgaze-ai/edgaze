import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildReplayStripeEvent, processStripeWebhookEvent } from "@/lib/stripe/webhook-processing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: failedEvents } = await supabase
    .from("stripe_webhook_events")
    .select("*")
    .eq("processed", false)
    .lt("processing_attempts", 5)
    .lt("created_at", new Date(Date.now() - 300000).toISOString())
    .order("created_at", { ascending: true })
    .limit(100);

  if (!failedEvents || failedEvents.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No failed events to retry",
    });
  }

  let successCount = 0;
  let failCount = 0;

  for (const event of failedEvents) {
    try {
      const replayEvent = buildReplayStripeEvent(event);
      const startedAt = Date.now();

      await processStripeWebhookEvent(replayEvent, supabase);

      await supabase
        .from("stripe_webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_duration_ms: Date.now() - startedAt,
          error_message: null,
        })
        .eq("stripe_event_id", event.stripe_event_id);

      successCount++;
    } catch (error: any) {
      failCount++;
      console.error(`Retry failed for event ${event.id}:`, error);

      await supabase.rpc("increment_webhook_attempts", {
        event_id: event.stripe_event_id,
        error_msg: error.message,
      });
    }
  }

  const { data: deadEvents } = await supabase
    .from("stripe_webhook_events")
    .select("*")
    .eq("processed", false)
    .gte("processing_attempts", 5);

  if (deadEvents && deadEvents.length > 0) {
    const deadEventIds = deadEvents.map((event) => event.stripe_event_id);
    const { data: existingDeadLetters } = await supabase
      .from("webhook_dead_letter_queue")
      .select("stripe_event_id")
      .in("stripe_event_id", deadEventIds);

    const existingIds = new Set((existingDeadLetters || []).map((row) => row.stripe_event_id));
    const newDeadLetters = deadEvents.filter((event) => !existingIds.has(event.stripe_event_id));

    if (newDeadLetters.length > 0) {
      await supabase.from("webhook_dead_letter_queue").insert(
        newDeadLetters.map((event) => ({
          stripe_event_id: event.stripe_event_id,
          event_type: event.event_type,
          processing_attempts: event.processing_attempts,
          payload: event.payload,
          error_message: event.error_message,
          last_error_at: event.last_error_at,
          moved_at: new Date().toISOString(),
        })),
      );
    }

    console.error(`[CRON] Moved ${deadEvents.length} events to dead letter queue`);
  }

  return NextResponse.json({
    success: true,
    retriedEvents: failedEvents.length,
    successCount,
    failCount,
    deadLetterQueueCount: deadEvents?.length || 0,
  });
}
