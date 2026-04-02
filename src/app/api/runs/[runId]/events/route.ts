import { NextRequest, NextResponse } from "next/server";

import {
  listWorkflowRunEvents,
  peekWorkflowRunStatus,
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

    const [events, runPeek] = await Promise.all([
      listWorkflowRunEvents({ runId, afterSequence, limit }),
      peekWorkflowRunStatus({ runId }),
    ]);

    if (
      runPeek.status !== "completed" &&
      runPeek.status !== "failed" &&
      runPeek.status !== "cancelled"
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
        id: runPeek.id,
        status: runPeek.status,
        outcome: runPeek.outcome,
        cancelRequestedAt: runPeek.cancelRequestedAt,
        lastEventSequence: runPeek.lastEventSequence,
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
