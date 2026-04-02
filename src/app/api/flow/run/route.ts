import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUserFromRequest } from "@lib/auth/server";
import { runFlow } from "src/server/flow/engine";
import {
  demoTierPlatformKeyFlags,
  enforceRuntimeLimits,
  redactSecrets,
} from "src/server/flow/runtime-enforcement";
import {
  createWorkflowRun,
  updateWorkflowRun,
  completeWorkflowRunAndGetCount,
  failWorkflowRunIfNonTerminal,
  getUserWorkflowRunCount,
  workflowExists,
  getWorkflowDraftId,
  getCreatorUserIdForWorkflowRun,
} from "@lib/supabase/executions";
import { createRun, updateRun } from "@lib/supabase/runs";
import { insertWorkflowRunNodes } from "@lib/supabase/workflow-run-nodes";
import {
  getWorkflowActiveVersionId,
  getWorkflowVersionById,
} from "@lib/supabase/workflow-versions";
import {
  getEdgazeApiKey,
  getEdgazeAnthropicApiKey,
  getEdgazeGeminiApiKey,
} from "@lib/workflow/edgaze-api-key";
import {
  isPremiumAiSpec,
  LEGACY_OPENAI_CHAT_CONFIG_FLAG,
  canonicalSpecId,
  providerForAiSpec,
} from "@lib/workflow/spec-id-aliases";
import {
  FREE_TIER_LLM_CHAT_ANTHROPIC_MODEL,
  FREE_TIER_LLM_CHAT_OPENAI_MODEL,
} from "@lib/workflow/llm-model-catalog";
import { simplifyWorkflowError } from "@lib/workflow/simplify-error";
import { loadDecryptedUserApiKeysForRun } from "@lib/user-api-keys/vault";
import type { GraphPayload } from "src/server/flow/types";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getAuthenticatedRunEntitlement } from "src/server/flow/marketplace-entitlement";
import {
  loadPublishedWorkflowGraphForExecution,
  resolveAuthenticatedRunGraphForExecution,
} from "src/server/flow/load-workflow-graph";
import type { GraphEdge, GraphNode } from "src/server/flow/types";
import { compileBuilderGraph, WorkflowCompileError } from "src/server/flow-v2/compiler";
import {
  isWorkflowExecutionV2CompileEnabled,
  isWorkflowExecutionV2RunnerEnabled,
} from "src/server/flow-v2/flags";
import { WorkflowRunOrchestrator } from "src/server/flow-v2/orchestrator";
import { LegacyNodeExecutorAdapter } from "src/server/flow-v2/node-executor";
import { readPayloadReferenceValue } from "src/server/flow-v2/payload-store";
import {
  loadWorkflowRunBootstrap,
  peekWorkflowRunStatus,
  type WorkflowRunBootstrap,
} from "src/server/flow-v2/read-model";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { collectTraceHeaders, startTraceSession } from "src/server/trace";
import { ensureWorkflowRunWorker } from "src/server/flow-v2/worker-service";
import type {
  CompiledWorkflowDefinition,
  RunEvent,
  SerializableValue,
} from "src/server/flow-v2/types";

export const maxDuration = 300;

const FREE_BUILDER_RUNS = 10;
const FREE_MARKETPLACE_KEY_RUNS = 10; // matches FREE_RUNS_PER_PURCHASE in runtime-enforcement

/** V2 wait/poll: avoid unbounded API loops if the worker never advances or event rows diverge from last_event_sequence. */
const V2_RUN_WAIT_DEADLINE_MS = 30 * 60 * 1000;

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

function mapV2NodeStatusToLegacy(
  status: string,
): "idle" | "ready" | "running" | "success" | "failed" | "skipped" | "blocked" | "timeout" {
  switch (status) {
    case "pending":
      return "idle";
    case "ready":
    case "queued":
    case "retry_scheduled":
      return "ready";
    case "running":
      return "running";
    case "completed":
      return "success";
    case "timed_out":
      return "timeout";
    case "blocked":
      return "blocked";
    case "skipped":
      return "skipped";
    case "cancelled":
      return "failed";
    case "failed":
    default:
      return "failed";
  }
}

function mapV2RunStatusToLegacyWorkflowStatus(
  status: string,
  outcome: string | null,
): "pending" | "running" | "completed" | "completed_with_skips" | "failed" | "cancelled" {
  if (status === "created" || status === "queued") return "pending";
  if (status === "running" || status === "cancelling") return "running";
  if (status === "cancelled" || outcome === "cancelled") return "cancelled";
  if (status === "failed" || outcome === "failed") return "failed";
  if (outcome === "completed_with_errors") return "completed_with_skips";
  return "completed";
}

function buildLegacyLogsFromV2Events(events: RunEvent[]) {
  return events.map((event) => {
    const message =
      "message" in event.payload && typeof event.payload.message === "string"
        ? event.payload.message
        : event.type;

    return {
      type:
        event.type === "node.failed" || event.type === "node.cancelled"
          ? ("error" as const)
          : event.type === "node.blocked" || event.type === "node.skipped"
            ? ("warn" as const)
            : ("start" as const),
      nodeId: "nodeId" in event.payload ? event.payload.nodeId : "workflow",
      specId: "nodeId" in event.payload ? event.payload.nodeId : "workflow",
      message,
      timestamp: Date.parse(event.createdAt) || Date.now(),
    };
  });
}

function buildLegacyRuntimeResultFromBootstrap(
  bootstrap: WorkflowRunBootstrap,
  compiled: CompiledWorkflowDefinition,
) {
  const outputsByNode: Record<string, unknown> = {};
  const nodeStatus: Record<string, string> = {};
  const compiledNodeById = new Map(compiled.nodes.map((node) => [node.id, node]));

  const unwrapLegacyNodeOutput = (nodeId: string, rawValue: unknown) => {
    const compiledNode = compiledNodeById.get(nodeId);
    if (!compiledNode || rawValue === undefined || rawValue === null) return rawValue;
    if (typeof rawValue !== "object" || Array.isArray(rawValue)) return rawValue;

    const outputRecord = rawValue as Record<string, unknown>;
    if (compiledNode.outputPorts.length === 0) {
      return outputRecord.__result__ ?? rawValue;
    }

    if (compiledNode.outputPorts.length === 1) {
      const onlyPort = compiledNode.outputPorts[0];
      return onlyPort ? (outputRecord[onlyPort.id] ?? rawValue) : rawValue;
    }

    return rawValue;
  };

  for (const node of bootstrap.nodes) {
    nodeStatus[node.nodeId] = mapV2NodeStatusToLegacy(node.status);
    const outputValue = readPayloadReferenceValue(node.outputPayload);
    if (outputValue !== undefined) {
      outputsByNode[node.nodeId] = redactSecrets(unwrapLegacyNodeOutput(node.nodeId, outputValue));
    }
  }

  const finalOutputs = compiled.nodes
    .filter((node) => node.specId === "output")
    .map((node) => ({
      nodeId: node.id,
      value: outputsByNode[node.id],
    }))
    .filter((entry) => entry.value !== undefined);

  return {
    outputsByNode,
    finalOutputs,
    logs: buildLegacyLogsFromV2Events(bootstrap.events),
    nodeStatus,
    workflowStatus: mapV2RunStatusToLegacyWorkflowStatus(
      bootstrap.run.status,
      bootstrap.run.outcome,
    ),
  };
}

