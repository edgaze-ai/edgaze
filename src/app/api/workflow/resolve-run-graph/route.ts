import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getAuthenticatedRunEntitlement } from "src/server/flow/marketplace-entitlement";
import { loadPublishedWorkflowGraphForExecution } from "src/server/flow/load-workflow-graph";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";

export const maxDuration = 30;

/**
 * Returns canonical workflow graph for UI (demo inputs / validation) after the same checks
 * as /api/flow/run would use. Does not record anonymous demo consumption (that happens on run).
 */
export async function POST(req: Request) {
  try {
    let body: {
      workflowId?: string;
      deviceFingerprint?: string;
      adminDemoToken?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const workflowId = body.workflowId?.trim();
    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    if (
      body.adminDemoToken &&
      typeof body.adminDemoToken === "string" &&
      body.adminDemoToken.length >= 16
    ) {
      const { data: wf, error: wfError } = await supabaseAdmin
        .from("workflows")
        .select("id")
        .eq("id", workflowId)
        .eq("demo_mode_enabled", true)
        .eq("demo_token", body.adminDemoToken.trim())
        .maybeSingle();
      if (wfError || !wf) {
        return NextResponse.json({ ok: false, error: "Invalid demo link." }, { status: 403 });
      }
      const g = await loadPublishedWorkflowGraphForExecution(workflowId);
      return NextResponse.json({ ok: true, nodes: g.nodes, edges: g.edges });
    }

    const { user } = await getUserFromRequest(req);
    if (user) {
      const entitlement = await getAuthenticatedRunEntitlement(user.id, workflowId, false);
      if (!entitlement.ok) {
        return NextResponse.json({ ok: false, error: entitlement.message }, { status: 403 });
      }
      if (entitlement.useServerMarketplaceGraph) {
        const g = await loadPublishedWorkflowGraphForExecution(workflowId);
        return NextResponse.json({ ok: true, nodes: g.nodes, edges: g.edges });
      }
      // Draft / owner builder: graph may differ from published — return published snapshot only when useServerMarketplaceGraph; otherwise load draft graph for builder.
      const draftId = entitlement.draftIdForCount;
      if (draftId) {
        const { data: draft, error: dErr } = await supabaseAdmin
          .from("workflow_drafts")
          .select("graph")
          .eq("id", draftId)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (dErr || !draft) {
          return NextResponse.json({ ok: false, error: "Draft not found." }, { status: 404 });
        }
        const raw = draft.graph as { nodes?: unknown[]; edges?: unknown[] } | null;
        return NextResponse.json({
          ok: true,
          nodes: raw?.nodes ?? [],
          edges: raw?.edges ?? [],
        });
      }
      const g = await loadPublishedWorkflowGraphForExecution(workflowId);
      return NextResponse.json({ ok: true, nodes: g.nodes, edges: g.edges });
    }

    const fp = body.deviceFingerprint?.trim();
    if (!fp || fp.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Device fingerprint required for anonymous demo." },
        { status: 400 },
      );
    }

    const clientId = extractClientIdentifier(req);
    const ipAddress = clientId.type === "ip" ? clientId.identifier : "unknown";

    const { data: canRun, error: rpcErr } = await supabaseAdmin.rpc("can_run_anonymous_demo", {
      p_workflow_id: workflowId,
      p_device_fingerprint: fp,
      p_ip_address: ipAddress,
    });

    if (rpcErr) {
      console.error("[resolve-run-graph] can_run_anonymous_demo", rpcErr);
      return NextResponse.json({ ok: false, error: "Demo check failed." }, { status: 500 });
    }

    if (canRun !== true) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You've already used your one-time demo for this workflow on this device and network.",
        },
        { status: 403 },
      );
    }

    const g = await loadPublishedWorkflowGraphForExecution(workflowId);
    return NextResponse.json({ ok: true, nodes: g.nodes, edges: g.edges });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[resolve-run-graph]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
