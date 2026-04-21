import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { resolveWorkflowAccessDecision } from "src/server/flow/workflow-security";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const workflowId = typeof body?.workflowId === "string" ? body.workflowId.trim() : "";
    const requestedMode =
      body?.requestedMode === "edit" || body?.requestedMode === "preview"
        ? body.requestedMode
        : null;

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    const { user } = await getUserFromRequest(req);
    const decision = await resolveWorkflowAccessDecision({
      workflowId,
      userId: user?.id ?? null,
      requestedMode,
    });

    return NextResponse.json({
      ok: decision.ok,
      mode: decision.mode,
      canEdit: decision.mode === "owner_edit",
      canPreview:
        decision.mode === "owner_preview" ||
        decision.mode === "buyer_preview" ||
        decision.mode === "free_preview" ||
        decision.mode === "owner_edit",
      isOwner: decision.isOwner,
      error: decision.ok ? null : (decision.message ?? "Access denied"),
    });
  } catch (error) {
    console.error("[workflow/access]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to verify workflow access." },
      { status: 500 },
    );
  }
}
