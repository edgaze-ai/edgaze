import { NextRequest } from "next/server";

export const maxDuration = 300;

import { getUserFromBearerToken } from "@lib/auth/server";
import { getWorkflowRunById, updateWorkflowRun } from "@lib/supabase/executions";
import { loadDecryptedUserApiKeysForRun } from "@lib/user-api-keys/vault";
import {
  getEdgazeAnthropicApiKey,
  getEdgazeApiKey,
  getEdgazeGeminiApiKey,
} from "@lib/workflow/edgaze-api-key";
import {
  FREE_TIER_LLM_CHAT_ANTHROPIC_MODEL,
  FREE_TIER_LLM_CHAT_OPENAI_MODEL,
} from "@lib/workflow/llm-model-catalog";
import {
  canonicalSpecId,
  isPremiumAiSpec,
  LEGACY_OPENAI_CHAT_CONFIG_FLAG,
  providerForAiSpec,
} from "@lib/workflow/spec-id-aliases";
import type { GraphEdge, GraphNode } from "src/server/flow/types";
import { getAuthenticatedRunEntitlement } from "src/server/flow/marketplace-entitlement";
import { resolveAuthenticatedRunGraphForExecution } from "src/server/flow/load-workflow-graph";
import {
  demoTierPlatformKeyFlags,
  enforceRuntimeLimits,
  redactSecrets,
} from "src/server/flow/runtime-enforcement";
import { compileBuilderGraph, WorkflowCompileError } from "src/server/flow-v2/compiler";
import { isWorkflowExecutionV2StreamingEnabled } from "src/server/flow-v2/flags";
import { WorkflowRunOrchestrator } from "src/server/flow-v2/orchestrator";
import {
  listWorkflowRunEvents,
  loadWorkflowRunBootstrap,
  requireWorkflowRunAccess,
} from "src/server/flow-v2/read-model";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { collectTraceHeaders, startTraceSession } from "src/server/trace";
import { ensureWorkflowRunWorker } from "src/server/flow-v2/worker-service";
import type { SerializableValue } from "src/server/flow-v2/types";

type PendingV2StreamInitialization = {
  kind: "v2_stream_init";
  workflowId: string;
  workflowVersionId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  runInput: Record<string, SerializableValue>;
};

type PendingAuthenticatedV2StreamRequest = {
  kind: "v2_authenticated_stream_request";
  workflowId: string;
  authToken: string;
  rawInputs: Record<string, unknown>;
  rawUserApiKeys: Record<string, Record<string, string>>;
  modalOpenaiKey?: string;
  modalAnthropicKey?: string;
  modalGeminiKey?: string;
  forceDemoModelTier: boolean;
};

type PendingRunPreparation = PendingV2StreamInitialization | PendingAuthenticatedV2StreamRequest;

declare global {
  var __edgazeWorkflowRunPreparers: Map<string, Promise<void>> | undefined;
}

function getPreparationRegistry(): Map<string, Promise<void>> {
  if (!globalThis.__edgazeWorkflowRunPreparers) {
    globalThis.__edgazeWorkflowRunPreparers = new Map<string, Promise<void>>();
  }
  return globalThis.__edgazeWorkflowRunPreparers;
}

function readPendingInitialization(row: Record<string, unknown>): PendingRunPreparation | null {
  const checkpoint = row.checkpoint;
  if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) return null;
  const parsed = checkpoint as Record<string, unknown>;
  if (parsed.kind === "v2_stream_init") {
    if (
      typeof parsed.workflowId !== "string" ||
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.edges)
    ) {
      return null;
    }
    if (!parsed.runInput || typeof parsed.runInput !== "object" || Array.isArray(parsed.runInput)) {
      return null;
    }
    return {
      kind: "v2_stream_init",
      workflowId: parsed.workflowId,
      workflowVersionId:
        typeof parsed.workflowVersionId === "string" ? parsed.workflowVersionId : null,
      nodes: parsed.nodes as GraphNode[],
      edges: parsed.edges as GraphEdge[],
      runInput: parsed.runInput as Record<string, SerializableValue>,
    };
  }
  if (parsed.kind === "v2_authenticated_stream_request") {
    if (
      typeof parsed.workflowId !== "string" ||
      !parsed.rawInputs ||
      typeof parsed.rawInputs !== "object" ||
      Array.isArray(parsed.rawInputs) ||
      !parsed.rawUserApiKeys ||
      typeof parsed.rawUserApiKeys !== "object" ||
      Array.isArray(parsed.rawUserApiKeys)
    ) {
      return null;
    }
    return {
      kind: "v2_authenticated_stream_request",
      workflowId: parsed.workflowId,
      authToken: typeof parsed.authToken === "string" ? parsed.authToken : "",
      rawInputs: parsed.rawInputs as Record<string, unknown>,
      rawUserApiKeys: parsed.rawUserApiKeys as Record<string, Record<string, string>>,
      modalOpenaiKey: typeof parsed.modalOpenaiKey === "string" ? parsed.modalOpenaiKey : undefined,
      modalAnthropicKey:
        typeof parsed.modalAnthropicKey === "string" ? parsed.modalAnthropicKey : undefined,
      modalGeminiKey: typeof parsed.modalGeminiKey === "string" ? parsed.modalGeminiKey : undefined,
      forceDemoModelTier: parsed.forceDemoModelTier === true,
    };
  }
  return null;
}

