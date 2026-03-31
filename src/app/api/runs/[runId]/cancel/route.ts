import { NextRequest, NextResponse } from "next/server";

import { requireWorkflowRunAccess } from "src/server/flow-v2/read-model";
import { WorkflowRunOrchestrator } from "src/server/flow-v2/orchestrator";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { cancelWorkflowRunWorker } from "src/server/flow-v2/worker-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    await requireWorkflowRunAccess(req, runId);

    const orchestrator = new WorkflowRunOrchestrator(new SupabaseWorkflowExecutionRepository());
    await orchestrator.requestCancellation(runId);
    cancelWorkflowRunWorker(runId);

    return NextResponse.json({ ok: true, runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Run not found"
        ? 404
        : message === "Forbidden"
          ? 403
          : message.includes("Authentication")
            ? 401
            : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
