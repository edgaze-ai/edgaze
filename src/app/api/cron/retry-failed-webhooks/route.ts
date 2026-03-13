import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  
  const { data: failedEvents } = await supabase
    .from('stripe_webhook_events')
    .select('*')
    .eq('processed', false)
    .lt('processing_attempts', 5)
    .lt('created_at', new Date(Date.now() - 300000).toISOString())
    .order('created_at', { ascending: true })
    .limit(100);

  if (!failedEvents || failedEvents.length === 0) {
    return NextResponse.json({ 
      success: true, 
      message: 'No failed events to retry' 
    });
  }

  let successCount = 0;
  let failCount = 0;

  for (const event of failedEvents) {
    try {
      const stripeEvent: Stripe.Event = {
        id: event.stripe_event_id,
        object: 'event',
        api_version: null,
        created: Math.floor(new Date(event.created_at).getTime() / 1000),
        data: {
          object: event.payload as any
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: event.event_type as any
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'retry'
        },
        body: JSON.stringify(stripeEvent)
      });

      if (response.ok) {
        successCount++;
      } else {
        failCount++;
        await supabase.rpc('increment_webhook_attempts', {
          event_id: event.stripe_event_id,
          error_msg: `Retry failed with status ${response.status}`
        });
      }
    } catch (error: any) {
      failCount++;
      console.error(`Retry failed for event ${event.id}:`, error);
      
      await supabase.rpc('increment_webhook_attempts', {
        event_id: event.stripe_event_id,
        error_msg: error.message
      });
    }
  }

  const { data: deadEvents } = await supabase
    .from('stripe_webhook_events')
    .select('*')
    .eq('processed', false)
    .gte('processing_attempts', 5);

  if (deadEvents && deadEvents.length > 0) {
    await supabase.from('webhook_dead_letter_queue').insert(
      deadEvents.map(e => ({
        stripe_event_id: e.stripe_event_id,
        event_type: e.event_type,
        processing_attempts: e.processing_attempts,
        payload: e.payload,
        error_message: e.error_message,
        last_error_at: e.last_error_at,
        moved_at: new Date().toISOString()
      }))
    );

    console.error(`[CRON] Moved ${deadEvents.length} events to dead letter queue`);
  }

  return NextResponse.json({
    success: true,
    retriedEvents: failedEvents.length,
    successCount,
    failCount,
    deadLetterQueueCount: deadEvents?.length || 0
  });
}
