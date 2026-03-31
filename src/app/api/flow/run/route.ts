import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUserFromRequest } from "@lib/auth/server";
import { runFlow } from "src/server/flow/engine";
import { enforceRuntimeLimits, redactSecrets } from "src/server/flow/runtime-enforcement";
import {
  createWorkflowRun,
  updateWorkflowRun,
  completeWorkflowRunAndGetCount,
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
  listWorkflowRunEvents,
  loadWorkflowRunBootstrap,
  type WorkflowRunBootstrap,
} from "src/server/flow-v2/read-model";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
import { ensureWorkflowRunWorker } from "src/server/flow-v2/worker-service";
import type {
  CompiledWorkflowDefinition,
  RunEvent,
  SerializableValue,
} from "src/server/flow-v2/types";

const FREE_BUILDER_RUNS = 10;
const FREE_MARKETPLACE_KEY_RUNS = 10; // matches FREE_RUNS_PER_PURCHASE in runtime-enforcement

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

function mapRunEventToLegacyProgressEvent(
  event: RunEvent,
  compiled: CompiledWorkflowDefinition,
): {
  type: "node_ready" | "node_start" | "node_done" | "node_failed";
  [key: string]: unknown;
} | null {
  if (!("nodeId" in event.payload)) return null;
  const compiledNode = compiled.nodes.find((node) => node.id === event.payload.nodeId);
  const base = {
    nodeId: event.payload.nodeId,
    specId: compiledNode?.specId ?? "default",
    nodeTitle: compiledNode?.title,
    timestamp: Date.parse(event.createdAt) || Date.now(),
  };

  switch (event.type) {
    case "node.ready":
    case "node.queued":
      return { type: "node_ready", ...base };
    case "node.started":
      return { type: "node_start", ...base };
    case "node.completed":
      return { type: "node_done", ...base };
    case "node.failed":
    case "node.cancelled":
    case "node.blocked":
    case "node.skipped":
      return {
        type: "node_failed",
        ...base,
        error:
          typeof event.payload.message === "string" && event.payload.message.trim()
            ? event.payload.message
            : event.type,
      };
    default:
      return null;
  }
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
    } = body;

    let nodes = (body.nodes ?? []) as GraphNode[];
    let edges = (body.edges ?? []) as GraphEdge[];
    const workflowExecutionV2CompileEnabled = isWorkflowExecutionV2CompileEnabled();

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    let effectiveIsBuilderTest = false;
    let entitlementDraftId: string | null = null;
    /** True only for anonymous_demo_user / admin_demo_user — drives runtime demo fast path. */
    let isRuntimeDemo = false;

    // Auth: Bearer token only (client sends Authorization: Bearer <accessToken>). Demo runs and admin demo link allowed without auth.
    const { user, error: authError } = await getUserFromRequest(req);
    let userId: string;
    if (user) {
      userId = user.id;
      const entitlement = await getAuthenticatedRunEntitlement(
        userId,
        workflowId,
        clientIsBuilderTest,
      );
      if (!entitlement.ok) {
        return NextResponse.json({ ok: false, error: entitlement.message }, { status: 403 });
      }
      effectiveIsBuilderTest = entitlement.effectiveIsBuilderTest;
      entitlementDraftId = entitlement.draftIdForCount;
      try {
        const g = await resolveAuthenticatedRunGraphForExecution({
          userId,
          workflowId,
          entitlement: {
            useServerMarketplaceGraph: entitlement.useServerMarketplaceGraph,
            draftIdForCount: entitlement.draftIdForCount,
          },
        });
        if (g) {
          nodes = g.nodes;
          edges = g.edges;
        }
      } catch (e) {
        console.error("[flow/run] server graph load failed:", e);
        return NextResponse.json(
          { ok: false, error: "Failed to load workflow for execution." },
          { status: 500 },
        );
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
        return NextResponse.json(
          {
            ok: false,
            error: "Invalid or expired demo link. Please use the link from the admin panel.",
          },
          { status: 403 },
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
        return NextResponse.json(
          { ok: false, error: "Failed to load workflow for demo execution." },
          { status: 500 },
        );
      }
    } else if (isDemo) {
      // For anonymous demo runs, check server-side tracking (device fingerprint + IP)
      if (!deviceFingerprint || deviceFingerprint.length < 10) {
        return NextResponse.json(
          {
            ok: false,
            error: "Device fingerprint is required for demo runs",
          },
          { status: 400 },
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
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to verify demo run eligibility. Please try again.",
          },
          { status: 500 },
        );
      }

      if (checkData !== true) {
        // Demo run already used for this device + IP combination
        return NextResponse.json(
          {
            ok: false,
            error:
              "You've already used your one-time demo run for this workflow. Each device and IP address combination gets one demo run.",
          },
          { status: 403 },
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
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to record demo run. Please try again.",
          },
          { status: 500 },
        );
      }

      const recordResult = recordData as {
        success: boolean;
        allowed: boolean;
        error?: string;
      };

      if (!recordResult.success || !recordResult.allowed) {
        // Race condition: another request already recorded this demo run
        return NextResponse.json(
          {
            ok: false,
            error: recordResult.error || "Demo run already used for this device and IP address.",
          },
          { status: 403 },
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
        return NextResponse.json(
          { ok: false, error: "Failed to load workflow for demo execution." },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json(
        {
          ok: false,
          error:
            authError ??
            "Authentication required. Please sign in to run workflows, or try a demo run.",
        },
        { status: 401 },
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
    const enforcement = await enforceRuntimeLimits({
      userId,
      workflowId,
      nodes,
      userApiKeys: mergedUserApiKeys,
      isDemo: isRuntimeDemo,
      isBuilderTest: effectiveIsBuilderTest,
      draftIdForCount: entitlementDraftId,
    });

    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: enforcement.error || "Runtime limit exceeded",
          requiresApiKeys: enforcement.requiresApiKeys,
          freeRunsRemaining: enforcement.freeRunsRemaining,
        },
        { status: 403 },
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
    const runAccessToken = isDemo ? randomUUID() : undefined;
    if (isTrackedUser) {
      try {
        // Check if workflow exists in workflows table
        const workflowExistsInDb = await workflowExists(workflowId);

        if (!workflowExistsInDb && effectiveIsBuilderTest && !draftId) {
          draftId = await getWorkflowDraftId(workflowId, userId);
          if (!draftId) {
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
          await updateWorkflowRun(runId, { status: "running" });
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

    if (workflowExecutionV2CompileEnabled) {
      try {
        compiledWorkflow = compileBuilderGraph({
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

        if (unifiedRunId) {
          await finishUnifiedRun(unifiedRunId, "error", 0, compileError.message);
        }

        const detailMessage =
          compileError.details.length > 0 ? compileError.details.join(" ") : compileError.message;
        return NextResponse.json(
          {
            ok: false,
            error: detailMessage,
            compileDetails: compileError.details,
            runId,
          },
          { status: 400 },
        );
      }

      if (compiledWorkflow && runId) {
        try {
          const orchestrator = new WorkflowRunOrchestrator(
            new SupabaseWorkflowExecutionRepository(),
          );
          await orchestrator.initializeRun({
            runId,
            compiled: compiledWorkflow,
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

          if (runId) {
            try {
              await updateWorkflowRun(runId, {
                status: "failed",
                error_details: { message: errorMessage },
              });
            } catch (updateError) {
              console.error("[flow/run] failed to persist orchestrator error:", updateError);
            }
          }

          if (unifiedRunId) {
            await finishUnifiedRun(unifiedRunId, "error", 0, errorMessage);
          }

          return NextResponse.json(
            {
              ok: false,
              error: `Run initialization failed: ${errorMessage}`,
              runId,
            },
            { status: 500 },
          );
        }
      }
    }

    const startTime = Date.now();
    let result;

    const workflowExecutionV2RunnerEnabled = isWorkflowExecutionV2RunnerEnabled();
    if (workflowExecutionV2RunnerEnabled && runId && compiledWorkflow) {
      const repository = new SupabaseWorkflowExecutionRepository();
      repository.primeRunCache({
        runId,
        compiled: compiledWorkflow,
        runInput: redactSecrets({
          ...enrichedInputs,
          __workflow_id: workflowId,
        }) as Record<string, SerializableValue>,
      });
      const orchestrator = new WorkflowRunOrchestrator(repository);
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

      if (useStream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const write = (obj: object) => {
              controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
            };

            let afterSequence = 0;
            let runnerError: unknown = null;

            try {
              write({
                type: "run_bootstrap",
                runId,
                runAccessToken,
              });

              const activeWorker = ensureWorkflowRunWorker({
                runId,
                repository,
                requestMetadata: runnerDependencies.requestMetadata,
                workerId: runnerDependencies.workerId,
              });
              const runnerPromise = activeWorker.promise.then(() => {
                const workerErr = activeWorker.getError();
                if (workerErr) {
                  runnerError = workerErr;
                }
              });

              const pollNdjsonLoop = async () => {
                while (!req.signal.aborted) {
                  const [events, latestBootstrap] = await Promise.all([
                    listWorkflowRunEvents({
                      runId,
                      afterSequence,
                      limit: 200,
                    }),
                    loadWorkflowRunBootstrap({
                      runId,
                      afterSequence: 0,
                      eventLimit: 0,
                    }),
                  ]);

                  for (const event of events) {
                    afterSequence = Math.max(afterSequence, event.sequence);
                    const mapped = mapRunEventToLegacyProgressEvent(event, compiledWorkflow);
                    if (mapped) write(mapped);
                  }
                  const isTerminal =
                    latestBootstrap.run.status === "completed" ||
                    latestBootstrap.run.status === "failed" ||
                    latestBootstrap.run.status === "cancelled";

                  if (isTerminal && afterSequence >= latestBootstrap.run.lastEventSequence) {
                    break;
                  }

                  await new Promise((resolve) => setTimeout(resolve, 250));
                }
              };

              await Promise.all([pollNdjsonLoop(), runnerPromise]);

              const finalBootstrap = await loadWorkflowRunBootstrap({
                runId,
                afterSequence: 0,
                eventLimit: 1000,
              });
              const safeResult = buildLegacyRuntimeResultFromBootstrap(
                finalBootstrap,
                compiledWorkflow,
              );
              const updatedFreeRunsRemaining = await getUpdatedFreeRunsRemaining();
              const runnerErrorMessage =
                runnerError instanceof Error ? runnerError.message : undefined;
              await finishUnifiedRun(
                unifiedRunId,
                finalBootstrap.run.status === "completed" ? "success" : "error",
                Date.now() - startTime,
                runnerErrorMessage,
              );

              write({
                type: "complete",
                ok: finalBootstrap.run.status === "completed",
                result: safeResult,
                error:
                  finalBootstrap.run.status === "completed"
                    ? undefined
                    : simplifyWorkflowError(
                        getBootstrapFailureMessage(finalBootstrap) ||
                          runnerErrorMessage ||
                          "Execution failed",
                      ),
                freeRunsRemaining: updatedFreeRunsRemaining,
                runId,
                runAccessToken,
              });
            } catch (err: unknown) {
              const duration = Date.now() - startTime;
              await finishUnifiedRun(
                unifiedRunId,
                "error",
                duration,
                err instanceof Error ? err.message : "Workflow stream failed",
              );
              write({
                type: "complete",
                ok: false,
                error: simplifyWorkflowError(
                  err instanceof Error ? err.message : "Workflow stream failed",
                ),
                freeRunsRemaining: enforcement.freeRunsRemaining,
                runId,
                runAccessToken,
              });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      try {
        ensureWorkflowRunWorker({
          runId,
          repository,
          requestMetadata: runnerDependencies.requestMetadata,
          workerId: runnerDependencies.workerId,
        });
        while (true) {
          const finalBootstrap = await loadWorkflowRunBootstrap({
            runId,
            afterSequence: 0,
            eventLimit: 1000,
          });
          const isTerminal =
            finalBootstrap.run.status === "completed" ||
            finalBootstrap.run.status === "failed" ||
            finalBootstrap.run.status === "cancelled";
          if (isTerminal) {
            const safeResult = buildLegacyRuntimeResultFromBootstrap(
              finalBootstrap,
              compiledWorkflow,
            );
            const updatedFreeRunsRemaining = await getUpdatedFreeRunsRemaining();
            await finishUnifiedRun(
              unifiedRunId,
              finalBootstrap.run.status === "completed" ? "success" : "error",
              Date.now() - startTime,
            );

            return NextResponse.json({
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
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } catch (err: unknown) {
        const duration = Date.now() - startTime;
        await finishUnifiedRun(
          unifiedRunId,
          "error",
          duration,
          err instanceof Error ? err.message : "Workflow execution failed",
        );
        return NextResponse.json(
          {
            ok: false,
            error: simplifyWorkflowError(
              err instanceof Error ? err.message : "Workflow execution failed",
            ),
            freeRunsRemaining: enforcement.freeRunsRemaining,
            runId,
          },
          { status: 500 },
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
          const write = (obj: object) => {
            try {
              controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
            } catch (e) {
              console.error("[Flow Stream] Failed to write:", e);
            }
          };
          try {
            result = await runFlow(flowPayload, {
              onProgress: (event) => write(event),
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
            write({
              type: "complete",
              ok: true,
              result: safeResult,
              freeRunsRemaining: updatedFreeRunsRemaining,
              runId,
            });
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
            write({
              type: "complete",
              ok: false,
              error: simplifyWorkflowError(err?.message || "Unknown error"),
              freeRunsRemaining: updatedFreeRunsRemaining,
              runId,
            });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
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

      return NextResponse.json({
        ok: true,
        result: safeResult,
        freeRunsRemaining: updatedFreeRunsRemaining,
        runId,
        runAccessToken,
      });
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

      return NextResponse.json(
        {
          ok: false,
          error: simplifyWorkflowError(redactSecrets(errorMessage) as string),
          runId,
          runAccessToken,
          freeRunsRemaining: updatedFreeRunsRemaining,
        },
        { status: 500 },
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
