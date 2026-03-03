// Creator Invite Token Management
// Handles token generation, hashing, and validation

import { createServerClient } from './supabase/server';
import { createSupabaseBrowserClient } from './supabase/browser';
import { createSupabaseAdminClient } from './supabase/admin';

/**
 * Generate a cryptographically secure invite token
 * Format: base64url(uuid + timestamp)
 */
export function generateInviteToken(): string {
  const uuid = crypto.randomUUID();
  const timestamp = Date.now().toString(36);
  const raw = `${uuid}-${timestamp}`;
  
  // Base64url encode (URL-safe) - browser compatible
  if (typeof Buffer !== 'undefined') {
    // Node.js environment
    return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } else {
    // Browser environment
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}

/**
 * Hash a token using SHA-256
 * This is what we store in the database
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate and look up an invite by token (server-side)
 * Uses admin client to bypass RLS
 */
export async function validateInviteToken(token: string) {
  const supabase = createSupabaseAdminClient();
  
  console.log('[validateInviteToken] Input token:', token);
  console.log('[validateInviteToken] Token length:', token.length);
  
  const tokenHash = await hashToken(token);
  console.log('[validateInviteToken] Generated hash:', tokenHash);

  const { data: invite, error } = await supabase
    .from('creator_invites')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  console.log('[validateInviteToken] Query result:', { found: !!invite, error: error?.message });

  if (error || !invite) {
    // Try to find by raw_token as fallback
    const { data: inviteByRaw } = await supabase
      .from('creator_invites')
      .select('*')
      .eq('raw_token', token)
      .maybeSingle();
    
    console.log('[validateInviteToken] Fallback lookup by raw_token:', { found: !!inviteByRaw });
    
    if (inviteByRaw) {
      console.log('[validateInviteToken] Found by raw_token! Using that invite.');
      return validateInviteStatus(inviteByRaw, supabase);
    }
    
    return { valid: false, reason: 'invalid' as const, invite: null };
  }
  
  return validateInviteStatus(invite, supabase);
}

async function validateInviteStatus(invite: any, supabase: any) {

  // Check expiry
  if (invite.status === 'expired' || new Date(invite.expires_at) < new Date()) {
    console.log('[validateInviteStatus] Invite expired');
    // Auto-expire if not already
    if (invite.status === 'active') {
      await supabase
        .from('creator_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);
    }
    return { valid: false, reason: 'expired' as const, invite };
  }

  // Check revoked
  if (invite.status === 'revoked') {
    console.log('[validateInviteStatus] Invite revoked');
    return { valid: false, reason: 'revoked' as const, invite };
  }

  // Check completed
  if (invite.status === 'completed') {
    console.log('[validateInviteStatus] Invite completed');
    return { valid: false, reason: 'completed' as const, invite };
  }

  // For claimed invites, we'll let the frontend handle checking if it's the same user
  // The admin client doesn't have user context
  if (invite.status === 'claimed') {
    console.log('[validateInviteStatus] Invite claimed, returning for frontend to check user');
    return { valid: true, reason: null, invite };
  }

  console.log('[validateInviteStatus] Invite is valid!');
  return { valid: true, reason: null, invite };
}

/**
 * Validate and look up an invite by token (client-side)
 * Used for initial validation before auth
 */
export async function validateInviteTokenClient(token: string) {
  const response = await fetch(`/api/invite-token/${encodeURIComponent(token)}/validate`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ reason: 'invalid' }));
    return { valid: false, reason: error.reason || 'invalid', invite: null };
  }

  const data = await response.json();
  return data;
}

/**
 * Claim an invite token (mark as claimed by current user)
 */
export async function claimInviteToken(token: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const tokenHash = await hashToken(token);

  const { data: invite, error: fetchError } = await supabase
    .from('creator_invites')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (fetchError || !invite) {
    return { success: false, error: 'Invite not found' };
  }

  if (invite.status !== 'active' && invite.status !== 'claimed') {
    return { success: false, error: 'Invite is no longer active' };
  }

  // Claim the invite
  const { error: updateError } = await supabase
    .from('creator_invites')
    .update({
      status: 'claimed',
      claimed_by_user_id: userId,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateError) {
    return { success: false, error: 'Failed to claim invite' };
  }

  // Create onboarding record
  const { error: onboardingError } = await supabase
    .from('creator_onboarding')
    .insert({
      user_id: userId,
      invite_id: invite.id,
      step: 'profile', // Skip welcome/message/auth since they just signed up
    });

  if (onboardingError) {
    console.error('Failed to create onboarding record:', onboardingError);
  }

  return { success: true, invite };
}

/**
 * Resume an existing onboarding session
 */
export async function getOnboardingState(userId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: onboarding, error } = await supabase
    .from('creator_onboarding')
    .select('*, invite:creator_invites(*)')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !onboarding) {
    return null;
  }

  return onboarding;
}

/**
 * Update onboarding step
 */
export async function updateOnboardingStep(
  userId: string,
  step: 'welcome' | 'message' | 'auth' | 'profile' | 'stripe' | 'done',
  additionalData?: {
    stripe_choice?: 'now' | 'later';
    stripe_account_id?: string;
    stripe_status?: 'not_started' | 'in_progress' | 'complete' | 'restricted';
    profile_completed?: boolean;
  }
) {
  const supabase = createSupabaseAdminClient();

  const updateData: any = { step };
  if (additionalData) {
    Object.assign(updateData, additionalData);
  }

  const { error } = await supabase
    .from('creator_onboarding')
    .update(updateData)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to update onboarding step:', error);
    return { success: false, error };
  }

  return { success: true };
}

/**
 * Mark onboarding as complete
 */
export async function completeOnboarding(userId: string) {
  const supabase = createSupabaseAdminClient();

  // Update onboarding
  await supabase
    .from('creator_onboarding')
    .update({ step: 'done' })
    .eq('user_id', userId);

  // Mark invite as completed
  const { data: onboarding } = await supabase
    .from('creator_onboarding')
    .select('invite_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (onboarding?.invite_id) {
    await supabase
      .from('creator_invites')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', onboarding.invite_id);
  }

  return { success: true };
}

/**
 * Create a new invite (admin only)
 */
export async function createInvite(data: {
  creator_name: string;
  creator_photo_url: string;
  custom_message: string;
  created_by_admin_id: string;
  expires_in_days?: number;
}) {
  const supabase = await createServerClient();
  
  const token = generateInviteToken();
  const tokenHash = await hashToken(token);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (data.expires_in_days || 14));

  const { data: invite, error } = await supabase
    .from('creator_invites')
    .insert({
      token_hash: tokenHash,
      creator_name: data.creator_name,
      creator_photo_url: data.creator_photo_url,
      custom_message: data.custom_message,
      created_by_admin_id: data.created_by_admin_id,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, invite, token };
}

/**
 * Revoke an invite (admin only)
 */
export async function revokeInvite(inviteId: string) {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('creator_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get all invites (admin only)
 */
export async function getAllInvites() {
  const supabase = await createServerClient();

  const { data: invites, error } = await supabase
    .from('creator_invites')
    .select('*, claimed_by:auth.users!creator_invites_claimed_by_user_id_fkey(id, email), created_by:auth.users!creator_invites_created_by_admin_id_fkey(id, email)')
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, invites: [] };
  }

  return { success: true, invites };
}
