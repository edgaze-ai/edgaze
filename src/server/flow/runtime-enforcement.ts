// src/server/flow/runtime-enforcement.ts
import {
  countUserTerminalRunsForCap,
  getUserWorkflowRunCount,
  isAdmin,
  getWorkflowDraftId,
  workflowExists,
} from "../../lib/supabase/executions";
import {
  getEdgazeApiKey,
  hasEdgazeApiKey,
  hasEdgazeAnthropicApiKey,
  hasEdgazeGeminiApiKey,
} from "../../lib/workflow/edgaze-api-key";
import {
  canonicalSpecId,
  isPremiumAiSpec,
  resolvePremiumKeyProvider,
} from "../../lib/workflow/spec-id-aliases";
import type { GraphNode } from "./types";

function hasLlmChat(nodes: GraphNode[]): boolean {
  return nodes.some((n) => canonicalSpecId(n.data?.specId ?? "") === "llm-chat");
}

/** Gemini not needed for unified llm-chat when platform free tier maps to Claude Sonnet instead. */
function nodeNeedsGeminiKey(n: GraphNode, underFree: boolean): boolean {
  const p = resolvePremiumKeyProvider(n);
  if (p !== "google") return false;
  if (
    canonicalSpecId(n.data?.specId ?? "") === "llm-chat" &&
    underFree &&
    hasEdgazeAnthropicApiKey()
  ) {
    return false;
  }
  return true;
}

const FREE_BUILDER_RUNS = 10; // 10 free runs in builder test (then BYO keys)
const FREE_RUNS_PER_PURCHASE = 10; // 10 free runs per workflow purchase
const MAX_RUNS_PER_WORKFLOW = 100; // Strict limit per workflow
const MAX_RUNS_PER_USER = 500; // Strict limit per user

function isAiPremiumNode(specId: string | undefined): boolean {
  if (!specId) return false;
  return isPremiumAiSpec(specId);
}

export type RuntimeEnforcementResult = {
  allowed: boolean;
  requiresApiKeys: string[]; // node IDs that need user-supplied API keys
  freeRunsRemaining: number;
  /** True when OpenAI-backed nodes (llm-*) may use EDGAZE_OPENAI_API_KEY on this run */
  useEdgazeKey: boolean;
  useEdgazeOpenAI: boolean;
  useEdgazeAnthropic: boolean;
  useEdgazeGemini: boolean;
  error?: string;
};

async function resolveDraftIdForEnforcement(
  draftIdForCount: string | null,
  workflowId: string,
  userId: string,
  isBuilderTest: boolean,
): Promise<string | null> {
  let draftId: string | null = draftIdForCount;
  try {
    if (draftId == null) {
      const exists = await workflowExists(workflowId);
      if (!exists && isBuilderTest) {
        draftId = await getWorkflowDraftId(workflowId, userId);
      }
    }
  } catch {
    // proceed
  }
  return draftId;
}

/** Platform key routing for anonymous/admin demo — reuse for authenticated “Try demo” so model tier matches. */
export function demoTierPlatformKeyFlags(
  nodes: GraphNode[],
): Pick<
  RuntimeEnforcementResult,
  "useEdgazeKey" | "useEdgazeOpenAI" | "useEdgazeAnthropic" | "useEdgazeGemini"
> {
  const hasAnyAi = nodes.some((n) => isAiPremiumNode(n.data?.specId));
  const demoUnderFree = true;
  return {
    useEdgazeKey: hasEdgazeApiKey() && hasAnyAi,
    useEdgazeOpenAI:
      hasEdgazeApiKey() &&
      (nodes.some((n) => resolvePremiumKeyProvider(n) === "openai") ||
        (hasLlmChat(nodes) && !hasEdgazeAnthropicApiKey())),
    useEdgazeAnthropic:
      hasEdgazeAnthropicApiKey() &&
      (nodes.some((n) => resolvePremiumKeyProvider(n) === "anthropic") || hasLlmChat(nodes)),
    useEdgazeGemini:
      hasEdgazeGeminiApiKey() && nodes.some((n) => nodeNeedsGeminiKey(n, demoUnderFree)),
  };
}

/**
 * Validates whether a user can run a workflow and which nodes require BYO API keys.
 * Uses Edgaze API keys for the first N runs per workflow when platform keys exist for each provider used.
 */
