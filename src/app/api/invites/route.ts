// POST /api/invites - Create a new invite (admin only)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createInvite } from "@/lib/invites";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRole) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { creator_name, creator_photo_url, custom_message, expires_in_days } = body;

    // Validate required fields
    if (!creator_name || !creator_photo_url || !custom_message) {
      return NextResponse.json(
        { error: "Missing required fields: creator_name, creator_photo_url, custom_message" },
        { status: 400 },
      );
    }

    // Create invite
    const result = await createInvite({
      creator_name,
      creator_photo_url,
      custom_message,
      created_by_admin_id: user.id,
      expires_in_days: expires_in_days || 14,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Return invite data and token
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/c/${result.token}`;

    return NextResponse.json({
      success: true,
      invite: result.invite,
      token: result.token,
      url: inviteUrl,
    });
  } catch (error: any) {
    console.error("Error creating invite:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// GET /api/invites - Get all invites (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRole) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Get all invites
    const { data: invites, error } = await supabase
      .from("creator_invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invites });
  } catch (error: any) {
    console.error("Error fetching invites:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
