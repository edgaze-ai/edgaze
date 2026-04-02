import { randomUUID } from "node:crypto";

import { redactSecrets } from "src/server/flow/runtime-enforcement";

import { createSupabaseAdminClient } from "@lib/supabase/admin";

export type TraceSessionKind =
  | "request"
  | "workflow"
  | "stream"
  | "client"
  | "background_job"
  | "admin";

export type TracePhase =
  | "request"
  | "worker"
  | "stream"
  | "client_render"
  | "background_job"
  | "admin";

export type TraceSource = "server" | "workflow" | "stream" | "client" | "background_job" | "admin";
export type TraceSeverity = "debug" | "info" | "warn" | "error";

export type TraceSessionFields = {
  id: string;
  kind: TraceSessionKind;
  source: TraceSource;
  phase: TracePhase;
  routeId?: string | null;
  method?: string | null;
  requestPath?: string | null;
  requestQuery?: string | null;
  correlationId?: string | null;
  rootCorrelationId?: string | null;
  clientSessionId?: string | null;
  actorId?: string | null;
  workflowId?: string | null;
  workflowRunId?: string | null;
  analyticsRunId?: string | null;
  status?: string | null;
  responseStatus?: number | null;
  errorMessage?: string | null;
  startedAtEpochMs: number;
  lastEventAtEpochMs: number;
  endedAtEpochMs?: number | null;
  durationMs?: number | null;
  eventCount: number;
  clientClockOffsetMs?: number | null;
  context: Record<string, unknown>;
  summary: Record<string, unknown>;
};

export type TraceEntryInput = {
  phase?: TracePhase;
  source?: TraceSource;
  eventName: string;
  severity?: TraceSeverity;
  timestampEpochMs?: number;
  durationMs?: number | null;
  routeId?: string | null;
  workflowRunId?: string | null;
  analyticsRunId?: string | null;
  nodeId?: string | null;
  attemptNumber?: number | null;
  streamId?: string | null;
  chunkSequence?: number | null;
  httpStatus?: number | null;
  payload?: unknown;
};

type TraceEntryRow = {
  trace_session_id: string;
  sequence: number;
  phase: TracePhase;
  source: TraceSource;
  event_name: string;
  severity: TraceSeverity;
  timestamp_epoch_ms: number;
  since_session_start_ms: number;
  duration_ms: number | null;
  route_id: string | null;
  workflow_run_id: string | null;
  analytics_run_id: string | null;
  node_id: string | null;
  attempt_number: number | null;
  stream_id: string | null;
  chunk_sequence: number | null;
  http_status: number | null;
  payload_size_bytes: number;
  payload: Record<string, unknown>;
};

declare global {
  var __edgazeTraceRecorderRegistry: Map<string, TraceSessionRecorder> | undefined;
}

const MAX_TRACE_STRING_LENGTH = 48_000;
const MAX_TRACE_ARRAY_LENGTH = 100;
const MAX_TRACE_OBJECT_KEYS = 120;
const AUTO_FLUSH_ENTRY_COUNT = 40;

function sanitizeHeaderValue(key: string, value: string): string {
  const normalized = key.toLowerCase();
  if (
    normalized === "authorization" ||
    normalized === "cookie" ||
    normalized === "set-cookie" ||
    normalized.includes("token") ||
    normalized.includes("secret")
  ) {
    return "***REDACTED***";
  }
  return value.length > 1024 ? `${value.slice(0, 1024)}…` : value;
}

export function collectTraceHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = sanitizeHeaderValue(key, value);
  });
  return out;
}

function clampTraceValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[MaxDepth]";
  if (typeof value === "string") {
    return value.length > MAX_TRACE_STRING_LENGTH
      ? `${value.slice(0, MAX_TRACE_STRING_LENGTH)}…`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    const trimmed = value
      .slice(0, MAX_TRACE_ARRAY_LENGTH)
      .map((item) => clampTraceValue(item, depth + 1));
    if (value.length > MAX_TRACE_ARRAY_LENGTH) {
      trimmed.push(`[Truncated ${value.length - MAX_TRACE_ARRAY_LENGTH} items]`);
    }
    return trimmed;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_TRACE_OBJECT_KEYS,
    );
    const trimmed = Object.fromEntries(
      entries.map(([key, item]) => [key, clampTraceValue(item, depth + 1)]),
    );
    if (Object.keys(value as Record<string, unknown>).length > MAX_TRACE_OBJECT_KEYS) {
      trimmed.__truncated_keys__ =
        Object.keys(value as Record<string, unknown>).length - MAX_TRACE_OBJECT_KEYS;
    }
    return trimmed;
  }
  return String(value);
}

export function sanitizeTracePayload(payload: unknown): Record<string, unknown> {
  const redacted = redactSecrets(payload);
  const clamped = clampTraceValue(redacted);
  if (!clamped || typeof clamped !== "object" || Array.isArray(clamped)) {
    return { value: clamped };
  }
  return clamped as Record<string, unknown>;
}

function estimatePayloadSizeBytes(payload: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch {
    return 0;
  }
}

function toSessionUpsertRow(session: TraceSessionFields) {
  return {
    id: session.id,
    kind: session.kind,
    source: session.source,
    phase: session.phase,
    route_id: session.routeId ?? null,
    method: session.method ?? null,
    request_path: session.requestPath ?? null,
    request_query: session.requestQuery ?? null,
    correlation_id: session.correlationId ?? null,
    root_correlation_id: session.rootCorrelationId ?? null,
    client_session_id: session.clientSessionId ?? null,
    actor_id: session.actorId ?? null,
    workflow_id: session.workflowId ?? null,
    workflow_run_id: session.workflowRunId ?? null,
    analytics_run_id: session.analyticsRunId ?? null,
    status: session.status ?? null,
    response_status: session.responseStatus ?? null,
    error_message: session.errorMessage ?? null,
    started_at_epoch_ms: session.startedAtEpochMs,
    last_event_at_epoch_ms: session.lastEventAtEpochMs,
    ended_at_epoch_ms: session.endedAtEpochMs ?? null,
    duration_ms: session.durationMs ?? null,
    event_count: session.eventCount,
    client_clock_offset_ms: session.clientClockOffsetMs ?? null,
    context: sanitizeTracePayload(session.context),
    summary: sanitizeTracePayload(session.summary),
  };
}

export class TraceSessionRecorder {
  private readonly session: TraceSessionFields;
  private nextSequence = 1;
  private buffer: TraceEntryRow[] = [];
  private flushPromise: Promise<void> = Promise.resolve();
  private sessionDirty = true;
  private flushFailureCount = 0;
  private lastFlushErrorMessage: string | null = null;

  constructor(init: {
    id?: string;
    kind: TraceSessionKind;
    source: TraceSource;
    phase: TracePhase;
    routeId?: string | null;
    method?: string | null;
    requestPath?: string | null;
    requestQuery?: string | null;
    correlationId?: string | null;
    rootCorrelationId?: string | null;
    clientSessionId?: string | null;
    actorId?: string | null;
    workflowId?: string | null;
    workflowRunId?: string | null;
    analyticsRunId?: string | null;
    context?: Record<string, unknown>;
    summary?: Record<string, unknown>;
    startedAtEpochMs?: number;
  }) {
    const now = init.startedAtEpochMs ?? Date.now();
    this.session = {
      id: init.id ?? randomUUID(),
      kind: init.kind,
      source: init.source,
      phase: init.phase,
      routeId: init.routeId ?? null,
      method: init.method ?? null,
      requestPath: init.requestPath ?? null,
      requestQuery: init.requestQuery ?? null,
      correlationId: init.correlationId ?? null,
      rootCorrelationId: init.rootCorrelationId ?? null,
      clientSessionId: init.clientSessionId ?? null,
      actorId: init.actorId ?? null,
      workflowId: init.workflowId ?? null,
      workflowRunId: init.workflowRunId ?? null,
      analyticsRunId: init.analyticsRunId ?? null,
      status: "in_progress",
      responseStatus: null,
      errorMessage: null,
      startedAtEpochMs: now,
      lastEventAtEpochMs: now,
      endedAtEpochMs: null,
      durationMs: null,
      eventCount: 0,
      clientClockOffsetMs: null,
      context: init.context ?? {},
      summary: init.summary ?? {},
    };
  }

