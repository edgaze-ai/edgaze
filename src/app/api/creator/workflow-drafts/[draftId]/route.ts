import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actor = await resolveActorContext(req, user);
    const ownerId = actor.effectiveProfileId;
    const { draftId } = await ctx.params;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("workflow_drafts")
      .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
      .eq("id", draftId)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ draft: data });
  } catch (e: any) {
    console.error("[workflow-drafts GET id]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actor = await resolveActorContext(req, user);
    const ownerId = actor.effectiveProfileId;
    const { draftId } = await ctx.params;
    const body = await req.json();

    const admin = createSupabaseAdminClient();

    const { data: existing, error: exErr } = await admin
      .from("workflow_drafts")
      .select("id, owner_id")
      .eq("id", draftId)
      .maybeSingle();

    if (exErr || !existing || (existing as { owner_id: string }).owner_id !== ownerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.title != null) updatePayload.title = String(body.title).slice(0, 500);
    if (body.graph != null) updatePayload.graph = body.graph;
    if (body.last_opened_at != null) updatePayload.last_opened_at = body.last_opened_at;
    if (body.updated_at != null) updatePayload.updated_at = body.updated_at;

    const { error: upErr } = await admin
      .from("workflow_drafts")
      .update(updatePayload)
      .eq("id", draftId)
      .eq("owner_id", ownerId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const auditFields = Object.keys(updatePayload).filter((k) => k !== "last_opened_at");
    if (auditFields.length > 0) {
      await logCreatorAuditEvent({
        action: "workflow.draft.updated",
        actorUserId: actor.realUserId,
        actorRole: actor.adminRole,
        actorMode:
          actor.actorMode === "admin_impersonation" ? "admin_impersonation" : "creator_self",
        effectiveProfileId: actor.effectiveProfileId,
        impersonationSessionId: actor.impersonationSessionId,
        resourceType: "workflow_draft",
        resourceId: draftId,
        metadata: { fields: auditFields },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[workflow-drafts PATCH]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
