import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";
import { stripGraphSecrets } from "@/lib/workflow/stripGraphSecrets";

function nowIso() {
  return new Date().toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actor = await resolveActorContext(req, user);
    const ownerId = actor.effectiveProfileId;
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("workflow_drafts")
      .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: published, error: pubErr } = await admin
      .from("workflows")
      .select("id,owner_id,title,graph,created_at,updated_at")
      .eq("owner_id", ownerId)
      .eq("is_published", true)
      .order("updated_at", { ascending: false });

    if (pubErr) {
      return NextResponse.json({ error: pubErr.message }, { status: 500 });
    }

    return NextResponse.json({ drafts: data ?? [], published: published ?? [] });
  } catch (e: any) {
    console.error("[workflow-drafts GET]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actor = await resolveActorContext(req, user);
    const ownerId = actor.effectiveProfileId;
    const body = await req.json();
    let title = String(body.title ?? "").trim() || "Untitled Workflow";
    let graph = body.graph ?? { nodes: [], edges: [] };
    const fromPublishedWorkflowId =
      typeof body.from_published_workflow_id === "string"
        ? body.from_published_workflow_id.trim()
        : "";

    const admin = createSupabaseAdminClient();

    if (fromPublishedWorkflowId) {
      const { data: wf, error: wfErr } = await admin
        .from("workflows")
        .select("id,owner_id,title,graph")
        .eq("id", fromPublishedWorkflowId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (wfErr || !wf) {
        return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
      }
      const wfRow = wf as { title: string | null; graph: unknown };
      title = wfRow.title || title;
      graph = stripGraphSecrets(wfRow.graph as any) ?? { nodes: [], edges: [] };
    }

    const { data, error } = await admin
      .from("workflow_drafts")
      .insert({
        owner_id: ownerId,
        title,
        graph,
        last_opened_at: nowIso(),
      })
      .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
    }

    await logCreatorAuditEvent({
      action: "workflow.draft.created",
      actorUserId: actor.realUserId,
      actorRole: actor.adminRole,
      actorMode: actor.actorMode === "admin_impersonation" ? "admin_impersonation" : "creator_self",
      effectiveProfileId: actor.effectiveProfileId,
      impersonationSessionId: actor.impersonationSessionId,
      resourceType: "workflow_draft",
      resourceId: String((data as { id: string }).id),
    });

    return NextResponse.json({ draft: data }, { status: 201 });
  } catch (e: any) {
    console.error("[workflow-drafts POST]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
