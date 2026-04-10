import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

import { isWorkflowExecutionV2StreamingEnabled } from "src/server/flow-v2/flags";
import {
  listWorkflowRunEvents,
  loadWorkflowRunBootstrap,
  peekWorkflowRunStatus,
  requireWorkflowRunAccess,
} from "src/server/flow-v2/read-model";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { collectTraceHeaders, startTraceSession } from "src/server/trace";
import { ensureWorkflowRunWorker } from "src/server/flow-v2/worker-service";
import { ensureWorkflowRunPrepared } from "src/server/flow-v2/ensure-workflow-run-prepared";
import { syncUnifiedRunWithWorkflowCompletion } from "@lib/supabase/runs";

function encodeSseChunk(params: {
  event?: string;
  id?: string;
  data?: unknown;
  comment?: string;
}): string {
  const lines: string[] = [];
  if (params.comment) {
    lines.push(`: ${params.comment}`);
  }
  if (params.event) {
    lines.push(`event: ${params.event}`);
  }
  if (params.id) {
    lines.push(`id: ${params.id}`);
  }
  if (params.data !== undefined) {
    const serialized = JSON.stringify(params.data);
    for (const line of serialized.split("\n")) {
      lines.push(`data: ${line}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function encodeSsePrelude(): string {
  return `: connected\n:${" ".repeat(2048)}\n\n`;
}

function parseAfterSequence(req: NextRequest): number {
  const lastEventId = req.headers.get("last-event-id");
  const afterSequenceParam = req.nextUrl.searchParams.get("afterSequence");
  const raw = lastEventId ?? afterSequenceParam ?? "0";
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function waitWithAbort(signal: AbortSignal, delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  if (signal.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("Stream aborted");
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason instanceof Error ? signal.reason : new Error("Stream aborted"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

const PERIODIC_SNAPSHOT_MS = 1000;
/** When no new events, poll DB this often so the UI tracks execution with minimal lag. */
const SSE_IDLE_POLL_MS = 35;

function isTerminalWorkflowRunRowStatus(status: string): boolean {
  return (
    status === "completed" || status === "failed" || status === "cancelled" || status === "timeout"
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const trace = startTraceSession({
    kind: "stream",
    source: "stream",
    phase: "stream",
    routeId: "api.runs.stream",
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
  if (!isWorkflowExecutionV2StreamingEnabled()) {
    await trace.finish({
      status: "not_found",
      responseStatus: 404,
      errorMessage: "Streaming is disabled",
    });
    return new Response(JSON.stringify({ ok: false, error: "Streaming is disabled" }), {
      status: 404,
      headers: trace.responseHeaders({ "Content-Type": "application/json" }),
    });
  }

  let workflowRunRowStatus = "";
  try {
    await trace.record({
      eventName: "stream.request_received",
      payload: {
        runId,
        afterSequence: parseAfterSequence(req),
      },
    });
    const access = await trace.measure(
      "stream.verify_access",
      () => requireWorkflowRunAccess(req, runId),
      {
        payload: { runId },
      },
    );
    workflowRunRowStatus = access.workflowRunRowStatus;
    await trace.record({
      eventName: "stream.access_granted",
      payload: {
        runId,
        workflowRunRowStatus,
      },
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
    await trace.finish({
      status: "failed",
      responseStatus: status,
      errorMessage: message,
    });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: trace.responseHeaders({ "Content-Type": "application/json" }),
    });
  }

  const encoder = new TextEncoder();
  const initialAfterSequence = parseAfterSequence(req);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let afterSequence = initialAfterSequence;

      controller.enqueue(encoder.encode(encodeSsePrelude()));
      void trace.record({
        eventName: "stream.headers_flushed",
        payload: {
          runId,
          afterSequence,
          bufferedPreludeBytes: encodeSsePrelude().length,
        },
      });

      void (async () => {
        try {
          const preparePing = setInterval(() => {
            try {
              controller.enqueue(
                encoder.encode(
                  encodeSseChunk({
                    event: "ping",
                    data: { t: Date.now(), preparing: true },
                  }),
                ),
              );
            } catch {
              // controller may be closed
            }
          }, 400);
          try {
            await trace.measure("stream.prepare_run", () => ensureWorkflowRunPrepared(runId), {
              phase: "worker",
              source: "workflow",
              payload: { runId },
            });
          } finally {
            clearInterval(preparePing);
          }

          const bootstrap = await trace.measure(
            "stream.load_bootstrap",
            () =>
              loadWorkflowRunBootstrap({
                runId,
                afterSequence: initialAfterSequence,
                eventLimit: 500,
              }),
            {
              payload: {
                runId,
                afterSequence: initialAfterSequence,
                eventLimit: 500,
              },
            },
          );

          controller.enqueue(
            encoder.encode(
              encodeSseChunk({
                event: "snapshot",
                data: bootstrap,
              }),
            ),
          );
          await trace.record({
            eventName: "stream.snapshot_emitted",
            chunkSequence: Number(bootstrap.run.lastEventSequence ?? 0),
            payload: {
              runId,
              runStatus: bootstrap.run.status,
              lastEventSequence: bootstrap.run.lastEventSequence,
              eventCount: Array.isArray(bootstrap.events) ? bootstrap.events.length : 0,
            },
          });
          afterSequence = Math.max(afterSequence, Number(bootstrap.run.lastEventSequence ?? 0));

          const shouldRunWorker = !isTerminalWorkflowRunRowStatus(
            String(bootstrap.run.status ?? workflowRunRowStatus),
          );
          const activeWorker = shouldRunWorker
            ? ensureWorkflowRunWorker({
                runId,
                repository: new SupabaseWorkflowExecutionRepository(),
                workerId: `stream:${runId}`,
              })
            : null;
          await trace.record({
            eventName: shouldRunWorker ? "worker.ensured" : "worker.skipped_terminal",
            phase: "worker",
            source: "workflow",
            payload: {
              runId,
              shouldRunWorker,
              runStatus: bootstrap.run.status,
            },
          });

          let lastPeriodicSnapshotAt = Date.now();
          let unifiedAnalyticsSyncDone = false;

          const pollLoop = async () => {
            while (!req.signal.aborted) {
              // Use peek only here: loadWorkflowRunBootstrap with eventLimit 0 still loads all nodes,
              // attempts (huge inline image payloads), and — due to listWorkflowRunEvents treating limit
              // 0 as "unbounded" — every workflow_run_events row on each tick. That stalled SSE for minutes.
              const [runPeek, events] = await Promise.all([
                peekWorkflowRunStatus({ runId }),
                listWorkflowRunEvents({
                  runId,
                  afterSequence,
                  limit: 200,
                }),
              ]);

              if (events.length > 0) {
                for (const event of events) {
                  afterSequence = Math.max(afterSequence, event.sequence);
                  controller.enqueue(
                    encoder.encode(
                      encodeSseChunk({
                        id: String(event.sequence),
                        event: event.type,
                        data: event,
                      }),
                    ),
                  );
                  void trace.record({
                    eventName: "stream.event_emitted",
                    chunkSequence: event.sequence,
                    nodeId:
                      event.payload &&
                      typeof event.payload === "object" &&
                      "nodeId" in event.payload
                        ? String((event.payload as { nodeId?: unknown }).nodeId ?? "")
                        : null,
                    attemptNumber:
                      event.payload &&
                      typeof event.payload === "object" &&
                      "attemptNumber" in event.payload &&
                      typeof (event.payload as { attemptNumber?: unknown }).attemptNumber ===
                        "number"
                        ? ((event.payload as { attemptNumber?: number }).attemptNumber ?? null)
                        : null,
                    payload: {
                      runId,
                      sequence: event.sequence,
                      eventType: event.type,
                    },
                  });
                }
              } else {
                controller.enqueue(
                  encoder.encode(
                    encodeSseChunk({
                      event: "ping",
                      data: { t: Date.now() },
                    }),
                  ),
                );
                void trace.record({
                  eventName: "stream.ping_emitted",
                  severity: "debug",
                  payload: { runId, afterSequence },
                });
              }

              const runStatus = String(runPeek.status);
              const isTerminal =
                runStatus === "completed" ||
                runStatus === "failed" ||
                runStatus === "cancelled" ||
                runStatus === "timeout";

              const now = Date.now();
              if (
                !isTerminal &&
                events.length === 0 &&
                now - lastPeriodicSnapshotAt >= PERIODIC_SNAPSHOT_MS
              ) {
                const refresh = await loadWorkflowRunBootstrap({
                  runId,
                  afterSequence: 0,
                  eventLimit: 500,
                });
                controller.enqueue(
                  encoder.encode(
                    encodeSseChunk({
                      event: "snapshot",
                      data: refresh,
                    }),
                  ),
                );
                lastPeriodicSnapshotAt = now;
                void trace.record({
                  eventName: "stream.periodic_snapshot_emitted",
                  payload: {
                    runId,
                    lastEventSequence: refresh.run.lastEventSequence,
                    runStatus: refresh.run.status,
                  },
                });
              }

              if (isTerminal && !unifiedAnalyticsSyncDone) {
                unifiedAnalyticsSyncDone = true;
                try {
                  await syncUnifiedRunWithWorkflowCompletion({
                    workflowRunId: runId,
                    workflowStatus: runStatus,
                  });
                } catch (syncErr) {
                  console.error("[runs/stream] unified analytics sync failed:", syncErr);
                }
              }

              if (isTerminal && afterSequence >= runPeek.lastEventSequence) {
                const finalBootstrap = await loadWorkflowRunBootstrap({
                  runId,
                  afterSequence: 0,
                  eventLimit: 500,
                });
                controller.enqueue(
                  encoder.encode(
                    encodeSseChunk({
                      event: "snapshot",
                      data: finalBootstrap,
                    }),
                  ),
                );
                await trace.finish({
                  status: "completed",
                  responseStatus: 200,
                  summary: {
                    runStatus: finalBootstrap.run.status,
                    lastEventSequence: finalBootstrap.run.lastEventSequence,
                    polledAfterSequence: afterSequence,
                  },
                });
                break;
              }

              await waitWithAbort(req.signal, events.length > 0 ? 0 : SSE_IDLE_POLL_MS);
            }
          };

          await Promise.all([pollLoop(), activeWorker?.promise ?? Promise.resolve()]);
        } catch (error) {
          if (!req.signal.aborted) {
            await trace.record({
              eventName: "stream.error_emitted",
              severity: "error",
              payload: {
                runId,
                error: error instanceof Error ? error.message : "Stream failed",
              },
            });
            controller.enqueue(
              encoder.encode(
                encodeSseChunk({
                  event: "error",
                  data: {
                    error: error instanceof Error ? error.message : "Stream failed",
                  },
                }),
              ),
            );
            await trace.finish({
              status: "failed",
              responseStatus: 500,
              errorMessage: error instanceof Error ? error.message : "Stream failed",
            });
          } else {
            await trace.finish({
              status: "cancelled",
              responseStatus: 200,
              summary: { reason: "request_aborted" },
            });
          }
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: trace.responseHeaders({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, no-transform",
      Pragma: "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    }),
  });
}
