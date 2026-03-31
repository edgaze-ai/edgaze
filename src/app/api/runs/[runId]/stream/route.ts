import { NextRequest } from "next/server";

import { isWorkflowExecutionV2StreamingEnabled } from "src/server/flow-v2/flags";
import {
  listWorkflowRunEvents,
  loadWorkflowRunBootstrap,
  requireWorkflowRunAccess,
} from "src/server/flow-v2/read-model";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { ensureWorkflowRunWorker } from "src/server/flow-v2/worker-service";

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

const PERIODIC_SNAPSHOT_MS = 3000;
/** When no new events, poll DB this often so the UI tracks real execution without ~1s artificial lag. */
const SSE_IDLE_POLL_MS = 200;

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  if (!isWorkflowExecutionV2StreamingEnabled()) {
    return new Response(JSON.stringify({ ok: false, error: "Streaming is disabled" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { runId } = await params;

  try {
    await requireWorkflowRunAccess(req, runId);
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
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const initialAfterSequence = parseAfterSequence(req);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let afterSequence = initialAfterSequence;

      try {
        controller.enqueue(encoder.encode(encodeSseChunk({ comment: "connected" })));

        const bootstrap = await loadWorkflowRunBootstrap({
          runId,
          afterSequence: initialAfterSequence,
          eventLimit: 500,
        });

        const shouldRunWorker =
          bootstrap.run.status !== "completed" &&
          bootstrap.run.status !== "failed" &&
          bootstrap.run.status !== "cancelled";

        const activeWorker = shouldRunWorker
          ? ensureWorkflowRunWorker({
              runId,
              repository: new SupabaseWorkflowExecutionRepository(),
              workerId: `stream:${runId}`,
            })
          : null;

        controller.enqueue(
          encoder.encode(
            encodeSseChunk({
              event: "snapshot",
              data: bootstrap,
            }),
          ),
        );
        afterSequence = Math.max(afterSequence, Number(bootstrap.run.lastEventSequence ?? 0));

        let lastPeriodicSnapshotAt = Date.now();

        const pollLoop = async () => {
          while (!req.signal.aborted) {
            const [latest, events] = await Promise.all([
              loadWorkflowRunBootstrap({
                runId,
                afterSequence: 0,
                eventLimit: 0,
              }),
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
              }
            } else {
              controller.enqueue(encoder.encode(encodeSseChunk({ comment: "keepalive" })));
            }

            const isTerminal =
              latest.run.status === "completed" ||
              latest.run.status === "failed" ||
              latest.run.status === "cancelled";

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
            }

            if (isTerminal && afterSequence >= latest.run.lastEventSequence) {
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
              break;
            }

            await waitWithAbort(req.signal, events.length > 0 ? 0 : SSE_IDLE_POLL_MS);
          }
        };

        await Promise.all([pollLoop(), activeWorker?.promise ?? Promise.resolve()]);
      } catch (error) {
        if (!req.signal.aborted) {
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
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