export async function enforceRuntimeLimits(params: {
  userId: string;
  workflowId: string;
  nodes: GraphNode[];
  userApiKeys?: Record<string, Record<string, string>>; // nodeId -> { apiKey: "...", apiKeyName: "..." }
  /** Only true for anonymous one-time demo or admin demo link — never trust client for real UUID users. */
  isDemo?: boolean;
  isBuilderTest?: boolean; // Builder “Test run”: 10 free runs, then BYO key (server-derived for marketplace)
  /** When set, run counts use this draft (builder) instead of workflowId. */
  draftIdForCount?: string | null;
}): Promise<RuntimeEnforcementResult> {
  const {
    userId,
    workflowId,
    nodes,
    userApiKeys = {},
    isDemo = false,
    isBuilderTest = false,
    draftIdForCount = null,
  } = params;
  const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : FREE_RUNS_PER_PURCHASE;

  const emptyPlatform = (): Omit<
    RuntimeEnforcementResult,
    "allowed" | "requiresApiKeys" | "error"
  > => ({
    freeRunsRemaining: 0,
    useEdgazeKey: false,
    useEdgazeOpenAI: false,
    useEdgazeAnthropic: false,
    useEdgazeGemini: false,
  });

  try {
    // Anonymous one-time demo and admin demo link only
    if (userId === "anonymous_demo_user" || userId === "admin_demo_user") {
      const hasAnyAi = nodes.some((n) => isAiPremiumNode(n.data?.specId));
      const demoUnderFree = true;
      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining: 0,
        useEdgazeKey: hasEdgazeApiKey() && hasAnyAi,
        useEdgazeOpenAI:
          hasEdgazeApiKey() &&
          (nodes.some((n) => resolvePremiumKeyProvider(n) === "openai") ||
            (hasLlmChat(nodes) && !hasEdgazeAnthropicApiKey())),
        useEdgazeAnthropic:
          hasEdgazeAnthropicApiKey() &&
          (nodes.some((n) => resolvePremiumKeyProvider(n) === "anthropic") || hasLlmChat(nodes)),
        useEdgazeGemini:
          hasEdgazeGeminiApiKey() && nodes.some((n) => nodeNeedsGeminiKey(n, demoUnderFree)),
      };
    }

    const userIsAdmin = await isAdmin(userId);
    if (userIsAdmin) {
      const hasAnyAi = nodes.some((n) => isAiPremiumNode(n.data?.specId));
      const adminUnderFree = true;
      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining: 999999,
        useEdgazeKey: hasEdgazeApiKey() && hasAnyAi,
        useEdgazeOpenAI:
          hasEdgazeApiKey() &&
          (nodes.some((n) => resolvePremiumKeyProvider(n) === "openai") ||
            (hasLlmChat(nodes) && !hasEdgazeAnthropicApiKey())),
        useEdgazeAnthropic:
          hasEdgazeAnthropicApiKey() &&
          (nodes.some((n) => resolvePremiumKeyProvider(n) === "anthropic") || hasLlmChat(nodes)),
        useEdgazeGemini:
          hasEdgazeGeminiApiKey() && nodes.some((n) => nodeNeedsGeminiKey(n, adminUnderFree)),
      };
    }

    const draftId = await resolveDraftIdForEnforcement(
      draftIdForCount,
      workflowId,
      userId,
      isBuilderTest,
    );

    const [workflowRunCount, totalUserRuns] = await Promise.all([
      getUserWorkflowRunCount(userId, workflowId, draftId),
      countUserTerminalRunsForCap(userId),
    ]);

    if (workflowRunCount >= MAX_RUNS_PER_WORKFLOW) {
      return {
        allowed: false,
        requiresApiKeys: [],
        ...emptyPlatform(),
        error: `Maximum runs (${MAX_RUNS_PER_WORKFLOW}) reached for this workflow. Please contact support for higher limits.`,
      };
    }

    if (totalUserRuns >= MAX_RUNS_PER_USER) {
      return {
        allowed: false,
        requiresApiKeys: [],
        ...emptyPlatform(),
        error: `Maximum runs (${MAX_RUNS_PER_USER}) reached for your account. Please contact support for higher limits.`,
      };
    }

    const freeRunsRemaining = Math.max(0, freeRunLimit - workflowRunCount);

    const aiNodes = nodes.filter((n) => isAiPremiumNode(n.data?.specId));

    if (aiNodes.length === 0) {
      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining: 0,
        useEdgazeKey: false,
        useEdgazeOpenAI: false,
        useEdgazeAnthropic: false,
        useEdgazeGemini: false,
      };
    }

    const underFree = workflowRunCount < freeRunLimit;

    const needsAnthropic =
      aiNodes.some((n) => resolvePremiumKeyProvider(n) === "anthropic") ||
      (underFree && hasLlmChat(nodes) && hasEdgazeAnthropicApiKey());
    const needsOpenAI =
      aiNodes.some((n) => resolvePremiumKeyProvider(n) === "openai") ||
      (underFree && hasLlmChat(nodes) && !hasEdgazeAnthropicApiKey() && hasEdgazeApiKey());
    const needsGemini = aiNodes.some((n) => nodeNeedsGeminiKey(n, underFree));

    const useEdgazeOpenAI = underFree && needsOpenAI && hasEdgazeApiKey();
    const useEdgazeAnthropic = underFree && needsAnthropic && hasEdgazeAnthropicApiKey();
    const useEdgazeGemini = underFree && needsGemini && hasEdgazeGeminiApiKey();

    if (underFree) {
      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining,
        useEdgazeKey: useEdgazeOpenAI || useEdgazeAnthropic || useEdgazeGemini,
        useEdgazeOpenAI,
        useEdgazeAnthropic,
        useEdgazeGemini,
      };
    }

    const missingKeys: string[] = [];
    for (const node of aiNodes) {
      const nodeKeys = userApiKeys[node.id];
      const configKey = node.data?.config?.apiKey;
      if (
        (!nodeKeys || !nodeKeys.apiKey || nodeKeys.apiKey.trim() === "") &&
        (!configKey || typeof configKey !== "string" || configKey.trim() === "")
      ) {
        missingKeys.push(node.id);
      }
    }

    if (missingKeys.length > 0) {
      return {
        allowed: false,
        requiresApiKeys: missingKeys,
        freeRunsRemaining: 0,
        useEdgazeKey: false,
        useEdgazeOpenAI: false,
        useEdgazeAnthropic: false,
        useEdgazeGemini: false,
        error: `You've used your ${freeRunLimit} free runs for this workflow. Add the API keys required by your workflow in the run modal (OpenAI, Claude, and/or Gemini) or in each node's inspector.`,
      };
    }

    return {
      allowed: true,
      requiresApiKeys: [],
      freeRunsRemaining: 0,
      useEdgazeKey: false,
      useEdgazeOpenAI: false,
      useEdgazeAnthropic: false,
      useEdgazeGemini: false,
    };
  } catch (err: any) {
    const msg = err?.message ?? String(err) ?? "Unknown error";
    console.error("[RuntimeEnforcement] Check failed:", msg, { userId, workflowId });
    return {
      allowed: false,
      requiresApiKeys: [],
      ...emptyPlatform(),
      error: "Unable to verify run limits. Please sign in and try again, or try the one-time demo.",
    };
  }
}

