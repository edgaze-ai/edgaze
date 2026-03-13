import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    const { data: connectAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (!connectAccount) {
      return NextResponse.redirect(new URL('/onboarding?error=account_not_found', req.url));
    }

    const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);

    await supabase
      .from('stripe_connect_accounts')
      .update({
        account_status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_completed_at: account.details_submitted ? new Date().toISOString() : null,
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

      return NextResponse.redirect(new URL('/onboarding/success', req.url));
    } else {
      return NextResponse.redirect(new URL('/onboarding?status=incomplete', req.url));
    }

  } catch (error: any) {
    console.error('[STRIPE CONNECT] Callback error:', error);
    return NextResponse.redirect(new URL('/onboarding?error=verification_failed', req.url));
  }
}
