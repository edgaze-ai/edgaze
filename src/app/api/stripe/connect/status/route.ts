import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

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

    const { data: connectAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!connectAccount) {
      return NextResponse.json({
        hasAccount: false,
        status: 'not_started'
      });
    }

    const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);

    const needsUpdate = 
      connectAccount.charges_enabled !== account.charges_enabled ||
      connectAccount.payouts_enabled !== account.payouts_enabled ||
      connectAccount.details_submitted !== account.details_submitted;

    if (needsUpdate) {
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
        .eq('user_id', user.id);

      if (account.charges_enabled && account.payouts_enabled) {
        await supabase
          .from('profiles')
          .update({
            stripe_onboarding_status: 'completed',
            can_receive_payments: true
          })
          .eq('id', user.id);
      }
    }

    return NextResponse.json({
      hasAccount: true,
      accountId: connectAccount.stripe_account_id,
      status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      country: account.country,
      currency: account.default_currency
    });

  } catch (error: any) {
    console.error('[STRIPE CONNECT] Status check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check account status' },
      { status: 500 }
    );
  }
}
