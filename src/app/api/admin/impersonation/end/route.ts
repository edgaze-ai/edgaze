import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/creator-provisioning/tokens";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/creator-provisioning/constants";
import { parseCookieHeader } from "@/lib/creator-provisioning/tokens";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cookies = parseCookieHeader(req.headers.get("cookie"));
    const rawToken = cookies[IMPERSONATION_COOKIE_NAME];
    const admin = createSupabaseAdminClient();

    if (rawToken) {
      const tokenHash = await hashToken(rawToken);
      const { data: session } = await admin
        .from("admin_impersonation_sessions")
        .select("id, target_profile_id, status")
        .eq("session_token_hash", tokenHash)
        .eq("admin_user_id", user.id)
        .maybeSingle();

      const row = session as { id: string; target_profile_id: string; status: string } | null;
      if (row && row.status === "active") {
        await admin
          .from("admin_impersonation_sessions")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
            ended_reason: "admin_ended",
            ended_user_agent: req.headers.get("user-agent"),
            ended_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          })
          .eq("id", row.id);

        await logCreatorAuditEvent({
          action: "admin.impersonation.ended",
          actorUserId: user.id,
          actorRole: "super_admin",
          actorMode: "admin_direct",
          effectiveProfileId: row.target_profile_id,
          impersonationSessionId: row.id,
          resourceType: "admin_impersonation_sessions",
          resourceId: row.id,
        });
      }
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(IMPERSONATION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (e: any) {
    console.error("[impersonation/end]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
