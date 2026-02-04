import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";

/**
 * Record an anonymous demo run for a workflow
 * POST /api/demo-runs/track
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

    // Validate fingerprint format
    if (!deviceFingerprint || deviceFingerprint.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Invalid device fingerprint" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Record the demo run using database function (includes duplicate check)
    const { data: recordData, error: recordError } = await supabase.rpc("record_anonymous_demo_run", {
      p_workflow_id: workflowId,
      p_device_fingerprint: deviceFingerprint,
      p_ip_address: ipAddress,
    });

    if (recordError) {
      console.error("[Demo Runs] Error recording demo run:", recordError);
      return NextResponse.json(
        { ok: false, error: "Failed to record demo run" },
        { status: 500 }
      );
    }

    const result = recordData as {
      success: boolean;
      allowed: boolean;
      error?: string;
      message?: string;
    };

    if (!result.success || !result.allowed) {
      return NextResponse.json(
        {
          ok: false,
          allowed: false,
          error: result.error || "Demo run already used for this device and IP address",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      allowed: true,
      message: result.message || "Demo run recorded successfully",
    });
  } catch (err: any) {
    console.error("[Demo Runs] Exception in track:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