async function ensureWorkflowRunPrepared(runId: string): Promise<void> {
  const registry = getPreparationRegistry();
  const existing = registry.get(runId);
  if (existing) return existing;

  const promise = (async () => {
    const rawRun = (await getWorkflowRunById(runId)) as
      | (Record<string, unknown> & {
          compiled_workflow_snapshot?: unknown;
          user_id?: unknown;
        })
      | null;
    if (!rawRun) {
      throw new Error("Run not found");
    }
    if (rawRun.compiled_workflow_snapshot) return;

    const pending = readPendingInitialization(rawRun);
    if (!pending) return;

    try {
      let compiled;
      let runInput: Record<string, SerializableValue>;
      let workflowId: string;

      if (pending.kind === "v2_authenticated_stream_request") {
        const auth = await getUserFromBearerToken(pending.authToken);
        if (!auth.user) {
          throw new Error(auth.error || "Authentication required");
        }
        const userId = auth.user.id;
        if (!userId) {
          throw new Error("Run is missing a valid owner for stream preparation.");
        }

        await updateWorkflowRun(runId, { user_id: userId });

        const entitlement = await getAuthenticatedRunEntitlement(userId, pending.workflowId, false);
        if (!entitlement.ok) {
          throw new Error(entitlement.message);
        }

        const graph = await resolveAuthenticatedRunGraphForExecution({
          userId,
          workflowId: pending.workflowId,
          entitlement: {
            useServerMarketplaceGraph: entitlement.useServerMarketplaceGraph,
            draftIdForCount: entitlement.draftIdForCount,
          },
        });
        if (!graph) {
          throw new Error("Failed to load workflow for execution.");
        }

        const vaultKeys = /^[0-9a-f-]{36}$/i.test(userId)
          ? await loadDecryptedUserApiKeysForRun(userId)
          : {};
        const effectiveOpenaiKey = pending.modalOpenaiKey?.trim() || vaultKeys.openai?.trim() || "";
        const effectiveAnthropicKey =
          pending.modalAnthropicKey?.trim() || vaultKeys.anthropic?.trim() || "";
        const effectiveGeminiKey = pending.modalGeminiKey?.trim() || vaultKeys.gemini?.trim() || "";

        const mergedUserApiKeys = { ...pending.rawUserApiKeys };
        for (const node of graph.nodes) {
          const specId = node.data?.specId ?? "";
          if (!isPremiumAiSpec(specId)) continue;
          const existingKey = mergedUserApiKeys[node.id]?.apiKey?.trim();
          if (existingKey) continue;
          const provider = providerForAiSpec(
            specId,
            node.data?.config as Record<string, unknown> | undefined,
          );
          if (provider === "openai" && effectiveOpenaiKey) {
            mergedUserApiKeys[node.id] = { apiKey: effectiveOpenaiKey };
          } else if (provider === "anthropic" && effectiveAnthropicKey) {
            mergedUserApiKeys[node.id] = { apiKey: effectiveAnthropicKey };
          } else if (provider === "google" && effectiveGeminiKey) {
            mergedUserApiKeys[node.id] = { apiKey: effectiveGeminiKey };
          }
        }

        let enforcement = await enforceRuntimeLimits({
          userId,
          workflowId: pending.workflowId,
          nodes: graph.nodes,
          userApiKeys: mergedUserApiKeys,
          isDemo: false,
          isBuilderTest: false,
          draftIdForCount: entitlement.draftIdForCount,
        });

        if (
          pending.forceDemoModelTier === true &&
          enforcement.allowed &&
          enforcement.freeRunsRemaining > 0
        ) {
          enforcement = {
            ...enforcement,
            ...demoTierPlatformKeyFlags(graph.nodes),
          };
        }

        if (!enforcement.allowed) {
          throw new Error(enforcement.error || "Runtime limit exceeded");
        }

        const enrichedInputs: Record<string, unknown> = { ...pending.rawInputs };
        if (enforcement.useEdgazeAnthropic) {
          enrichedInputs.__platform_llm_chat_model = FREE_TIER_LLM_CHAT_ANTHROPIC_MODEL;
        } else if (enforcement.useEdgazeOpenAI) {
          enrichedInputs.__platform_llm_chat_model = FREE_TIER_LLM_CHAT_OPENAI_MODEL;
        }

        for (const node of graph.nodes) {
          const specId = node.data?.specId ?? "";
          if (!isPremiumAiSpec(specId)) continue;
          const config = node.data?.config ?? {};
          let provider = providerForAiSpec(specId, config);
          if (
            canonicalSpecId(specId) === "llm-chat" &&
            specId !== "openai-chat" &&
            config?.[LEGACY_OPENAI_CHAT_CONFIG_FLAG] !== true
          ) {
            const p0 = providerForAiSpec(specId, config);
            const userKeyForModel =
              (p0 === "openai" && effectiveOpenaiKey) ||
              (p0 === "anthropic" && effectiveAnthropicKey) ||
              (p0 === "google" && effectiveGeminiKey);
            const configKey = config?.apiKey;
            if (!userKeyForModel && !(typeof configKey === "string" && configKey.trim())) {
              if (enforcement.useEdgazeAnthropic) provider = "anthropic";
              else if (enforcement.useEdgazeOpenAI) provider = "openai";
            }
          }

          const modalKey =
            (provider === "openai" && effectiveOpenaiKey) ||
            (provider === "anthropic" && effectiveAnthropicKey) ||
            (provider === "google" && effectiveGeminiKey) ||
            null;
          let platformKey: string | null = null;
          if (!modalKey) {
            if (provider === "openai" && enforcement.useEdgazeOpenAI)
              platformKey = getEdgazeApiKey();
            if (provider === "anthropic" && enforcement.useEdgazeAnthropic)
              platformKey = getEdgazeAnthropicApiKey();
            if (provider === "google" && enforcement.useEdgazeGemini)
              platformKey = getEdgazeGeminiApiKey();
          }

          if (modalKey) {
            enrichedInputs[`__api_key_${node.id}`] = modalKey;
          } else if (platformKey) {
            enrichedInputs[`__api_key_${node.id}`] = platformKey;
          } else {
            const nodeKeys = mergedUserApiKeys[node.id];
            if (nodeKeys?.apiKey) {
              enrichedInputs[`__api_key_${node.id}`] = nodeKeys.apiKey;
            } else {
              const configKey = node.data?.config?.apiKey;
              if (configKey && typeof configKey === "string" && configKey.trim()) {
                enrichedInputs[`__api_key_${node.id}`] = configKey.trim();
              }
            }
          }
        }

        workflowId = pending.workflowId;
        runInput = redactSecrets({
          ...enrichedInputs,
          __workflow_id: pending.workflowId,
        }) as Record<string, SerializableValue>;
        compiled = compileBuilderGraph({
          workflowId: pending.workflowId,
          versionId: null,
          nodes: graph.nodes,
          edges: graph.edges,
        });
      } else {
        workflowId = pending.workflowId;
        runInput = pending.runInput;
        compiled = compileBuilderGraph({
          workflowId: pending.workflowId,
          versionId: pending.workflowVersionId,
          nodes: pending.nodes,
          edges: pending.edges,
        });
      }
      const orchestrator = new WorkflowRunOrchestrator(new SupabaseWorkflowExecutionRepository());
      await orchestrator.initializeRun({
        runId,
        compiled,
        runInput,
        workflowId,
      });
      await updateWorkflowRun(runId, { checkpoint: null });
    } catch (error) {
      const compileDetails = error instanceof WorkflowCompileError ? error.details : undefined;
      const errorMessage =
        error instanceof WorkflowCompileError
          ? compileDetails?.join(" ") || error.message
          : error instanceof Error
            ? error.message
            : "Run initialization failed";
      await updateWorkflowRun(runId, {
        status: "failed",
        checkpoint: null,
        error_details: {
          message: errorMessage,
          ...(compileDetails ? { details: compileDetails } : {}),
        },
      });
      throw new Error(errorMessage);
    }
  })().finally(() => {
    if (registry.get(runId) === promise) {
      registry.delete(runId);
    }
  });

  registry.set(runId, promise);
  return promise;
}

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
const SSE_IDLE_POLL_MS = 75;

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
          await trace.measure("stream.prepare_run", () => ensureWorkflowRunPrepared(runId), {
            phase: "worker",
            source: "workflow",
            payload: { runId },
          });

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
                  await trace.record({
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
                controller.enqueue(
                  encoder.encode(
                    encodeSseChunk({
                      event: "ping",
                      data: { t: Date.now() },
                    }),
                  ),
                );
                await trace.record({
                  eventName: "stream.ping_emitted",
                  severity: "debug",
                  payload: { runId, afterSequence },
                });
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
                await trace.record({
                  eventName: "stream.periodic_snapshot_emitted",
                  payload: {
                    runId,
                    lastEventSequence: refresh.run.lastEventSequence,
                    runStatus: refresh.run.status,
                  },
                });
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
