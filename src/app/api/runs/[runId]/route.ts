import { NextRequest, NextResponse } from "next/server";

import { loadWorkflowRunBootstrap, requireWorkflowRunAccess } from "src/server/flow-v2/read-model";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { ensureWorkflowRunWorker } from "src/server/flow-v2/worker-service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    await requireWorkflowRunAccess(req, runId);

    const afterSequenceParam = req.nextUrl.searchParams.get("afterSequence");
    const afterSequence =
      afterSequenceParam && !Number.isNaN(Number(afterSequenceParam))
        ? Number(afterSequenceParam)
        : 0;

    const bootstrap = await loadWorkflowRunBootstrap({
      runId,
      afterSequence,
      eventLimit: 500,
    });

    if (
      bootstrap.run.status !== "completed" &&
      bootstrap.run.status !== "failed" &&
      bootstrap.run.status !== "cancelled"
    ) {
      ensureWorkflowRunWorker({
        runId,
        repository: new SupabaseWorkflowExecutionRepository(),
        workerId: `read-model:${runId}`,
      });
    }

    return NextResponse.json({ ok: true, ...bootstrap });
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
