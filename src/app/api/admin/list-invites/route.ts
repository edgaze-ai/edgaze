// List all invites with their tokens for debugging
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerClient();
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[List Invites API] User:', user?.id);
    
    const { data: invites, error, count } = await supabase
      .from('creator_invites')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('[List Invites API] Query result:', { count, invitesLength: invites?.length, error });

    if (error) {
      console.error('[List Invites API] Query failed:', error);
      return NextResponse.json({ 
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint || 'If table does not exist, run the migrations first'
      }, { status: 200 }); // Return 200 so the UI can show the error
    }

    return NextResponse.json({ 
      success: true, 
      count: invites?.length || 0,
      invites: invites?.map(inv => ({
        id: inv.id,
        creator_name: inv.creator_name,
        status: inv.status,
        has_raw_token: !!inv.raw_token,
        raw_token: inv.raw_token, // Full token for copying
        raw_token_length: inv.raw_token?.length || 0,
        token_hash_preview: inv.token_hash?.substring(0, 20) + '...',
        created_at: inv.created_at,
        expires_at: inv.expires_at,
      })) || []
    });
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 200 });
  }
}
