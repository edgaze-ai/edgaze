import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/creator-provisioning/tokens";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/creator-provisioning/constants";
import { parseCookieHeader } from "@/lib/creator-provisioning/tokens";

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ active: false });
    }

    const cookies = parseCookieHeader(req.headers.get("cookie"));
    const rawToken = cookies[IMPERSONATION_COOKIE_NAME];
    if (!rawToken) {
      return NextResponse.json({ active: false });
    }

    const tokenHash = await hashToken(rawToken);
    const admin = createSupabaseAdminClient();

    const { data: session } = await admin
      .from("admin_impersonation_sessions")
      .select("id, target_profile_id, started_at, expires_at, return_to_admin_path, status")
      .eq("session_token_hash", tokenHash)
      .eq("admin_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const row = session as {
      id: string;
      target_profile_id: string;
      started_at: string;
      expires_at: string;
      return_to_admin_path: string | null;
    } | null;

    if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ active: false });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select(
        "id,email,full_name,handle,avatar_url,banner_url,bio,socials,country,plan,email_verified,is_founding_creator,is_verified_creator,can_receive_payments,source,claim_status",
      )
      .eq("id", row.target_profile_id)
      .maybeSingle();

    const p = profile as {
      id: string;
      email: string;
      handle: string;
      full_name: string | null;
      avatar_url: string | null;
      banner_url?: string | null;
      bio?: string | null;
      socials?: Record<string, string> | null;
      country?: string | null;
      plan?: "Free" | "Pro" | "Team";
      email_verified?: boolean | null;
      is_founding_creator?: boolean | null;
      is_verified_creator?: boolean | null;
      can_receive_payments?: boolean | null;
      source?: string | null;
      claim_status?: string | null;
    } | null;

    return NextResponse.json({
      active: true,
      sessionId: row.id,
      targetProfileId: row.target_profile_id,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      returnToAdminPath: row.return_to_admin_path ?? "/admin/creators",
      profile: p,
    });
  } catch (e: any) {
    console.error("[impersonation/current]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