function getBootstrapFailureMessage(bootstrap: WorkflowRunBootstrap): string | undefined {
  const latestFailedEvent = [...bootstrap.events].reverse().find((event) => {
    if (!("nodeId" in event.payload)) return false;
    return (
      event.type === "node.failed" ||
      event.type === "node_attempt_failed" ||
      event.type === "node.cancelled" ||
      event.type === "node.blocked"
    );
  });

  if (
    latestFailedEvent &&
    typeof latestFailedEvent.payload.message === "string" &&
    latestFailedEvent.payload.message.trim().length > 0
  ) {
    return latestFailedEvent.payload.message;
  }

  if (
    typeof bootstrap.run.errorDetails?.message === "string" &&
    bootstrap.run.errorDetails.message.trim().length > 0
  ) {
    return bootstrap.run.errorDetails.message;
  }

  return undefined;
}

function createStreamingResponseHelpers(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
) {
  let preludeSent = false;

  const writeRaw = (chunk: string) => {
    controller.enqueue(encoder.encode(chunk));
  };

  const sendPrelude = () => {
    if (preludeSent) return;
    preludeSent = true;
    // Force an early flush through intermediaries that buffer tiny chunks.
    writeRaw(`: stream-open ${Date.now()}\n:${" ".repeat(2048)}\n\n`);
  };

  const writeEvent = (obj: object) => {
    sendPrelude();
    writeRaw(`data: ${JSON.stringify(obj)}\n\n`);
  };

  return { sendPrelude, writeEvent };
}

async function finishUnifiedRun(
  unifiedRunId: string | null,
  status: "success" | "error",
  duration: number,
  errorMessage?: string,
  nodeTraces?: Array<{ tokens?: number; model?: string }>,
): Promise<void> {
  if (!unifiedRunId) return;
  const traces = nodeTraces ?? [];
  const totalTokens = traces.reduce((s, t) => s + (t.tokens ?? 0), 0);
  const model = traces.find((t) => t.model)?.model ?? null;
  try {
    await updateRun(unifiedRunId, {
      status,
      endedAt: new Date().toISOString(),
      durationMs: duration,
      errorMessage: status === "error" ? (errorMessage ?? null) : null,
      tokensIn: totalTokens > 0 ? totalTokens : null,
      tokensOut: null, // Node traces don't separate in/out
      model,
    });
  } catch (e) {
    console.error("[Runs] Update unified run failed:", e);
  }
}

