// Admin invites API - follows same pattern as runs/demo
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GET - List all invites
export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    // Fetch invites
    const { data: invites, error } = await supabase
      .from("creator_invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API invites GET] Error:", error);
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ invites: invites || [] });
  } catch (err: any) {
    console.error("[API invites GET] Exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - Create new invite
export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    const body = await req.json();
    const { creator_name, creator_photo_url, custom_message, expires_in_days = 14 } = body;

    if (!creator_name || !creator_photo_url || !custom_message) {
      return NextResponse.json(
        {
          error: "Missing required fields",
        },
        { status: 400 },
      );
    }

    // Generate token and hash
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Insert invite
    const { data: invite, error: insertError } = await supabase
      .from("creator_invites")
      .insert({
        token_hash: tokenHash,
        raw_token: rawToken,
        creator_name,
        creator_photo_url,
        custom_message,
        created_by_admin_id: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[API invites POST] Insert error:", insertError);
      return NextResponse.json(
        {
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      invite,
      url: `/c/${rawToken}`,
    });
  } catch (err: any) {
    console.error("[API invites POST] Exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Helper functions
function generateToken(): string {
  const array = new Uint8Array(36);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
