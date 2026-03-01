import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { stripeConfig } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('handle, full_name, email, country')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const { data: existingAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id, account_status, charges_enabled, payouts_enabled')
      .eq('user_id', user.id)
      .single();

    let stripeAccountId: string;

    if (existingAccount) {
      stripeAccountId = existingAccount.stripe_account_id;
      
      if (existingAccount.account_status === 'active' && 
          existingAccount.charges_enabled && 
          existingAccount.payouts_enabled) {
        return NextResponse.json({
          success: true,
          accountId: stripeAccountId,
          status: 'active',
          message: 'Account already active'
        });
      }
    } else {
      const account = await stripe.accounts.create({
        type: 'express',
        country: profile.country || 'US',
        email: profile.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: 'individual',
        business_profile: {
          name: profile.handle,
          product_description: 'AI workflows and prompts on Edgaze',
          url: `${stripeConfig.appUrl}/profile/@${profile.handle}`
        },
        settings: {
          branding: {
            icon: `${stripeConfig.appUrl}/edgaze-icon.png`,
            primary_color: '#22d3ee',
            secondary_color: '#e879f9'
          },
          payouts: {
            schedule: {
              interval: 'weekly',
              weekly_anchor: 'monday'
            }
          }
        },
        metadata: {
          edgaze_user_id: user.id,
          edgaze_handle: profile.handle,
          edgaze_profile_url: `${stripeConfig.appUrl}/profile/@${profile.handle}`
        }
      });

      stripeAccountId = account.id;

      await supabase
        .from('stripe_connect_accounts')
        .insert({
          user_id: user.id,
          stripe_account_id: account.id,
          account_status: 'pending',
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          country: account.country,
          currency: account.default_currency || 'usd'
        });

      await supabase
        .from('profiles')
        .update({ stripe_onboarding_status: 'pending' })
        .eq('id', user.id);
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${stripeConfig.appUrl}/onboarding?refresh=true`,
      return_url: `${stripeConfig.appUrl}/onboarding/success`,
      type: 'account_onboarding',
      collect: 'eventually_due'
    });

    return NextResponse.json({
      success: true,
      url: accountLink.url,
      accountId: stripeAccountId
    });

  } catch (error: any) {
    console.error('[STRIPE CONNECT] Onboarding error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create onboarding link' },
      { status: 500 }
    );
  }
}
