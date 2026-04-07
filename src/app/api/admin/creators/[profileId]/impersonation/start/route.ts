import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashToken, generateOpaqueToken } from "@/lib/creator-provisioning/tokens";
import {
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_SESSION_TTL_SEC,
} from "@/lib/creator-provisioning/constants";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ profileId: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { profileId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const reason = String((body as { reason?: string }).reason ?? "support").slice(0, 500);
    const return_to_admin_path = String(
      (body as { return_to_admin_path?: string }).return_to_admin_path ?? "/admin/creators",
    ).slice(0, 500);

    const admin = createSupabaseAdminClient();

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, handle, full_name")
      .eq("id", profileId)
      .maybeSingle();

    if (pErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawToken = generateOpaqueToken() + generateOpaqueToken();
    const tokenHash = await hashToken(rawToken);

    const expiresAt = new Date(Date.now() + IMPERSONATION_SESSION_TTL_SEC * 1000);

    const { data: session, error: sErr } = await admin
      .from("admin_impersonation_sessions")
      .insert({
        session_token_hash: tokenHash,
        admin_user_id: user.id,
        target_profile_id: profileId,
        reason,
        expires_at: expiresAt.toISOString(),
        return_to_admin_path: return_to_admin_path || null,
        started_user_agent: req.headers.get("user-agent"),
        started_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      })
      .select("id")
      .single();

    if (sErr || !session) {
      console.error(sErr);
      return NextResponse.json(
        { error: sErr?.message ?? "Failed to start session" },
        { status: 500 },
      );
    }

    await logCreatorAuditEvent({
      action: "admin.impersonation.started",
      actorUserId: user.id,
      actorRole: "super_admin",
      actorMode: "admin_direct",
      effectiveProfileId: profileId,
      impersonationSessionId: (session as { id: string }).id,
      resourceType: "admin_impersonation_sessions",
      resourceId: (session as { id: string }).id,
      metadata: { reason },
    });

    const res = NextResponse.json({
      ok: true,
      targetProfileId: profileId,
      handle: (profile as { handle?: string }).handle,
      full_name: (profile as { full_name?: string | null }).full_name,
      sessionId: (session as { id: string }).id,
    });

    res.cookies.set(IMPERSONATION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: IMPERSONATION_SESSION_TTL_SEC,
    });

    return res;
  } catch (e: any) {
    console.error("[impersonation/start]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
