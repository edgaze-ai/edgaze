import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";

/**
 * Check if an anonymous demo run is allowed for a workflow
 * POST /api/demo-runs/check
 * Body: { workflowId: string, deviceFingerprint: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.workflowId !== "string" || typeof body.deviceFingerprint !== "string") {
      return NextResponse.json(
        { ok: false, error: "workflowId and deviceFingerprint are required" },
        { status: 400 }
      );
    }

    const { workflowId, deviceFingerprint } = body;

    // Extract IP address from request
    const clientId = extractClientIdentifier(req);
    const ipAddress = clientId.type === "ip" ? clientId.identifier : "unknown";

    // Validate fingerprint format (should be a hash string)
    if (!deviceFingerprint || deviceFingerprint.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Invalid device fingerprint" },
        { status: 400 }
      );
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
        { status: 500 }
      );
    }

    const allowed = checkData === true;

    return NextResponse.json({
      ok: true,
      allowed,
      workflowId,
      deviceFingerprint,
      ipAddress: ipAddress === "unknown" ? null : ipAddress, // Don't expose IP to client
    });
  } catch (err: any) {
    console.error("[Demo Runs] Exception in check:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
