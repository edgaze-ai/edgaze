import { NextRequest, NextResponse } from "next/server";

import { loadWorkflowRunBootstrap, requireWorkflowRunAccess } from "src/server/flow-v2/read-model";
import { collectTraceHeaders, startTraceSession } from "src/server/trace";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { ensureWorkflowRunWorker } from "src/server/flow-v2/worker-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const startedAt = Date.now();
  const { runId } = await params;
  const trace = startTraceSession({
    kind: "request",
    source: "server",
    phase: "request",
    routeId: "api.runs.bootstrap",
    method: req.method,
    requestPath: req.nextUrl.pathname,
    requestQuery: req.nextUrl.search,
    workflowRunId: runId,
    correlationId: runId,
    context: {
      headers: collectTraceHeaders(req.headers),
      afterSequence: req.nextUrl.searchParams.get("afterSequence"),
      hasRunAccessToken: Boolean(req.nextUrl.searchParams.get("runAccessToken")),
    },
  });
  try {
    await trace.record({
      eventName: "request.received",
      payload: {
        runId,
      },
    });
    await trace.measure("run_access.verify", () => requireWorkflowRunAccess(req, runId), {
      payload: { runId },
    });

    const afterSequenceParam = req.nextUrl.searchParams.get("afterSequence");
    const afterSequence =
      afterSequenceParam && !Number.isNaN(Number(afterSequenceParam))
        ? Number(afterSequenceParam)
        : 0;
    await trace.record({
      eventName: "bootstrap.request_parsed",
      severity: "debug",
      payload: { runId, afterSequence },
    });

    const bootstrap = await trace.measure(
      "bootstrap.load",
      () =>
        loadWorkflowRunBootstrap({
          runId,
          afterSequence,
          eventLimit: 500,
        }),
      {
        payload: {
          runId,
          afterSequence,
          eventLimit: 500,
        },
      },
    );

    if (
      bootstrap.run.status !== "completed" &&
      bootstrap.run.status !== "failed" &&
      bootstrap.run.status !== "cancelled"
    ) {
      await trace.record({
        eventName: "worker.ensure_requested",
        phase: "worker",
        source: "workflow",
        payload: {
          runId,
          status: bootstrap.run.status,
          lastEventSequence: bootstrap.run.lastEventSequence,
        },
      });
      ensureWorkflowRunWorker({
        runId,
        repository: new SupabaseWorkflowExecutionRepository(),
        workerId: `read-model:${runId}`,
      });
    }

    await trace.finish({
      status: "completed",
      responseStatus: 200,
      summary: {
        runStatus: bootstrap.run.status,
        lastEventSequence: bootstrap.run.lastEventSequence,
        eventCount: Array.isArray(bootstrap.events) ? bootstrap.events.length : 0,
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ ok: true, ...bootstrap }, { headers: trace.responseHeaders() });
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
    await trace.record({
      eventName: "request.failed",
      severity: "error",
      httpStatus: status,
      payload: {
        runId,
        error: message,
      },
    });
    await trace.finish({
      status: "failed",
      responseStatus: status,
      errorMessage: message,
      summary: { durationMs: Date.now() - startedAt },
    });
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: trace.responseHeaders() },
    );
  }
}
