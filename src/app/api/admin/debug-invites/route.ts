// Admin-only debug endpoint for invite troubleshooting
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hashToken } from '@/lib/invites';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Debug info
    const tokenHash = await hashToken(token);
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      token_received: token,
      token_length: token.length,
      token_hash: tokenHash,
      token_preview: token.substring(0, 20) + '...',
    };

    console.log('[Debug API] Token:', token);
    console.log('[Debug API] Hash:', tokenHash);

    // Look up by hash
    const { data: inviteByHash, error: hashError } = await supabase
      .from('creator_invites')
      .select('*')
      .eq('token_hash', debugInfo.token_hash)
      .maybeSingle();

    debugInfo.lookup_by_hash = {
      found: !!inviteByHash,
      error: hashError?.message || null,
      invite: inviteByHash ? {
        id: inviteByHash.id,
        creator_name: inviteByHash.creator_name,
        status: inviteByHash.status,
        has_raw_token: !!inviteByHash.raw_token,
        expires_at: inviteByHash.expires_at,
        created_at: inviteByHash.created_at,
      } : null,
    };

    // Look up by raw token (if available)
    const { data: inviteByRaw, error: rawError } = await supabase
      .from('creator_invites')
      .select('*')
      .eq('raw_token', token)
      .maybeSingle();

    debugInfo.lookup_by_raw_token = {
      found: !!inviteByRaw,
      error: rawError?.message || null,
      invite: inviteByRaw ? {
        id: inviteByRaw.id,
        creator_name: inviteByRaw.creator_name,
        status: inviteByRaw.status,
        token_hash: inviteByRaw.token_hash,
        expires_at: inviteByRaw.expires_at,
        created_at: inviteByRaw.created_at,
      } : null,
    };

    // Get all invites for comparison
    const { data: allInvites } = await supabase
      .from('creator_invites')
      .select('id, creator_name, status, token_hash, raw_token, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    debugInfo.recent_invites = allInvites?.map(inv => ({
      id: inv.id,
      creator_name: inv.creator_name,
      status: inv.status,
      has_raw_token: !!inv.raw_token,
      raw_token: inv.raw_token, // Full token for testing
      raw_token_preview: inv.raw_token ? inv.raw_token.substring(0, 20) + '...' : null,
      token_hash_preview: inv.token_hash?.substring(0, 16) + '...',
      token_hash_full: inv.token_hash,
      created_at: inv.created_at,
      matches_search: inv.token_hash === tokenHash || inv.raw_token === token,
    }));

    return NextResponse.json({ success: true, debug: debugInfo });
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      stack: err.stack 
    }, { status: 500 });
  }
}