/**
 * Returns true if the string is a URL (http(s), blob, or known image host).
 * URLs should never be redacted - they are not secrets and redaction breaks image display.
 */
function looksLikeUrl(s: string): boolean {
  const t = s.trim();
  if (/^https?:\/\//i.test(t)) return true;
  // Any data: URL (images, SVG, etc.) — not a redaction target; regex scans on multi‑MB payloads are costly.
  if (/^data:/i.test(t)) return true;
  if (/oaidalleapiprodscus\.blob\.core\.windows\.net|blob\.core\.windows\.net/i.test(t))
    return true;
  return false;
}

/**
 * Keys injected by /api/flow/run for execution (stored in workflow_runs.run_input).
 * `redactSecrets` must not wipe these: the name contains "key" but values are required for the worker
 * (otherwise OpenAI gets the literal "***REDACTED***" and returns 401).
 * Rows are server-side only (service role); user-facing exports should still avoid leaking run_input.
 */
function shouldPreserveRunInputInjectionField(fieldName: string): boolean {
  const kl = fieldName.toLowerCase();
  return kl.startsWith("__api_key_") || kl.startsWith("__builder_user_key");
}

/**
 * Redacts API keys from logs and error messages to prevent leakage.
 * Never redacts URLs (image URLs, blob storage, etc.) - those are not secrets and must stay intact.
 */
export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    if (looksLikeUrl(value)) return value;
    // API key patterns are short; scanning megabyte strings (e.g. base64) is O(n) and dominates run finalization.
    if (value.length > 96_000) return value;
    return value
      .replace(/\bsk-[a-zA-Z0-9]{20,}\b/g, "sk-***REDACTED***")
      .replace(/api[_-]?key["\s:=]+([a-zA-Z0-9_-]{20,})/gi, 'api_key="***REDACTED***"');
  }
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (shouldPreserveRunInputInjectionField(k)) {
        redacted[k] = v;
        continue;
      }
      if (
        k.toLowerCase().includes("key") ||
        k.toLowerCase().includes("secret") ||
        k.toLowerCase().includes("token")
      ) {
        redacted[k] = "***REDACTED***";
      } else {
        redacted[k] = redactSecrets(v);
      }
    }
    return redacted;
  }
  return value;
}
