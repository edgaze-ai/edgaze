"use client";

type ClientTracePhase = "request" | "stream" | "client_render";
type ClientTraceSeverity = "debug" | "info" | "warn" | "error";

type ClientTraceEntry = {
  sequence: number;
  phase: ClientTracePhase;
  source: "client";
  eventName: string;
  severity: ClientTraceSeverity;
  timestampEpochMs: number;
  sinceSessionStartMs: number;
  durationMs: number | null;
  workflowRunId: string | null;
  analyticsRunId: string | null;
  streamId: string | null;
  chunkSequence: number | null;
  httpStatus: number | null;
  payload: Record<string, unknown>;
};

type ClientTraceFlushBody = {
  session: {
    id: string;
    kind: "client";
    source: "client";
    phase: ClientTracePhase;
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
    context: Record<string, unknown>;
    summary: Record<string, unknown>;
    startedAtEpochMs: number;
  };
  entries: ClientTraceEntry[];
  endedAtEpochMs?: number;
  errorMessage?: string | null;
};

function sanitizeClientPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { value: payload as string | number | boolean | null | undefined };
  }
  const cloned = structuredClone(payload as Record<string, unknown>);
  for (const key of Object.keys(cloned)) {
    const normalized = key.toLowerCase();
    if (
      normalized.includes("token") ||
      normalized.includes("secret") ||
      normalized.includes("authorization") ||
      normalized.includes("apikey")
    ) {
      cloned[key] = "***REDACTED***";
    }
  }
  return cloned;
}

export class ClientTraceSession {
  private readonly sessionId: string;
  private readonly startedAtEpochMs: number;
  private readonly clientSessionId: string;
  private readonly routeId: string;
  private readonly requestPath: string | null;
  private readonly workflowId: string | null;
  private readonly context: Record<string, unknown>;
  private entries: ClientTraceEntry[] = [];
  private nextSequence = 1;
  private workflowRunId: string | null = null;
  private analyticsRunId: string | null = null;
  private correlationId: string | null = null;
  private clientClockOffsetMs: number | null = null;
  private status: string | null = "in_progress";

  constructor(params: {
    routeId: string;
    requestPath?: string | null;
    workflowId?: string | null;
    context?: Record<string, unknown>;
  }) {
    this.sessionId = crypto.randomUUID();
    this.clientSessionId = this.sessionId;
    this.startedAtEpochMs = Date.now();
    this.routeId = params.routeId;
    this.requestPath = params.requestPath ?? null;
    this.workflowId = params.workflowId ?? null;
    this.context = sanitizeClientPayload(params.context ?? {});
  }

  get id(): string {
    return this.sessionId;
  }

  setClockFromServerEpoch(serverEpochMsHeader: string | null): void {
    if (!serverEpochMsHeader) return;
    const serverEpochMs = Number(serverEpochMsHeader);
    if (!Number.isFinite(serverEpochMs)) return;
    this.clientClockOffsetMs = Math.round(serverEpochMs - Date.now());
  }

  linkRun(params: {
    workflowRunId?: string | null;
    analyticsRunId?: string | null;
    correlationId?: string | null;
  }): void {
    if (params.workflowRunId !== undefined) this.workflowRunId = params.workflowRunId;
    if (params.analyticsRunId !== undefined) this.analyticsRunId = params.analyticsRunId;
    if (params.correlationId !== undefined) this.correlationId = params.correlationId;
  }

  record(params: {
    phase: ClientTracePhase;
    eventName: string;
    severity?: ClientTraceSeverity;
    durationMs?: number | null;
    httpStatus?: number | null;
    chunkSequence?: number | null;
    streamId?: string | null;
    payload?: Record<string, unknown>;
  }): void {
    const clientNow = Date.now();
    const normalizedEpoch = clientNow + (this.clientClockOffsetMs ?? 0);
    this.entries.push({
      sequence: this.nextSequence++,
      phase: params.phase,
      source: "client",
      eventName: params.eventName,
      severity: params.severity ?? "info",
      timestampEpochMs: normalizedEpoch,
      sinceSessionStartMs: Math.max(0, clientNow - this.startedAtEpochMs),
      durationMs: params.durationMs ?? null,
      workflowRunId: this.workflowRunId,
      analyticsRunId: this.analyticsRunId,
      streamId: params.streamId ?? null,
      chunkSequence: params.chunkSequence ?? null,
      httpStatus: params.httpStatus ?? null,
      payload: sanitizeClientPayload(params.payload ?? {}),
    });
  }

  async flush(params?: { final?: boolean; errorMessage?: string | null }): Promise<void> {
    if (this.entries.length === 0 && !params?.final) return;
    const body: ClientTraceFlushBody = {
      session: {
        id: this.sessionId,
        kind: "client",
        source: "client",
        phase: "client_render",
        routeId: this.routeId,
        requestPath: this.requestPath,
        requestQuery: typeof window !== "undefined" ? window.location.search : "",
        correlationId: this.correlationId,
        clientSessionId: this.clientSessionId,
        workflowId: this.workflowId,
        workflowRunId: this.workflowRunId,
        analyticsRunId: this.analyticsRunId,
        status: params?.final ? this.status : "in_progress",
        clientClockOffsetMs: this.clientClockOffsetMs,
        context: this.context,
        summary: {
          eventCount: this.entries.length,
          latestEventName: this.entries[this.entries.length - 1]?.eventName ?? null,
        },
        startedAtEpochMs: this.startedAtEpochMs,
      },
      entries: this.entries.splice(0, this.entries.length),
      endedAtEpochMs: params?.final ? Date.now() + (this.clientClockOffsetMs ?? 0) : undefined,
      errorMessage: params?.errorMessage ?? null,
    };
    try {
      await fetch("/api/trace/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("[client-trace] flush failed:", error);
    }
  }

  async finish(params?: { status?: string; errorMessage?: string | null }): Promise<void> {
    this.status = params?.status ?? "completed";
    await this.flush({ final: true, errorMessage: params?.errorMessage ?? null });
  }
}

export function startClientTraceSession(
  params: ConstructorParameters<typeof ClientTraceSession>[0],
) {
  return new ClientTraceSession(params);
}
