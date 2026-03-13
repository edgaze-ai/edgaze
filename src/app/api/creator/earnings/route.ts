import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('total_earnings_cents, available_balance_cents')
      .eq('id', user.id)
      .single();

    const { data: earnings } = await supabase
      .from('creator_earnings')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    const { data: payouts } = await supabase
      .from('creator_payouts')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const totalSales = earnings?.length || 0;
    const avgSaleCents = totalSales > 0 
      ? Math.round((profile?.total_earnings_cents || 0) / totalSales)
      : 0;

    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEarnings = earnings?.filter(e => 
      new Date(e.created_at) >= last30Days
    ) || [];

    const nextPayout = payouts?.find(p => p.status === 'pending');

    return NextResponse.json({
      totalEarningsCents: profile?.total_earnings_cents || 0,
      availableBalanceCents: profile?.available_balance_cents || 0,
      totalSales,
      avgSaleCents,
      recentEarnings: recentEarnings.length,
      nextPayout: nextPayout ? {
        amountCents: nextPayout.amount_cents,
        arrivalDate: nextPayout.arrival_date
      } : null,
      recentPayouts: payouts || []
    });

  } catch (error: any) {
    console.error('[CREATOR EARNINGS] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch earnings' },
      { status: 500 }
    );
  }
}
