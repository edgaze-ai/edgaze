// GET /api/onboarding - Get current user's onboarding state
// PUT /api/onboarding - Update onboarding state

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getOnboardingState, updateOnboardingStep, completeOnboarding } from '@/lib/invites';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get onboarding state
    const onboarding = await getOnboardingState(user.id);

    if (!onboarding) {
      return NextResponse.json({ error: 'No onboarding found' }, { status: 404 });
    }

    return NextResponse.json({ onboarding });
  } catch (error: any) {
    console.error('Error fetching onboarding:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { step, stripe_choice, stripe_account_id, stripe_status, profile_completed, complete } = body;

    // If complete flag is set, mark onboarding as done
    if (complete) {
      const result = await completeOnboarding(user.id);
      if (!result.success) {
        return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Update onboarding step
    const result = await updateOnboardingStep(user.id, step, {
      stripe_choice,
      stripe_account_id,
      stripe_status,
      profile_completed,
    });

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to update onboarding' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating onboarding:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
