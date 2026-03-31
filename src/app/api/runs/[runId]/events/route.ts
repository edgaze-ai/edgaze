import { NextRequest, NextResponse } from "next/server";

import {
  listWorkflowRunEvents,
  loadWorkflowRunBootstrap,
  requireWorkflowRunAccess,
} from "src/server/flow-v2/read-model";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { ensureWorkflowRunWorker } from "src/server/flow-v2/worker-service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    await requireWorkflowRunAccess(req, runId);

    const afterSequenceParam = req.nextUrl.searchParams.get("afterSequence");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const afterSequence =
      afterSequenceParam && !Number.isNaN(Number(afterSequenceParam))
        ? Number(afterSequenceParam)
        : 0;
    const limit = limitParam && !Number.isNaN(Number(limitParam)) ? Number(limitParam) : 200;

    const [events, bootstrap] = await Promise.all([
      listWorkflowRunEvents({ runId, afterSequence, limit }),
      loadWorkflowRunBootstrap({ runId, afterSequence: 0, eventLimit: 0 }),
    ]);

    if (
      bootstrap.run.status !== "completed" &&
      bootstrap.run.status !== "failed" &&
      bootstrap.run.status !== "cancelled"
    ) {
      ensureWorkflowRunWorker({
        runId,
        repository: new SupabaseWorkflowExecutionRepository(),
        workerId: `events:${runId}`,
      });
    }

    return NextResponse.json({
      ok: true,
      run: {
        id: bootstrap.run.id,
        status: bootstrap.run.status,
        outcome: bootstrap.run.outcome,
        cancelRequestedAt: bootstrap.run.cancelRequestedAt,
        lastEventSequence: bootstrap.run.lastEventSequence,
      },
      events,
    });
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
