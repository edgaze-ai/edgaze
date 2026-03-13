/**
 * Subscription status for the current user's connected account
 *
 * Returns subscription status from DB (populated by webhooks).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: sub } = await supabase
      .from('connect_account_subscriptions')
      .select('status, cancel_at_period_end, current_period_end, stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      subscription: sub
        ? {
            status: sub.status,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: sub.current_period_end,
            subscriptionId: sub.stripe_subscription_id,
          }
        : null,
    });
  } catch (error: any) {
    console.error('[STRIPE V2] Subscription status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}
