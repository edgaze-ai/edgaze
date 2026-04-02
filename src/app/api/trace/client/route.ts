import { NextRequest, NextResponse } from "next/server";

import { startTraceSession } from "src/server/trace";

type ClientTracePayload = {
  session?: {
    id: string;
    kind: "client";
    source: "client";
    phase: "request" | "stream" | "client_render";
    routeId: string;
    requestPath?: string | null;
    requestQuery?: string | null;
    correlationId?: string | null;
    clientSessionId?: string | null;
    workflowId?: string | null;
    workflowRunId?: string | null;
    analyticsRunId?: string | null;
    status?: string | null;
    clientClockOffsetMs?: number | null;
    context?: Record<string, unknown>;
    summary?: Record<string, unknown>;
    startedAtEpochMs: number;
  };
  entries?: Array<{
    sequence?: number;
    phase?: "request" | "stream" | "client_render";
    source?: "client";
    eventName: string;
    severity?: "debug" | "info" | "warn" | "error";
    timestampEpochMs?: number;
    durationMs?: number | null;
    workflowRunId?: string | null;
    analyticsRunId?: string | null;
    streamId?: string | null;
    chunkSequence?: number | null;
    httpStatus?: number | null;
    payload?: Record<string, unknown>;
  }>;
  endedAtEpochMs?: number;
  errorMessage?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClientTracePayload;
    if (!body.session?.id || !body.session.routeId) {
      return NextResponse.json(
        { ok: false, error: "Invalid trace session payload." },
        { status: 400 },
      );
    }

    const trace = startTraceSession({
      id: body.session.id,
      kind: "client",
      source: "client",
      phase: body.session.phase ?? "client_render",
      routeId: body.session.routeId,
      method: "CLIENT",
      requestPath: body.session.requestPath ?? null,
      requestQuery: body.session.requestQuery ?? null,
      correlationId: body.session.correlationId ?? null,
      clientSessionId: body.session.clientSessionId ?? body.session.id,
      workflowId: body.session.workflowId ?? null,
      workflowRunId: body.session.workflowRunId ?? null,
      analyticsRunId: body.session.analyticsRunId ?? null,
      context: body.session.context ?? {},
      summary: body.session.summary ?? {},
      startedAtEpochMs: body.session.startedAtEpochMs,
    });
    trace.updateLinks({
      workflowRunId: body.session.workflowRunId ?? null,
      analyticsRunId: body.session.analyticsRunId ?? null,
      workflowId: body.session.workflowId ?? null,
      correlationId: body.session.correlationId ?? null,
      clientClockOffsetMs: body.session.clientClockOffsetMs ?? null,
    });
    if (body.session.status) {
      trace.setStatus(body.session.status);
    }
    if (body.errorMessage) {
      trace.setErrorMessage(body.errorMessage);
    }

    for (const entry of body.entries ?? []) {
      await trace.record({
        phase: entry.phase ?? "client_render",
        source: "client",
        eventName: entry.eventName,
        severity: entry.severity ?? "info",
        timestampEpochMs: entry.timestampEpochMs,
        durationMs: entry.durationMs ?? null,
        workflowRunId: entry.workflowRunId ?? body.session.workflowRunId ?? null,
        analyticsRunId: entry.analyticsRunId ?? body.session.analyticsRunId ?? null,
        streamId: entry.streamId ?? null,
        chunkSequence: entry.chunkSequence ?? null,
        httpStatus: entry.httpStatus ?? null,
        payload: entry.payload ?? {},
      });
    }

    if (body.endedAtEpochMs) {
      await trace.finish({
        status: body.session.status ?? "completed",
        errorMessage: body.errorMessage ?? null,
        summary: {
          clientEndedAtEpochMs: body.endedAtEpochMs,
        },
      });
    } else {
      await trace.flush();
    }

    return NextResponse.json({ ok: true }, { headers: trace.responseHeaders() });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to ingest client trace.",
      },
      { status: 500 },
    );
  }
}
