import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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
      .select('stripe_account_id, account_status')
      .eq('user_id', user.id)
      .single();

    if (!connectAccount) {
      return NextResponse.json(
        { error: 'Connect account not found' },
        { status: 404 }
      );
    }

    if (connectAccount.account_status !== 'active') {
      return NextResponse.json(
        { error: 'Account not active yet' },
        { status: 400 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      connectAccount.stripe_account_id
    );

    return NextResponse.json({
      success: true,
      url: loginLink.url
    });

  } catch (error: any) {
    console.error('[STRIPE CONNECT] Dashboard link error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create dashboard link' },
      { status: 500 }
    );
  }
}
