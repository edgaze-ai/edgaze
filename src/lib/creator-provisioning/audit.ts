import { createSupabaseAdminClient } from "@lib/supabase/admin";

export type CreatorAuditActorMode =
  | "creator_self"
  | "admin_impersonation"
  | "admin_direct"
  | "system";

export async function logCreatorAuditEvent(params: {
  action: string;
  actorUserId: string | null;
  actorRole: string;
  actorMode: CreatorAuditActorMode;
  effectiveProfileId: string | null;
  impersonationSessionId?: string | null;
  resourceType?: string;
  resourceId?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("creator_audit_events").insert({
    action: params.action,
    actor_user_id: params.actorUserId,
    actor_role: params.actorRole,
    actor_mode: params.actorMode,
    effective_profile_id: params.effectiveProfileId,
    impersonation_session_id: params.impersonationSessionId ?? null,
    resource_type: params.resourceType ?? "",
    resource_id: params.resourceId ?? "",
    before_state: params.beforeState ?? null,
    after_state: params.afterState ?? null,
    metadata: params.metadata ?? {},
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });
  if (error) {
    console.error("[creator_audit_events]", error);
  }
}
