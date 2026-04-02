import type { ClientTraceSession } from "./client-trace";

export type RunSessionBootstrapResponse = {
  ok: true;
  run: Record<string, unknown>;
  nodes: Array<Record<string, unknown>>;
  attempts: Array<Record<string, unknown>>;
  dependencyStateByNodeId: Record<string, Array<Record<string, unknown>>>;
  events: Array<Record<string, unknown>>;
};

export type RunSessionStreamEvent = {
  sequence?: number;
  runId?: string;
  createdAt?: string;
  type: string;
  payload?: Record<string, unknown>;
};

export type RunSessionTransportState = "connecting" | "live" | "reconnecting" | "degraded";

export function drainReadableStream(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  void (async () => {
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      // Ignore disconnects while the bootstrap handoff stream drains.
    } finally {
      reader.releaseLock();
    }
  })();
}

/** Minimal headers for authenticated GETs (bootstrap + SSE). Avoid Content-Type on GET — some proxies/WAFs reject it. */
function buildRunSessionGetHeaders(accessToken?: string | null): HeadersInit {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}

export async function fetchRunSessionBootstrap(params: {
  runId: string;
  accessToken?: string | null;
  runAccessToken?: string | null;
  afterSequence?: number;
  signal?: AbortSignal;
}): Promise<RunSessionBootstrapResponse> {
  const searchParams = new URLSearchParams();
  if (typeof params.afterSequence === "number" && params.afterSequence > 0) {
    searchParams.set("afterSequence", String(params.afterSequence));
  }
  if (params.runAccessToken) {
    searchParams.set("runAccessToken", params.runAccessToken);
  }
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const response = await fetch(`/api/runs/${params.runId}${query}`, {
    method: "GET",
    headers: buildRunSessionGetHeaders(params.accessToken),
    credentials: "include",
    signal: params.signal,
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Failed to load run session (${response.status})`);
  }

  return payload as RunSessionBootstrapResponse;
}

function buildStreamRequest(params: {
  runId: string;
  accessToken?: string | null;
  runAccessToken?: string | null;
  afterSequence?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.runAccessToken) {
    searchParams.set("runAccessToken", params.runAccessToken);
  }
  if (typeof params.afterSequence === "number" && params.afterSequence > 0) {
    searchParams.set("afterSequence", String(params.afterSequence));
  }
  const query = searchParams.toString();
  return {
    url: `/api/runs/${params.runId}/stream${query.length > 0 ? `?${query}` : ""}`,
    headers: {
      Accept: "text/event-stream",
      ...buildRunSessionGetHeaders(params.accessToken),
      ...(typeof params.afterSequence === "number" && params.afterSequence > 0
        ? { "Last-Event-ID": String(params.afterSequence) }
        : {}),
    } satisfies HeadersInit,
  };
}

function waitWithAbort(signal: AbortSignal, delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Aborted"));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason instanceof Error ? signal.reason : new Error("Aborted"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function parseSseEventChunk(chunk: string): {
  event?: string;
  id?: string;
  data?: string;
} {
  const lines = chunk.split("\n");
  const dataLines: string[] = [];
  let event: string | undefined;
  let id: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("id:")) {
      id = line.slice("id:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  return {
    event,
    id,
    data: dataLines.length > 0 ? dataLines.join("\n") : undefined,
  };
}

const DEFAULT_RUN_SESSION_MAX_WALL_MS = 45 * 60 * 1000;

export async function streamRunSession(params: {
  runId: string;
  accessToken?: string | null;
  runAccessToken?: string | null;
  signal: AbortSignal;
  clientTrace?: ClientTraceSession | null;
  onSnapshot: (bootstrap: RunSessionBootstrapResponse) => void | Promise<void>;
  onEvent?: (event: RunSessionStreamEvent) => void | Promise<void>;
  /** SSE ping (~idle poll): keep UI “fresh” so we don’t look stalled while waiting on DB/network. */
  onPing?: () => void | Promise<void>;
  onTransportState?: (
    state: RunSessionTransportState,
    meta?: { attempt: number; lastSequence: number },
  ) => void | Promise<void>;
  /** Hard stop for reconnect loops when the server never reaches a terminal snapshot (default 45m). */
  maxWallClockMs?: number;
}): Promise<void> {
  let attempt = 0;
  let lastSequence = 0;
  let isTerminal = false;
  let sawSnapshot = false;
  const sessionStarted = Date.now();
  const maxWall = params.maxWallClockMs ?? DEFAULT_RUN_SESSION_MAX_WALL_MS;
  let firstChunkSeen = false;

  const flushChunks = async (chunks: string[]) => {
    for (const chunk of chunks) {
      const parsed = parseSseEventChunk(chunk);
      if (!parsed.event || !parsed.data) continue;
      if (!firstChunkSeen) {
        firstChunkSeen = true;
        params.clientTrace?.record({
          phase: "stream",
          eventName: "stream.first_chunk_received",
          durationMs: Date.now() - sessionStarted,
          payload: { runId: params.runId, lastSequence },
        });
      }

      const payload = JSON.parse(parsed.data) as Record<string, unknown>;
      if (parsed.event === "ping") {
        params.clientTrace?.record({
          phase: "stream",
          eventName: "stream.ping_received",
          severity: "debug",
          payload: { runId: params.runId, lastSequence },
        });
        await params.onPing?.();
        continue;
      }
      if (parsed.event === "snapshot") {
        const bootstrap = payload as RunSessionBootstrapResponse;
        const bootstrapSequence = Number(bootstrap.run?.lastEventSequence ?? 0);
        if (bootstrapSequence > lastSequence) {
          lastSequence = bootstrapSequence;
        }
        const status = String(bootstrap.run?.status ?? "");
        isTerminal = status === "completed" || status === "failed" || status === "cancelled";
        sawSnapshot = true;
        params.clientTrace?.record({
          phase: "stream",
          eventName: "stream.snapshot_received",
          chunkSequence: bootstrapSequence,
          payload: {
            runId: params.runId,
            runStatus: status,
            lastEventSequence: bootstrapSequence,
            eventCount: Array.isArray(bootstrap.events) ? bootstrap.events.length : 0,
          },
        });
        await params.onSnapshot(bootstrap);
        continue;
      }
      if (parsed.event === "error") {
        params.clientTrace?.record({
          phase: "stream",
          eventName: "stream.error_payload_received",
          severity: "error",
          payload: {
            runId: params.runId,
            error: typeof payload.error === "string" ? payload.error : "Run session stream failed",
          },
        });
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Run session stream failed",
        );
      }

      const event = {
        ...(payload as Record<string, unknown>),
        sequence: parsed.id ? Number(parsed.id) : undefined,
        type: parsed.event,
      } as RunSessionStreamEvent;
      if (typeof event.sequence === "number" && event.sequence > lastSequence) {
        lastSequence = event.sequence;
      }
      if (event.type === "run.completed") {
        const status = typeof event.payload?.status === "string" ? event.payload.status : undefined;
        const outcome =
          typeof event.payload?.outcome === "string" ? event.payload.outcome : undefined;
        isTerminal =
          status === "completed" ||
          status === "failed" ||
          status === "cancelled" ||
          outcome === "cancelled" ||
          outcome === "failed" ||
          outcome === "completed_with_errors";
      }
      params.clientTrace?.record({
        phase: "stream",
        eventName: "stream.event_received",
        chunkSequence: typeof event.sequence === "number" ? event.sequence : null,
        payload: {
          runId: params.runId,
          eventType: event.type,
          lastSequence,
        },
      });
      await params.onEvent?.(event);
    }
  };

  while (!params.signal.aborted) {
    if (Date.now() - sessionStarted > maxWall) {
      throw new Error("Run session exceeded maximum wait time. Try refreshing the page.");
    }
    attempt += 1;
    const transportState =
      attempt === 1 ? "connecting" : attempt >= 3 ? "degraded" : "reconnecting";
    await params.onTransportState?.(transportState, { attempt, lastSequence });
    params.clientTrace?.record({
      phase: "stream",
      eventName: "stream.transport_state",
      severity: attempt >= 3 ? "warn" : "info",
      payload: { runId: params.runId, state: transportState, attempt, lastSequence },
    });

    const request = buildStreamRequest({
      runId: params.runId,
      accessToken: params.accessToken,
      runAccessToken: params.runAccessToken,
      afterSequence: lastSequence,
    });

    const requestStartedAt = Date.now();
    const response = await fetch(request.url, {
      method: "GET",
      headers: request.headers,
      credentials: "include",
      signal: params.signal,
    });
    params.clientTrace?.setClockFromServerEpoch(response.headers.get("x-trace-server-epoch-ms"));
    params.clientTrace?.record({
      phase: "stream",
      eventName: "stream.response_headers_received",
      durationMs: Date.now() - requestStartedAt,
      httpStatus: response.status,
      payload: {
        runId: params.runId,
        attempt,
        ok: response.ok,
        contentType: response.headers.get("content-type"),
        traceSessionId: response.headers.get("x-trace-session-id"),
      },
    });

    if (!response.ok || !response.body) {
      let payload: any = null;
      try {
        payload = await response.json();
      } catch {}
      params.clientTrace?.record({
        phase: "stream",
        eventName: "stream.response_failed",
        severity: "error",
        httpStatus: response.status,
        payload: {
          runId: params.runId,
          attempt,
          error: payload?.error || `Failed to stream run session (${response.status})`,
        },
      });
      throw new Error(payload?.error || `Failed to stream run session (${response.status})`);
    }

    await params.onTransportState?.("live", { attempt, lastSequence });
    params.clientTrace?.record({
      phase: "stream",
      eventName: "stream.transport_state",
      payload: { runId: params.runId, state: "live", attempt, lastSequence },
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!params.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim().length > 0) {
          await flushChunks([buffer]);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      await flushChunks(chunks);
    }

    if (params.signal.aborted || (isTerminal && sawSnapshot)) {
      params.clientTrace?.record({
        phase: "stream",
        eventName: "stream.terminal_or_aborted",
        payload: {
          runId: params.runId,
          aborted: params.signal.aborted,
          isTerminal,
          sawSnapshot,
          lastSequence,
        },
      });
      return;
    }

    const backoffMs = attempt <= 1 ? 50 : Math.min(100 * 2 ** Math.min(attempt - 2, 4), 2000);
    params.clientTrace?.record({
      phase: "stream",
      eventName: "stream.reconnect_scheduled",
      severity: backoffMs >= 1000 ? "warn" : "info",
      durationMs: backoffMs,
      payload: { runId: params.runId, attempt, backoffMs, lastSequence },
    });
    await waitWithAbort(params.signal, backoffMs);
  }
}