  get id(): string {
    return this.session.id;
  }

  responseHeaders(headers?: HeadersInit): Headers {
    const merged = new Headers(headers);
    merged.set("x-trace-session-id", this.session.id);
    merged.set("x-trace-server-epoch-ms", String(Date.now()));
    return merged;
  }

  setStatus(status: string, responseStatus?: number | null): void {
    this.session.status = status;
    if (typeof responseStatus === "number") {
      this.session.responseStatus = responseStatus;
    }
    this.sessionDirty = true;
  }

  setErrorMessage(errorMessage: string | null | undefined): void {
    this.session.errorMessage = errorMessage ?? null;
    this.sessionDirty = true;
  }

  mergeContext(context: Record<string, unknown>): void {
    this.session.context = { ...this.session.context, ...sanitizeTracePayload(context) };
    this.sessionDirty = true;
  }

  mergeSummary(summary: Record<string, unknown>): void {
    this.session.summary = { ...this.session.summary, ...sanitizeTracePayload(summary) };
    this.sessionDirty = true;
  }

  updateLinks(links: {
    workflowRunId?: string | null;
    analyticsRunId?: string | null;
    workflowId?: string | null;
    actorId?: string | null;
    correlationId?: string | null;
    rootCorrelationId?: string | null;
    clientClockOffsetMs?: number | null;
  }): void {
    if (links.workflowRunId !== undefined) this.session.workflowRunId = links.workflowRunId;
    if (links.analyticsRunId !== undefined) this.session.analyticsRunId = links.analyticsRunId;
    if (links.workflowId !== undefined) this.session.workflowId = links.workflowId;
    if (links.actorId !== undefined) this.session.actorId = links.actorId;
    if (links.correlationId !== undefined) this.session.correlationId = links.correlationId;
    if (links.rootCorrelationId !== undefined)
      this.session.rootCorrelationId = links.rootCorrelationId;
    if (links.clientClockOffsetMs !== undefined) {
      this.session.clientClockOffsetMs = links.clientClockOffsetMs;
    }
    this.sessionDirty = true;
  }

  async record(entry: TraceEntryInput): Promise<void> {
    const timestampEpochMs = entry.timestampEpochMs ?? Date.now();
    const payload = sanitizeTracePayload(entry.payload ?? {});
    const row: TraceEntryRow = {
      trace_session_id: this.session.id,
      sequence: this.nextSequence++,
      phase: entry.phase ?? this.session.phase,
      source: entry.source ?? this.session.source,
      event_name: entry.eventName,
      severity: entry.severity ?? "info",
      timestamp_epoch_ms: timestampEpochMs,
      since_session_start_ms: Math.max(0, timestampEpochMs - this.session.startedAtEpochMs),
      duration_ms: entry.durationMs ?? null,
      route_id: entry.routeId ?? this.session.routeId ?? null,
      workflow_run_id: entry.workflowRunId ?? this.session.workflowRunId ?? null,
      analytics_run_id: entry.analyticsRunId ?? this.session.analyticsRunId ?? null,
      node_id: entry.nodeId ?? null,
      attempt_number: entry.attemptNumber ?? null,
      stream_id: entry.streamId ?? null,
      chunk_sequence: entry.chunkSequence ?? null,
      http_status: entry.httpStatus ?? null,
      payload_size_bytes: estimatePayloadSizeBytes(payload),
      payload,
    };
    this.session.lastEventAtEpochMs = timestampEpochMs;
    this.session.eventCount += 1;
    this.sessionDirty = true;
    this.buffer.push(row);
    if (this.buffer.length >= AUTO_FLUSH_ENTRY_COUNT) {
      await this.flush();
    }
  }

