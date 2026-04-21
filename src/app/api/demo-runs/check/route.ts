import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { extractTrustedClientIpOrUnknown } from "@lib/request-client-ip";
import { checkWorkflowDemoRateLimit } from "@lib/rate-limiting/workflow-demo";
import {
  isAnonymousWorkflowDemoEligibleMode,
  resolveWorkflowAccessDecision,
} from "src/server/flow/workflow-security";
import { normalizeWorkflowDemoFingerprint } from "src/server/security/workflow-demo-identity";

/**
 * Check if an anonymous demo run is allowed for a workflow
 * POST /api/demo-runs/check
 * Body: { workflowId: string, deviceFingerprint: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.workflowId !== "string" ||
      typeof body.deviceFingerprint !== "string"
    ) {
      return NextResponse.json(
        { ok: false, error: "workflowId and deviceFingerprint are required" },
        { status: 400 },
      );
    }

    const workflowId = body.workflowId.trim();
    const deviceFingerprint = normalizeWorkflowDemoFingerprint(body.deviceFingerprint);
    if (!workflowId || !deviceFingerprint) {
      return NextResponse.json(
        { ok: false, error: "workflowId and a valid deviceFingerprint are required" },
        { status: 400 },
      );
    }

    const ipAddress = extractTrustedClientIpOrUnknown(req);

    if (
      !checkWorkflowDemoRateLimit({
        req,
        workflowId,
        deviceFingerprint,
        kind: "preflight",
      })
    ) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    // Validate fingerprint format (should be a hash string)
    const accessDecision = await resolveWorkflowAccessDecision({
      workflowId,
      userId: null,
      requestedMode: "preview",
    });
    if (!accessDecision.ok || !isAnonymousWorkflowDemoEligibleMode(accessDecision.mode)) {
      return NextResponse.json({
        ok: true,
        allowed: false,
        workflowId,
        deviceFingerprint,
        ipAddress: null,
      });
    }

    const supabase = createSupabaseAdminClient();

    // Check if demo run is allowed using database function
    const { data: checkData, error: checkError } = await supabase.rpc("can_run_anonymous_demo", {
      p_workflow_id: workflowId,
      p_device_fingerprint: deviceFingerprint,
      p_ip_address: ipAddress,
    });

    if (checkError) {
      console.error("[Demo Runs] Error checking demo run:", checkError);
      return NextResponse.json(
        { ok: false, error: "Failed to check demo run eligibility" },
        { status: 500 },
      );
    }

    const allowed = checkData === true;

    return NextResponse.json({
      ok: true,
      allowed,
      workflowId,
      deviceFingerprint,
      ipAddress: null,
    });
  } catch (err: any) {
    console.error("[Demo Runs] Exception in check:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
