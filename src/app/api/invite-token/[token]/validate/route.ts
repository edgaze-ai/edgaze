// GET /api/invite-token/[token]/validate - Validate an invite token

import { NextRequest, NextResponse } from 'next/server';
import { validateInviteToken } from '@/lib/invites';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    console.log('[Validate API] Received token:', token);
    console.log('[Validate API] Token length:', token?.length);

    if (!token) {
      console.log('[Validate API] No token provided');
      return NextResponse.json(
        { valid: false, reason: 'invalid' },
        { status: 400 }
      );
    }

    console.log('[Validate API] Calling validateInviteToken...');
    const result = await validateInviteToken(token);
    console.log('[Validate API] Validation result:', result);

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          reason: result.reason,
          invite: result.invite ? {
            id: result.invite.id,
            creator_name: result.invite.creator_name,
            creator_photo_url: result.invite.creator_photo_url,
            status: result.invite.status,
          } : null,
        },
        { status: 200 }
      );
    }

    // Return sanitized invite data (don't expose sensitive fields)
    return NextResponse.json({
      valid: true,
      invite: {
        id: result.invite.id,
        creator_name: result.invite.creator_name,
        creator_photo_url: result.invite.creator_photo_url,
        custom_message: result.invite.custom_message,
        status: result.invite.status,
        expires_at: result.invite.expires_at,
      },
    });
  } catch (error: any) {
    console.error('Error validating invite:', error);
    return NextResponse.json(
      { valid: false, reason: 'invalid' },
      { status: 500 }
    );
  }
}