  async measure<T>(
    eventName: string,
    operation: () => Promise<T>,
    meta?: Omit<TraceEntryInput, "eventName" | "durationMs">,
  ): Promise<T> {
    const startedAt = Date.now();
    await this.record({
      ...meta,
      eventName: `${eventName}.start`,
      severity: meta?.severity ?? "debug",
    });
    try {
      const result = await operation();
      await this.record({
        ...meta,
        eventName: `${eventName}.finish`,
        durationMs: Date.now() - startedAt,
        severity: meta?.severity ?? "info",
      });
      return result;
    } catch (error) {
      await this.record({
        ...meta,
        eventName: `${eventName}.error`,
        severity: "error",
        durationMs: Date.now() - startedAt,
        payload: {
          ...(meta?.payload && typeof meta.payload === "object" ? (meta.payload as object) : {}),
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { message: String(error) },
        },
      });
      throw error;
    }
  }

  async flush(): Promise<void> {
    const entries = this.buffer.splice(0, this.buffer.length);
    const shouldUpsertSession = this.sessionDirty || entries.length === 0;
    this.sessionDirty = false;
    this.flushPromise = this.flushPromise
      .then(async () => {
        const supabase = createSupabaseAdminClient() as any;
        if (shouldUpsertSession) {
          const { error: sessionError } = await supabase
            .from("trace_sessions")
            .upsert(toSessionUpsertRow(this.session), { onConflict: "id" });
          if (sessionError) throw sessionError;
        }
        if (entries.length > 0) {
          const { error: entriesError } = await supabase.from("trace_entries").insert(entries);
          if (entriesError) throw entriesError;
        }
        this.lastFlushErrorMessage = null;
      })
      .catch((error) => {
        if (entries.length > 0) {
          this.buffer = [...entries, ...this.buffer];
        }
        this.flushFailureCount += 1;
        this.lastFlushErrorMessage = error instanceof Error ? error.message : String(error);
        this.session.summary = {
          ...this.session.summary,
          traceFlushFailureCount: this.flushFailureCount,
          lastTraceFlushError: this.lastFlushErrorMessage,
        };
        this.sessionDirty = true;
        console.error("[trace] flush failed:", error);
      });
    await this.flushPromise;
  }

  async finish(params?: {
    status?: string;
    responseStatus?: number | null;
    errorMessage?: string | null;
    summary?: Record<string, unknown>;
  }): Promise<void> {
    const endedAtEpochMs = Date.now();
    if (params?.status) this.session.status = params.status;
    if (params?.responseStatus !== undefined) this.session.responseStatus = params.responseStatus;
    if (params?.errorMessage !== undefined) this.session.errorMessage = params.errorMessage;
    if (params?.summary) {
      this.session.summary = { ...this.session.summary, ...sanitizeTracePayload(params.summary) };
    }
    this.session.endedAtEpochMs = endedAtEpochMs;
    this.session.durationMs = Math.max(0, endedAtEpochMs - this.session.startedAtEpochMs);
    this.session.lastEventAtEpochMs = endedAtEpochMs;
    this.sessionDirty = true;
    await this.flush();
  }
}

export function startTraceSession(init: ConstructorParameters<typeof TraceSessionRecorder>[0]) {
  return new TraceSessionRecorder(init);
}

function getTraceRegistry(): Map<string, TraceSessionRecorder> {
  if (!globalThis.__edgazeTraceRecorderRegistry) {
    globalThis.__edgazeTraceRecorderRegistry = new Map<string, TraceSessionRecorder>();
  }
  return globalThis.__edgazeTraceRecorderRegistry;
}

export function getTraceSession(key: string): TraceSessionRecorder | null {
  return getTraceRegistry().get(key) ?? null;
}

export function getOrCreateTraceSession(
  key: string,
  init: ConstructorParameters<typeof TraceSessionRecorder>[0],
): TraceSessionRecorder {
  const registry = getTraceRegistry();
  const existing = registry.get(key);
  if (existing) return existing;
  const created = new TraceSessionRecorder(init);
  registry.set(key, created);
  return created;
}

export function releaseTraceSession(key: string): void {
  getTraceRegistry().delete(key);
}
