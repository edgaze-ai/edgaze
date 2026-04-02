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
import { WorkflowRunOrchestrator } from "src/server/flow-v2/orchestrator";
import { SupabaseWorkflowExecutionRepository } from "src/server/flow-v2/repository";
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

/**
 * Compiles the workflow checkpoint and persists the v2 run skeleton. Shared by POST /api/flow/run
 * (handoff) and GET /api/runs/:id/stream so preparation can start as soon as the run row exists,
 * overlapping compile/init with the client opening the SSE connection.
 */
export async function ensureWorkflowRunPrepared(runId: string): Promise<void> {
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
