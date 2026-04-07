import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { isAdmin } from "@lib/supabase/executions";
import { IMPERSONATION_COOKIE_NAME } from "@lib/creator-provisioning/constants";
import { hashToken, parseCookieHeader } from "@lib/creator-provisioning/tokens";

export type ActorMode = "creator_self" | "admin_impersonation";

export type ActorContext = {
  realUserId: string;
  realUserEmail: string | null;
  effectiveProfileId: string;
  actorMode: ActorMode;
  impersonationSessionId?: string;
  adminRole: string;
};

async function fetchAdminRole(userId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "super_admin";
  const row = data as { role?: string };
  return row.role ?? "super_admin";
}

/**
 * Resolve effective creator workspace id for server routes.
 * When an admin carries a valid impersonation cookie, writes target the impersonated profile,
 * while the authenticated Supabase user remains the admin.
 */
export async function resolveActorContext(req: Request, user: User): Promise<ActorContext> {
  const adminRole = (await isAdmin(user.id)) ? await fetchAdminRole(user.id) : "none";
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const rawToken = cookies[IMPERSONATION_COOKIE_NAME];

  if (rawToken && adminRole !== "none" && (await isAdmin(user.id))) {
    const tokenHash = await hashToken(rawToken);
    const supabase = createSupabaseAdminClient();
    const { data: session } = await supabase
      .from("admin_impersonation_sessions")
      .select("id,admin_user_id,target_profile_id,status,expires_at")
      .eq("session_token_hash", tokenHash)
      .eq("status", "active")
      .maybeSingle();

    const row = session as {
      id: string;
      admin_user_id: string;
      target_profile_id: string;
      expires_at: string;
    } | null;

    if (row && row.admin_user_id === user.id && new Date(row.expires_at).getTime() > Date.now()) {
      return {
        realUserId: user.id,
        realUserEmail: user.email ?? null,
        effectiveProfileId: row.target_profile_id,
        actorMode: "admin_impersonation",
        impersonationSessionId: row.id,
        adminRole,
      };
    }
  }

  return {
    realUserId: user.id,
    realUserEmail: user.email ?? null,
    effectiveProfileId: user.id,
    actorMode: "creator_self",
    adminRole,
  };
}

export async function hasActiveImpersonation(req: Request, userId: string): Promise<boolean> {
  if (!(await isAdmin(userId))) return false;
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const rawToken = cookies[IMPERSONATION_COOKIE_NAME];
  if (!rawToken) return false;
  const tokenHash = await hashToken(rawToken);
  const supabase = createSupabaseAdminClient();
  const { data: session } = await supabase
    .from("admin_impersonation_sessions")
    .select("id,admin_user_id,expires_at,status")
    .eq("session_token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();
  const row = session as { admin_user_id: string; expires_at: string } | null;
  return !!(row && row.admin_user_id === userId && new Date(row.expires_at).getTime() > Date.now());
}
