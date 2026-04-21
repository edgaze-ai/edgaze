import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { loadPublishedWorkflowGraphForExecution } from "src/server/flow/load-workflow-graph";
import {
  isAnonymousWorkflowDemoEligibleMode,
  resolveWorkflowAccessDecision,
  sanitizeWorkflowGraphForClient,
} from "src/server/flow/workflow-security";
import { extractTrustedClientIpOrUnknown } from "@lib/request-client-ip";
import { checkWorkflowDemoRateLimit } from "@lib/rate-limiting/workflow-demo";

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

    if (
      !checkWorkflowDemoRateLimit({
        req,
        workflowId,
        deviceFingerprint: body.deviceFingerprint,
        kind: "resolve",
      })
    ) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const { user } = await getUserFromRequest(req);
    if (user) {
      const decision = await resolveWorkflowAccessDecision({
        workflowId,
        userId: user.id,
        requestedMode: "preview",
      });
      if (!decision.ok) {
        return NextResponse.json({ ok: false, error: decision.message }, { status: 403 });
      }
      const g = await loadPublishedWorkflowGraphForExecution(workflowId);
      if (decision.mode === "owner_edit" || decision.mode === "owner_preview") {
        return NextResponse.json({ ok: true, nodes: g.nodes, edges: g.edges, mode: decision.mode });
      }
      const sanitized = sanitizeWorkflowGraphForClient(g, "preview");
      return NextResponse.json({
        ok: true,
        nodes: sanitized.nodes,
        edges: sanitized.edges,
        mode: decision.mode,
      });
    }

    const fp = body.deviceFingerprint?.trim();
    if (!fp || fp.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Device fingerprint required for anonymous demo." },
        { status: 400 },
      );
    }

    const accessDecision = await resolveWorkflowAccessDecision({
      workflowId,
      userId: null,
      requestedMode: "preview",
    });
    if (!accessDecision.ok || !isAnonymousWorkflowDemoEligibleMode(accessDecision.mode)) {
      return NextResponse.json(
        { ok: false, error: accessDecision.message ?? "This workflow demo is not available." },
        { status: 403 },
      );
    }

    const ipAddress = extractTrustedClientIpOrUnknown(req);

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
    const sanitized = sanitizeWorkflowGraphForClient(g, "demo_input_collection");
    return NextResponse.json({ ok: true, nodes: sanitized.nodes, edges: sanitized.edges });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[resolve-run-graph]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