export async function POST(req: Request) {
  try {
    const requestStartedAt = Date.now();
    // Parse request body first to check if this is a demo run
    const body = (await req.json()) as GraphPayload & {
      workflowId?: string;
      userApiKeys?: Record<string, Record<string, string>>;
      isDemo?: boolean;
      isBuilderTest?: boolean;
      openaiApiKey?: string;
      anthropicApiKey?: string;
      geminiApiKey?: string;
      deviceFingerprint?: string;
      stream?: boolean;
      adminDemoToken?: string;
      idempotencyKey?: string;
      /** Authenticated marketplace “Try demo” — align platform model tier with anonymous demo when still on free runs. */
      forceDemoModelTier?: boolean;
    };

    const {
      inputs = {},
      workflowId,
      userApiKeys: rawUserApiKeys = {},
      isDemo = false,
      isBuilderTest: clientIsBuilderTest = false,
      openaiApiKey: modalOpenaiKey,
      anthropicApiKey: modalAnthropicKey,
      geminiApiKey: modalGeminiKey,
      deviceFingerprint,
      stream: useStream = false,
      adminDemoToken,
      idempotencyKey,
      forceDemoModelTier = false,
    } = body;

    const requestUrl = new URL(req.url);
    const trace = startTraceSession({
      kind: "request",
      source: "server",
      phase: "request",
      routeId: "api.flow.run",
      method: req.method,
      requestPath: requestUrl.pathname,
      requestQuery: requestUrl.search,
      workflowId: typeof workflowId === "string" ? workflowId : null,
      context: {
        headers: collectTraceHeaders(req.headers),
        body,
      },
    });
    const traceJson = async (
      payload: Record<string, unknown>,
      status = 200,
      summary?: Record<string, unknown>,
    ) => {
      await trace.record({
        eventName: "request.response_ready",
        httpStatus: status,
        payload: {
          ok: payload.ok,
          handedOff: payload.handedOff,
          runId: payload.runId,
          error: payload.error,
        },
      });
      await trace.finish({
        status: status >= 400 ? "failed" : "completed",
        responseStatus: status,
        errorMessage: typeof payload.error === "string" ? payload.error : null,
        summary: {
          durationMs: Date.now() - requestStartedAt,
          workflowId,
          ...summary,
        },
      });
      return NextResponse.json(payload, {
        status,
        headers: trace.responseHeaders(),
      });
    };
    await trace.record({
      eventName: "request.received",
      payload: {
        workflowId,
        nodeCount: Array.isArray(body.nodes) ? body.nodes.length : 0,
        edgeCount: Array.isArray(body.edges) ? body.edges.length : 0,
        inputKeyCount:
          body.inputs && typeof body.inputs === "object" ? Object.keys(body.inputs).length : 0,
        useStream,
        isDemo,
        hasBearerToken: Boolean(req.headers.get("authorization")),
      },
    });

    let nodes = (body.nodes ?? []) as GraphNode[];
    let edges = (body.edges ?? []) as GraphEdge[];
    const workflowExecutionV2CompileEnabled = isWorkflowExecutionV2CompileEnabled();
    const workflowExecutionV2RunnerEnabled = isWorkflowExecutionV2RunnerEnabled();
    const authHeader = req.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!workflowId) {
      return traceJson({ ok: false, error: "workflowId is required" }, 400);
    }

    const shouldUltraFastAuthenticatedStreamConnection =
      Boolean(bearerToken) &&
      useStream &&
      workflowExecutionV2CompileEnabled &&
      workflowExecutionV2RunnerEnabled &&
      clientIsBuilderTest !== true &&
      !isDemo &&
      !(adminDemoToken && typeof adminDemoToken === "string" && adminDemoToken.length >= 16);

    if (shouldUltraFastAuthenticatedStreamConnection) {
      const runAccessToken = randomUUID();
      try {
        const run = await trace.measure(
          "ultra_fast_stream.create_run",
          () =>
            createWorkflowRun({
              workflowId,
              userId: `pending_authenticated_stream:${randomUUID()}`,
              status: "running",
              checkpoint: {
                kind: "v2_authenticated_stream_request",
                workflowId,
                authToken: bearerToken,
                rawInputs: inputs,
                rawUserApiKeys,
                modalOpenaiKey:
                  typeof modalOpenaiKey === "string" && modalOpenaiKey.trim()
                    ? modalOpenaiKey.trim()
                    : undefined,
                modalAnthropicKey:
                  typeof modalAnthropicKey === "string" && modalAnthropicKey.trim()
                    ? modalAnthropicKey.trim()
                    : undefined,
                modalGeminiKey:
                  typeof modalGeminiKey === "string" && modalGeminiKey.trim()
                    ? modalGeminiKey.trim()
                    : undefined,
                forceDemoModelTier,
              } satisfies PendingAuthenticatedV2StreamRequest,
              metadata: {
                nodeCount: nodes.length,
                edgeCount: edges.length,
                isDemo: false,
                isBuilderTest: false,
                run_access_token: runAccessToken,
              },
              idempotencyKey: null,
            }),
          {
            payload: {
              workflowId,
              nodeCount: nodes.length,
              edgeCount: edges.length,
              forceDemoModelTier,
            },
          },
        );
        trace.updateLinks({ workflowRunId: run.id, correlationId: run.id });
        return traceJson(
          {
            ok: true,
            handedOff: true,
            runId: run.id,
            runAccessToken,
          },
          200,
          { handoffMode: "ultra_fast_authenticated_stream" },
        );
      } catch (error) {
        console.error("[flow/run] failed to ultra-fast handoff authenticated stream:", error);
        await trace.record({
          eventName: "ultra_fast_stream.failed",
          severity: "error",
          payload: {
            workflowId,
            error: error instanceof Error ? error.message : "Failed to start workflow run.",
          },
        });
        return traceJson({ ok: false, error: "Failed to start workflow run." }, 500, {
          handoffMode: "ultra_fast_authenticated_stream",
        });
      }
    }

    let effectiveIsBuilderTest = false;
    let entitlementDraftId: string | null = null;
    /** True only for anonymous_demo_user / admin_demo_user — drives runtime demo fast path. */
    let isRuntimeDemo = false;

    // Auth: Bearer token only (client sends Authorization: Bearer <accessToken>). Demo runs and admin demo link allowed without auth.
    const { user, error: authError } = await trace.measure(
      "auth.resolve_user",
      () => getUserFromRequest(req),
      {
        payload: { workflowId, isDemo, hasAdminDemoToken: Boolean(adminDemoToken) },
      },
    );
    let userId: string;
    if (user) {
      userId = user.id;
      trace.updateLinks({ actorId: userId });
      const entitlement = await trace.measure(
        "auth.resolve_entitlement",
        () => getAuthenticatedRunEntitlement(userId, workflowId, clientIsBuilderTest),
        {
          payload: { userId, workflowId, clientIsBuilderTest },
        },
      );
      if (!entitlement.ok) {
        return traceJson({ ok: false, error: entitlement.message }, 403);
      }
      effectiveIsBuilderTest = entitlement.effectiveIsBuilderTest;
      entitlementDraftId = entitlement.draftIdForCount;
      try {
        const g = await trace.measure(
          "graph.resolve_authenticated",
          () =>
            resolveAuthenticatedRunGraphForExecution({
              userId,
              workflowId,
              entitlement: {
                useServerMarketplaceGraph: entitlement.useServerMarketplaceGraph,
                draftIdForCount: entitlement.draftIdForCount,
              },
            }),
          {
            payload: {
              userId,
              workflowId,
              useServerMarketplaceGraph: entitlement.useServerMarketplaceGraph,
              draftIdForCount: entitlement.draftIdForCount,
            },
          },
        );
        if (g) {
          nodes = g.nodes;
          edges = g.edges;
          await trace.record({
            eventName: "graph.resolved_authenticated",
            payload: {
              workflowId,
              nodeCount: nodes.length,
              edgeCount: edges.length,
            },
          });
        }
      } catch (e) {
        console.error("[flow/run] server graph load failed:", e);
        return traceJson({ ok: false, error: "Failed to load workflow for execution." }, 500);
      }
    } else if (
      adminDemoToken &&
      typeof adminDemoToken === "string" &&
      adminDemoToken.length >= 16
    ) {
      // Admin demo link: verify token matches workflow, bypass device limit
      const supabase = createSupabaseAdminClient();
      const { data: wf, error: wfError } = await supabase
        .from("workflows")
        .select("id")
        .eq("id", workflowId)
        .eq("demo_mode_enabled", true)
        .eq("demo_token", adminDemoToken.trim())
        .maybeSingle();
      if (wfError || !wf) {
        return traceJson(
          {
            ok: false,
            error: "Invalid or expired demo link. Please use the link from the admin panel.",
          },
          403,
        );
      }
      userId = "admin_demo_user";
      isRuntimeDemo = true;
      effectiveIsBuilderTest = false;
      try {
        const g = await loadPublishedWorkflowGraphForExecution(workflowId);
        nodes = g.nodes;
        edges = g.edges;
      } catch (e) {
        console.error("[flow/run] admin demo graph load failed:", e);
        return traceJson({ ok: false, error: "Failed to load workflow for demo execution." }, 500);
      }
    } else if (isDemo) {
      // For anonymous demo runs, check server-side tracking (device fingerprint + IP)
      if (!deviceFingerprint || deviceFingerprint.length < 10) {
        return traceJson(
          {
            ok: false,
            error: "Device fingerprint is required for demo runs",
          },
          400,
        );
      }

      // Extract IP address
      const clientId = extractClientIdentifier(req);
      const ipAddress = clientId.type === "ip" ? clientId.identifier : "unknown";

      // Check if demo run is allowed (strict one-time check)
      const supabase = createSupabaseAdminClient();
      const { data: checkData, error: checkError } = await supabase.rpc("can_run_anonymous_demo", {
        p_workflow_id: workflowId,
        p_device_fingerprint: deviceFingerprint,
        p_ip_address: ipAddress,
      });

      if (checkError) {
        console.error("[Demo Runs] Error checking demo run eligibility:", checkError);
        return traceJson(
          {
            ok: false,
            error: "Failed to verify demo run eligibility. Please try again.",
          },
          500,
        );
      }

      if (checkData !== true) {
        // Demo run already used for this device + IP combination
        return traceJson(
          {
            ok: false,
            error:
              "You've already used your one-time demo run for this workflow. Each device and IP address combination gets one demo run.",
          },
          403,
        );
      }

      // Record the demo run (atomic operation with duplicate check)
      const { data: recordData, error: recordError } = await supabase.rpc(
        "record_anonymous_demo_run",
        {
          p_workflow_id: workflowId,
          p_device_fingerprint: deviceFingerprint,
          p_ip_address: ipAddress,
        },
      );

      if (recordError) {
        console.error("[Demo Runs] Error recording demo run:", recordError);
        return traceJson(
          {
            ok: false,
            error: "Failed to record demo run. Please try again.",
          },
          500,
        );
      }

      const recordResult = recordData as {
        success: boolean;
        allowed: boolean;
        error?: string;
      };

      if (!recordResult.success || !recordResult.allowed) {
        // Race condition: another request already recorded this demo run
        return traceJson(
          {
            ok: false,
            error: recordResult.error || "Demo run already used for this device and IP address.",
          },
          403,
        );
      }

      userId = "anonymous_demo_user";
      isRuntimeDemo = true;
      effectiveIsBuilderTest = false;
      try {
        const g = await loadPublishedWorkflowGraphForExecution(workflowId);
        nodes = g.nodes;
        edges = g.edges;
      } catch (e) {
        console.error("[flow/run] anonymous demo graph load failed:", e);
        return traceJson({ ok: false, error: "Failed to load workflow for demo execution." }, 500);
      }
    } else {
      return traceJson(
        {
          ok: false,
          error:
            authError ??
            "Authentication required. Please sign in to run workflows, or try a demo run.",
        },
        401,
      );
    }

    const vaultKeys =
      user && /^[0-9a-f-]{36}$/i.test(userId) ? await loadDecryptedUserApiKeysForRun(userId) : {};
    const effectiveOpenaiKey =
      (typeof modalOpenaiKey === "string" && modalOpenaiKey.trim()) ||
      vaultKeys.openai?.trim() ||
      "";
    const effectiveAnthropicKey =
      (typeof modalAnthropicKey === "string" && modalAnthropicKey.trim()) ||
      vaultKeys.anthropic?.trim() ||
      "";
    const effectiveGeminiKey =
      (typeof modalGeminiKey === "string" && modalGeminiKey.trim()) ||
      vaultKeys.gemini?.trim() ||
      "";

    const mergedUserApiKeys = { ...rawUserApiKeys };
    for (const n of nodes) {
      const specId = n.data?.specId ?? "";
      if (!isPremiumAiSpec(specId)) continue;
      const existing = mergedUserApiKeys[n.id]?.apiKey?.trim();
      if (existing) continue;
      const provider = providerForAiSpec(
        specId,
        n.data?.config as Record<string, unknown> | undefined,
      );
      if (provider === "openai" && effectiveOpenaiKey) {
        mergedUserApiKeys[n.id] = { apiKey: effectiveOpenaiKey };
      } else if (provider === "anthropic" && effectiveAnthropicKey) {
        mergedUserApiKeys[n.id] = { apiKey: effectiveAnthropicKey };
      } else if (provider === "google" && effectiveGeminiKey) {
        mergedUserApiKeys[n.id] = { apiKey: effectiveGeminiKey };
      }
    }

    // Runtime enforcement: check free runs and BYO keys
    let enforcement = await trace.measure(
      "runtime.enforce_limits",
      () =>
        enforceRuntimeLimits({
          userId,
          workflowId,
          nodes,
          userApiKeys: mergedUserApiKeys,
          isDemo: isRuntimeDemo,
          isBuilderTest: effectiveIsBuilderTest,
          draftIdForCount: entitlementDraftId,
        }),
      {
        payload: {
          userId,
          workflowId,
          nodeCount: nodes.length,
          isDemo: isRuntimeDemo,
          isBuilderTest: effectiveIsBuilderTest,
        },
      },
    );

    if (
      forceDemoModelTier === true &&
      user &&
      /^[0-9a-f-]{36}$/i.test(userId) &&
      enforcement.allowed &&
      enforcement.freeRunsRemaining > 0
    ) {
      enforcement = {
        ...enforcement,
        ...demoTierPlatformKeyFlags(nodes),
      };
    }

    if (!enforcement.allowed) {
      return traceJson(
        {
          ok: false,
          error: enforcement.error || "Runtime limit exceeded",
          requiresApiKeys: enforcement.requiresApiKeys,
          freeRunsRemaining: enforcement.freeRunsRemaining,
        },
        403,
      );
    }

    // Inject API keys into inputs for premium nodes
    const enrichedInputs: Record<string, unknown> = { ...inputs };
    const userProvidedOpenai = effectiveIsBuilderTest && Boolean(effectiveOpenaiKey);
    const userProvidedAnthropic = effectiveIsBuilderTest && Boolean(effectiveAnthropicKey);
    const userProvidedGemini = effectiveIsBuilderTest && Boolean(effectiveGeminiKey);
    if (effectiveIsBuilderTest) {
      enrichedInputs["__builder_test"] = true;
      if (userProvidedOpenai) enrichedInputs["__builder_user_key_openai"] = true;
      if (userProvidedAnthropic) enrichedInputs["__builder_user_key_anthropic"] = true;
      if (userProvidedGemini) enrichedInputs["__builder_user_key_gemini"] = true;
      if (userProvidedOpenai || userProvidedAnthropic || userProvidedGemini) {
        enrichedInputs["__builder_user_key"] = true;
      }
    }
    const edgazeOpenAI = enforcement.useEdgazeOpenAI ? getEdgazeApiKey() : null;
    const edgazeAnthropic = enforcement.useEdgazeAnthropic ? getEdgazeAnthropicApiKey() : null;
    const edgazeGemini = enforcement.useEdgazeGemini ? getEdgazeGeminiApiKey() : null;

    if (enforcement.useEdgazeAnthropic) {
      enrichedInputs["__platform_llm_chat_model"] = FREE_TIER_LLM_CHAT_ANTHROPIC_MODEL;
    } else if (enforcement.useEdgazeOpenAI) {
      enrichedInputs["__platform_llm_chat_model"] = FREE_TIER_LLM_CHAT_OPENAI_MODEL;
    }

    for (const node of nodes) {
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
      let modalKey: string | null = null;
      if (effectiveIsBuilderTest) {
        if (provider === "openai" && effectiveOpenaiKey) modalKey = effectiveOpenaiKey;
        if (provider === "anthropic" && effectiveAnthropicKey) modalKey = effectiveAnthropicKey;
        if (provider === "google" && effectiveGeminiKey) modalKey = effectiveGeminiKey;
      }
      let platformKey: string | null = null;
      if (!modalKey) {
        if (provider === "openai" && edgazeOpenAI) platformKey = edgazeOpenAI;
        if (provider === "anthropic" && edgazeAnthropic) platformKey = edgazeAnthropic;
        if (provider === "google" && edgazeGemini) platformKey = edgazeGemini;
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

    // Create run record for authenticated users only (demo user_id is not a valid UUID for FK)
    // Check workflow_drafts if workflow doesn't exist (builder test runs)
    let runId: string | null = null;
    let unifiedRunId: string | null = null; // For runs table (analytics)
    let draftId: string | null = entitlementDraftId;
    let workflowVersionId: string | null = null;
    let workflowVersionHash: string | null = null;
    let compiledWorkflow: CompiledWorkflowDefinition | null = null;
    const isTrackedUser = userId !== "anonymous_demo_user";
    const isValidRunnerUuid = /^[0-9a-f-]{36}$/i.test(userId ?? "");
    const shouldUseV2RunSessionHandoff =
      workflowExecutionV2CompileEnabled && workflowExecutionV2RunnerEnabled && useStream;
    const runAccessToken = isDemo || (useStream && isTrackedUser) ? randomUUID() : undefined;
    if (isTrackedUser) {
      try {
        const [workflowExistsInDb, draftLookup] = await Promise.all([
          workflowExists(workflowId),
          !draftId && effectiveIsBuilderTest
            ? getWorkflowDraftId(workflowId, userId)
            : Promise.resolve<string | null>(null),
        ]);
        if (!draftId && effectiveIsBuilderTest) {
          draftId = draftLookup;
          if (!workflowExistsInDb && !draftId) {
            console.warn(
              `[Run Tracking] Skipping run tracking: workflow ${workflowId} not found in workflows or drafts`,
            );
          }
        }

        if (workflowExistsInDb || draftId) {
          if (workflowExistsInDb && !effectiveIsBuilderTest && workflowId) {
            workflowVersionId = await getWorkflowActiveVersionId(workflowId);
            if (workflowVersionId) {
              const versionRow = await getWorkflowVersionById(workflowVersionId);
              workflowVersionHash = versionRow?.version_hash ?? null;
            }
          }
          const run = await createWorkflowRun({
            workflowId: workflowExistsInDb ? workflowId : null,
            draftId: draftId,
            workflowVersionId: workflowVersionId ?? undefined,
            userId,
            metadata: {
              nodeCount: nodes.length,
              edgeCount: edges.length,
              freeRunsRemaining: enforcement.freeRunsRemaining,
              isDemo: isRuntimeDemo,
              isBuilderTest: effectiveIsBuilderTest,
              workflow_version_hash: workflowVersionHash ?? undefined,
              run_access_token: runAccessToken,
            },
            idempotencyKey,
          });
          runId = run.id;
          trace.updateLinks({ workflowRunId: runId, correlationId: runId });
          await trace.record({
            eventName: "run.created",
            phase: "worker",
            source: "workflow",
            payload: {
              runId,
              workflowId,
              draftId,
              workflowExistsInDb,
              workflowVersionId,
            },
          });
          const pendingV2StreamInitialization =
            shouldUseV2RunSessionHandoff && runId
              ? ({
                  kind: "v2_stream_init",
                  workflowId,
                  workflowVersionId: workflowVersionId ?? null,
                  nodes,
                  edges,
                  runInput: redactSecrets({
                    ...enrichedInputs,
                    __workflow_id: workflowId,
                  }) as Record<string, SerializableValue>,
                } satisfies PendingV2StreamInitialization)
              : null;
          await updateWorkflowRun(runId, {
            status: "running",
            checkpoint: pendingV2StreamInitialization,
          });
          // Unified runs table (analytics)
          try {
            const creatorUserId = await getCreatorUserIdForWorkflowRun(
              workflowExistsInDb ? workflowId : null,
              draftId,
            );
            const unifiedRun = await createRun({
              kind: "workflow",
              workflowId: workflowExistsInDb ? workflowId : null,
              versionId: workflowVersionId ?? undefined,
              runnerUserId: isValidRunnerUuid ? userId : null,
              creatorUserId,
              workflowRunId: run.id,
              metadata: {
                nodeCount: nodes.length,
                isBuilderTest: effectiveIsBuilderTest,
                isDemo: isRuntimeDemo,
              },
            });
            unifiedRunId = unifiedRun.id;
            trace.updateLinks({ analyticsRunId: unifiedRunId });
            await trace.record({
              eventName: "analytics_run.created",
              phase: "admin",
              source: "admin",
              payload: {
                unifiedRunId,
                workflowRunId: run.id,
              },
            });
          } catch (runErr: unknown) {
            console.warn("[Runs] Failed to create unified run record:", runErr);
          }
          console.warn(
            `[Run Tracking] Created run ${runId} for user ${userId}, ${draftId ? `draft ${draftId}` : `workflow ${workflowId}`}, status: running`,
          );
        }
      } catch (err: any) {
        console.error("[Run Tracking] CRITICAL: Failed to create run record:", {
          error: err?.message,
          code: err?.code,
          details: err?.details,
          hint: err?.hint,
          userId,
          workflowId,
          stack: err?.stack,
        });
        // Continue execution; usage count will not increment for this run
      }
    }

    const prepareV2Run = async (): Promise<CompiledWorkflowDefinition> => {
      let preparedWorkflow: CompiledWorkflowDefinition;
      try {
        preparedWorkflow = compileBuilderGraph({
          workflowId,
          versionId: workflowVersionId,
          nodes,
          edges,
        });
      } catch (err: unknown) {
        console.error(
          "[flow/run] Workflow compile failed:",
          err instanceof WorkflowCompileError
            ? { message: err.message, details: err.details }
            : err instanceof Error
              ? { message: err.message, stack: err.stack }
              : err,
        );
        const compileError =
          err instanceof WorkflowCompileError
            ? {
                message: err.message,
                details: err.details,
              }
            : {
                message: err instanceof Error ? err.message : "Workflow compile failed",
                details: [],
              };

        if (runId) {
          try {
            await updateWorkflowRun(runId, {
              status: "failed",
              error_details: redactSecrets(compileError) as Record<string, unknown>,
            });
          } catch (updateError) {
            console.error("[flow/run] failed to persist compile error:", updateError);
          }
        }

        const detailMessage =
          compileError.details.length > 0 ? compileError.details.join(" ") : compileError.message;
        const error = Object.assign(new Error(detailMessage), {
          statusCode: 400,
          compileDetails: compileError.details,
        });
        throw error;
      }

      if (runId) {
        try {
          const orchestrator = new WorkflowRunOrchestrator(
            new SupabaseWorkflowExecutionRepository(),
          );
          await orchestrator.initializeRun({
            runId,
            compiled: preparedWorkflow,
            runInput: redactSecrets({
              ...enrichedInputs,
              __workflow_id: workflowId,
            }) as Record<string, SerializableValue>,
            workflowId,
          });
        } catch (err: unknown) {
          console.error(
            "[flow/run] Orchestrator initialization failed:",
            err instanceof Error ? { message: err.message, stack: err.stack } : err,
          );
          const errorMessage = err instanceof Error ? err.message : "Run initialization failed";

          try {
            await updateWorkflowRun(runId, {
              status: "failed",
              error_details: { message: errorMessage },
            });
          } catch (updateError) {
            console.error("[flow/run] failed to persist orchestrator error:", updateError);
          }

          throw Object.assign(new Error(`Run initialization failed: ${errorMessage}`), {
            statusCode: 500,
          });
        }
      }

      return preparedWorkflow;
    };

    const startTime = Date.now();
    let result;

    if (workflowExecutionV2CompileEnabled && !(shouldUseV2RunSessionHandoff && runId)) {
      try {
        compiledWorkflow = await prepareV2Run();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Workflow compile failed";
        if (unifiedRunId) {
          await finishUnifiedRun(unifiedRunId, "error", 0, errorMessage);
        }
        return traceJson(
          {
            ok: false,
            error: errorMessage,
            compileDetails:
              err && typeof err === "object" && "compileDetails" in err
                ? ((err as { compileDetails?: unknown }).compileDetails ?? [])
                : undefined,
            runId,
          },
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: unknown }).statusCode) || 500
            : 500,
          {
            runId,
            unifiedRunId,
          },
        );
      }
    }

    if (shouldUseV2RunSessionHandoff && runId) {
      return traceJson(
        {
          ok: true,
          handedOff: true,
          runId,
          runAccessToken,
        },
        200,
        {
          runId,
          unifiedRunId,
          handoffMode: "v2_run_session",
        },
      );
    }

    if (workflowExecutionV2RunnerEnabled && runId && compiledWorkflow) {
      const repository = new SupabaseWorkflowExecutionRepository();
      const clientId = extractClientIdentifier(req);
      const runnerDependencies = {
        repository,
        executor: new LegacyNodeExecutorAdapter(),
        workerId: `api:${runId}`,
        requestMetadata: {
          userId: userId || null,
          identifier: clientId.identifier,
          identifierType: clientId.type,
          workflowId,
        },
      } as const;

      const getUpdatedFreeRunsRemaining = async () => {
        if (!isTrackedUser) return enforcement.freeRunsRemaining;
        const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
        const freeRunLimit = effectiveIsBuilderTest ? FREE_BUILDER_RUNS : FREE_MARKETPLACE_KEY_RUNS;
        return Math.max(0, freeRunLimit - updatedRunCount);
      };

      try {
        const activeCompiledWorkflow = compiledWorkflow;
        if (!activeCompiledWorkflow) {
          throw new Error("Workflow run was not prepared before JSON execution.");
        }
        repository.primeRunCache({
          runId,
          compiled: activeCompiledWorkflow,
          runInput: redactSecrets({
            ...enrichedInputs,
            __workflow_id: workflowId,
          }) as Record<string, SerializableValue>,
        });
        ensureWorkflowRunWorker({
          runId,
          repository,
          requestMetadata: runnerDependencies.requestMetadata,
          workerId: runnerDependencies.workerId,
        });
        const waitStarted = Date.now();
        while (true) {
          if (Date.now() - waitStarted > V2_RUN_WAIT_DEADLINE_MS) {
            console.error("[flow/run] V2 JSON wait exceeded deadline", { runId });
            await failWorkflowRunIfNonTerminal(runId, {
              code: "api_wait_timeout",
              message: "Workflow run wait exceeded server time limit.",
            });
            throw new Error("Workflow run wait exceeded server time limit.");
          }

          const peek = await peekWorkflowRunStatus({ runId });
          const isTerminal =
            peek.status === "completed" || peek.status === "failed" || peek.status === "cancelled";
          if (!isTerminal) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
          }

          const finalBootstrap = await loadWorkflowRunBootstrap({
            runId,
            afterSequence: 0,
            eventLimit: 1000,
          });
          const safeResult = buildLegacyRuntimeResultFromBootstrap(
            finalBootstrap,
            activeCompiledWorkflow,
          );
          const updatedFreeRunsRemaining = await getUpdatedFreeRunsRemaining();
          await finishUnifiedRun(
            unifiedRunId,
            finalBootstrap.run.status === "completed" ? "success" : "error",
            Date.now() - startTime,
          );

          return traceJson(
            {
              ok: finalBootstrap.run.status === "completed",
              result: safeResult,
              error:
                finalBootstrap.run.status === "completed"
                  ? undefined
                  : simplifyWorkflowError(
                      getBootstrapFailureMessage(finalBootstrap) || "Execution failed",
                    ),
              freeRunsRemaining: updatedFreeRunsRemaining,
              runId,
              runAccessToken,
            },
            200,
            {
              runId,
              unifiedRunId,
              finalStatus: finalBootstrap.run.status,
              lastEventSequence: finalBootstrap.run.lastEventSequence,
            },
          );
        }
      } catch (err: unknown) {
        const duration = Date.now() - startTime;
        await finishUnifiedRun(
          unifiedRunId,
          "error",
          duration,
          err instanceof Error ? err.message : "Workflow execution failed",
        );
        return traceJson(
          {
            ok: false,
            error: simplifyWorkflowError(
              err instanceof Error ? err.message : "Workflow execution failed",
            ),
            freeRunsRemaining: enforcement.freeRunsRemaining,
            runId,
          },
          500,
          {
            runId,
            unifiedRunId,
            duration,
          },
        );
      }
    }
    const clientId = extractClientIdentifier(req);
    const flowPayload = {
      nodes,
      edges,
      inputs: { ...enrichedInputs, __workflow_id: workflowId } as Record<string, unknown>,
      workflowId,
      requestMetadata: {
        userId: userId || null,
        identifier: clientId.identifier,
        identifierType: clientId.type,
        workflowId: workflowId,
      },
    };

    // Streaming mode: return NDJSON stream with live node progress
    if (useStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const { sendPrelude, writeEvent } = createStreamingResponseHelpers(controller, encoder);
          /** Trace session must finish only after the stream closes — never await flush before returning Response or headers lag behind run_bootstrap. */
          let streamLogicalOk = false;
          let streamErrorMessage: string | null = null;
          const heartbeatId = setInterval(() => {
            try {
              sendPrelude();
              controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
            } catch {}
          }, 5000);
          try {
            writeEvent({ type: "run_bootstrap", runId: runId ?? undefined, runAccessToken });
            result = await runFlow(flowPayload, {
              onProgress: (event) => writeEvent(event),
              runMode: effectiveIsBuilderTest ? "dev" : "marketplace",
            });
            const duration = Date.now() - startTime;
            const finalStatus =
              result.workflowStatus === "completed" ||
              result.workflowStatus === "completed_with_skips"
                ? "completed"
                : "failed";
            let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;

            if (runId && isTrackedUser) {
              const countResult = await completeWorkflowRunAndGetCount({
                runId,
                status: finalStatus,
                durationMs: duration,
                stateSnapshot: {
                  nodeStatus: result.nodeStatus,
                  outputsByNode: redactSecrets(result.outputsByNode),
                },
              });
              if (countResult) {
                const freeRunLimit = effectiveIsBuilderTest
                  ? FREE_BUILDER_RUNS
                  : FREE_MARKETPLACE_KEY_RUNS;
                updatedFreeRunsRemaining = Math.max(0, freeRunLimit - countResult.newCount);
              } else {
                try {
                  await updateWorkflowRun(runId, {
                    status: finalStatus,
                    completed_at: new Date().toISOString(),
                    duration_ms: duration,
                    state_snapshot: {
                      nodeStatus: result.nodeStatus,
                      outputsByNode: redactSecrets(result.outputsByNode),
                    },
                  });
                  const updatedRunCount = await getUserWorkflowRunCount(
                    userId,
                    workflowId,
                    draftId,
                  );
                  const freeRunLimit = effectiveIsBuilderTest
                    ? FREE_BUILDER_RUNS
                    : FREE_MARKETPLACE_KEY_RUNS;
                  updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
                } catch (e) {
                  console.error("[Flow Stream] Run update failed:", (e as Error)?.message);
                }
              }
            } else if (runId) {
              try {
                await updateWorkflowRun(runId, {
                  status: finalStatus,
                  completed_at: new Date().toISOString(),
                  duration_ms: duration,
                  state_snapshot: {
                    nodeStatus: result.nodeStatus,
                    outputsByNode: redactSecrets(result.outputsByNode),
                  },
                });
              } catch {
                // ignore
              }
            }
            if (result.nodeTraces?.length && runId) {
              try {
                await insertWorkflowRunNodes(
                  runId,
                  result.nodeTraces.map((t) => ({
                    nodeId: t.nodeId,
                    specId: t.specId,
                    status: t.status,
                    startMs: t.startMs,
                    endMs: t.endMs,
                    error: t.error,
                    retries: t.retries,
                    tokens: t.tokens,
                    model: t.model,
                  })),
                );
              } catch {
                // ignore
              }
            }
            await finishUnifiedRun(
              unifiedRunId,
              finalStatus === "completed" ? "success" : "error",
              duration,
              undefined,
              result.nodeTraces,
            );
            const safeResult = {
              ...result,
              outputsByNode: redactSecrets(result.outputsByNode) as Record<string, unknown>,
              finalOutputs: result.finalOutputs.map((fo) => ({
                nodeId: fo.nodeId,
                value: redactSecrets(fo.value),
              })),
            };
            writeEvent({
              type: "complete",
              ok: true,
              result: safeResult,
              freeRunsRemaining: updatedFreeRunsRemaining,
              runId,
            });
            streamLogicalOk = true;
          } catch (err: any) {
            const duration = Date.now() - startTime;
            let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;
            if (runId && isTrackedUser) {
              const countResult = await completeWorkflowRunAndGetCount({
                runId,
                status: "failed",
                durationMs: duration,
                errorDetails: redactSecrets({ message: err?.message, stack: err?.stack }) as Record<
                  string,
                  unknown
                >,
              });
              if (countResult) {
                const freeRunLimit = effectiveIsBuilderTest
                  ? FREE_BUILDER_RUNS
                  : FREE_MARKETPLACE_KEY_RUNS;
                updatedFreeRunsRemaining = Math.max(0, freeRunLimit - countResult.newCount);
              } else {
                try {
                  await updateWorkflowRun(runId, {
                    status: "failed",
                    completed_at: new Date().toISOString(),
                    duration_ms: duration,
                    error_details: redactSecrets({
                      message: err?.message,
                      stack: err?.stack,
                    }) as Record<string, unknown>,
                  });
                  const updatedRunCount = await getUserWorkflowRunCount(
                    userId,
                    workflowId,
                    draftId,
                  );
                  const freeRunLimit = effectiveIsBuilderTest
                    ? FREE_BUILDER_RUNS
                    : FREE_MARKETPLACE_KEY_RUNS;
                  updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
                } catch {
                  // ignore
                }
              }
            } else if (runId) {
              try {
                await updateWorkflowRun(runId, {
                  status: "failed",
                  completed_at: new Date().toISOString(),
                  duration_ms: duration,
                  error_details: redactSecrets({
                    message: err?.message,
                    stack: err?.stack,
                  }) as Record<string, unknown>,
                });
              } catch {
                // ignore
              }
            }
            await finishUnifiedRun(unifiedRunId, "error", duration, err?.message);
            streamErrorMessage = simplifyWorkflowError(err?.message || "Unknown error");
            writeEvent({
              type: "complete",
              ok: false,
              error: streamErrorMessage,
              freeRunsRemaining: updatedFreeRunsRemaining,
              runId,
            });
          } finally {
            clearInterval(heartbeatId);
            controller.close();
            try {
              await trace.record({
                eventName: "request.response_ready",
                httpStatus: 200,
                payload: {
                  ok: streamLogicalOk,
                  handedOff: false,
                  runId,
                  error: streamErrorMessage,
                  stream: true,
                },
              });
              await trace.finish({
                status: streamLogicalOk ? "completed" : "failed",
                responseStatus: 200,
                errorMessage: streamErrorMessage,
                summary: {
                  durationMs: Date.now() - requestStartedAt,
                  workflowId,
                  runId,
                  unifiedRunId,
                  streamMode: "legacy_ndjson",
                },
              });
            } catch (traceErr) {
              console.error("[flow/run] trace.finish after legacy stream failed:", traceErr);
            }
          }
        },
      });
      return new Response(stream, {
        headers: trace.responseHeaders({
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Content-Encoding": "identity",
        }),
      });
    }

    // Non-streaming: execute and return JSON
    try {
      result = await runFlow(flowPayload, {
        runMode: effectiveIsBuilderTest ? "dev" : "marketplace",
      });

      const duration = Date.now() - startTime;

      // Update run record on completion - ALWAYS update to track usage
      let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;
      const finalStatus =
        result.workflowStatus === "completed" || result.workflowStatus === "completed_with_skips"
          ? "completed"
          : "failed";

      // CRITICAL: Atomic completion (update + get count in one DB round-trip)
      let updateSuccess = false;
      if (runId && isTrackedUser) {
        const countResult = await completeWorkflowRunAndGetCount({
          runId,
          status: finalStatus,
          durationMs: duration,
          stateSnapshot: {
            nodeStatus: result.nodeStatus,
            outputsByNode: redactSecrets(result.outputsByNode),
          },
        });
        if (countResult) {
          updateSuccess = true;
          const freeRunLimit = effectiveIsBuilderTest
            ? FREE_BUILDER_RUNS
            : FREE_MARKETPLACE_KEY_RUNS;
          updatedFreeRunsRemaining = Math.max(0, freeRunLimit - countResult.newCount);
          console.warn(
            `[Run Tracking] Atomic complete: run ${runId} → ${finalStatus}, count=${countResult.newCount}/${freeRunLimit}`,
          );
        }
      }
      if (!updateSuccess && runId) {
        // Fallback: RPC not available, use update + count
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await updateWorkflowRun(runId, {
              status: finalStatus,
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              state_snapshot: {
                nodeStatus: result.nodeStatus,
                outputsByNode: redactSecrets(result.outputsByNode),
              },
            });
            updateSuccess = true;
            break;
          } catch (updateErr: any) {
            console.error(
              `[Run Tracking] Fallback update attempt ${attempt} failed:`,
              updateErr?.message,
            );
            if (attempt < 3) await new Promise((r) => setTimeout(r, 100 * attempt));
          }
        }
        if (updateSuccess && isTrackedUser) {
          const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
          const freeRunLimit = effectiveIsBuilderTest
            ? FREE_BUILDER_RUNS
            : FREE_MARKETPLACE_KEY_RUNS;
          updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
        }
      }
      if (result.nodeTraces?.length && runId) {
        try {
          await insertWorkflowRunNodes(
            runId,
            result.nodeTraces.map((t) => ({
              nodeId: t.nodeId,
              specId: t.specId,
              status: t.status,
              startMs: t.startMs,
              endMs: t.endMs,
              error: t.error,
              retries: t.retries,
              tokens: t.tokens,
              model: t.model,
            })),
          );
        } catch (e) {
          console.warn("[Run Tracking] insertWorkflowRunNodes failed:", e);
        }
      }
      if (!runId) {
        console.warn(
          `[Run Tracking] No runId - run was not tracked. User: ${userId}, Workflow: ${workflowId}`,
        );
      }
      await finishUnifiedRun(
        unifiedRunId,
        finalStatus === "completed" ? "success" : "error",
        duration,
        undefined,
        result.nodeTraces,
      );

      // Redact secrets from response
      const safeResult = {
        ...result,
        outputsByNode: redactSecrets(result.outputsByNode) as Record<string, unknown>,
        finalOutputs: result.finalOutputs.map((fo) => ({
          nodeId: fo.nodeId,
          value: redactSecrets(fo.value),
        })),
      };

      return traceJson(
        {
          ok: true,
          result: safeResult,
          freeRunsRemaining: updatedFreeRunsRemaining,
          runId,
          runAccessToken,
        },
        200,
        {
          runId,
          unifiedRunId,
          finalStatus,
          duration,
        },
      );
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const errorMessage = err?.message || "Unknown error";

      // Atomic completion for failed runs
      let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;
      let updateSuccess = false;
      if (runId && isTrackedUser) {
        const countResult = await completeWorkflowRunAndGetCount({
          runId,
          status: "failed",
          durationMs: duration,
          errorDetails: redactSecrets({ message: errorMessage, stack: err?.stack }) as Record<
            string,
            unknown
          >,
        });
        if (countResult) {
          updateSuccess = true;
          const freeRunLimit = effectiveIsBuilderTest
            ? FREE_BUILDER_RUNS
            : FREE_MARKETPLACE_KEY_RUNS;
          updatedFreeRunsRemaining = Math.max(0, freeRunLimit - countResult.newCount);
          console.warn(
            `[Run Tracking] Atomic complete (error): run ${runId} → failed, count=${countResult.newCount}/${freeRunLimit}`,
          );
        }
      }
      if (!updateSuccess && runId) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await updateWorkflowRun(runId, {
              status: "failed",
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              error_details: redactSecrets({ message: errorMessage, stack: err?.stack }) as Record<
                string,
                unknown
              >,
            });
            updateSuccess = true;
            if (isTrackedUser) {
              const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
              const freeRunLimit = effectiveIsBuilderTest
                ? FREE_BUILDER_RUNS
                : FREE_MARKETPLACE_KEY_RUNS;
              updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
            }
            break;
          } catch (updateErr: any) {
            console.error(
              `[Run Tracking] Fallback update (error) attempt ${attempt} failed:`,
              updateErr?.message,
            );
            if (attempt < 3) await new Promise((r) => setTimeout(r, 100 * attempt));
          }
        }
      }
      if (!runId) {
        console.warn(
          `[Run Tracking] No runId on error - run was not tracked. User: ${userId}, Workflow: ${workflowId}`,
        );
      }
      await finishUnifiedRun(unifiedRunId, "error", duration, errorMessage);

      return traceJson(
        {
          ok: false,
          error: simplifyWorkflowError(redactSecrets(errorMessage) as string),
          runId,
          runAccessToken,
          freeRunsRemaining: updatedFreeRunsRemaining,
        },
        500,
        {
          runId,
          unifiedRunId,
          duration,
        },
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: simplifyWorkflowError(redactSecrets(e?.message || "Unknown error") as string),
      },
      { status: 500 },
    );
  }
}
