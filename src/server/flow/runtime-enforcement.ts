// src/server/flow/runtime-enforcement.ts
import { getUserWorkflowRunCount, isAdmin, getWorkflowDraftId, workflowExists } from "../../lib/supabase/executions";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { getEdgazeApiKey, hasEdgazeApiKey } from "../../lib/workflow/edgaze-api-key";
import type { GraphNode } from "./types";

const FREE_BETA_RUNS = 5; // 5 free runs for product-page demos
const FREE_BUILDER_RUNS = 10; // 10 free runs in builder test (then BYO OpenAI key)
const FREE_RUNS_PER_PURCHASE = 10; // 10 free runs per workflow purchase
const MAX_RUNS_PER_WORKFLOW = 100; // Strict limit per workflow
const MAX_RUNS_PER_USER = 500; // Strict limit per user

export type RuntimeEnforcementResult = {
  allowed: boolean;
  requiresApiKeys: string[]; // node IDs that need user-supplied API keys
  freeRunsRemaining: number;
  useEdgazeKey: boolean; // Whether to use Edgaze API key for this run
  error?: string;
};

/**
 * Validates whether a user can run a workflow and which nodes require BYO API keys.
 * Uses Edgaze API key for:
 * - One-time demos (isDemo = true)
 * - First 10 runs after purchase
 * After 10 free runs, users must provide their own API keys for premium nodes.
 */
export async function enforceRuntimeLimits(params: {
  userId: string;
  workflowId: string;
  nodes: GraphNode[];
  userApiKeys?: Record<string, Record<string, string>>; // nodeId -> { apiKey: "...", apiKeyName: "..." }
  isDemo?: boolean; // One-time demo on product page
  isBuilderTest?: boolean; // Builder “Test run”: 10 free runs, then BYO key
}): Promise<RuntimeEnforcementResult> {
  const { userId, workflowId, nodes, userApiKeys = {}, isDemo = false, isBuilderTest = false } = params;
  // Builder test: 10 runs. Purchased workflow preview (isDemo + authenticated): 10 runs per purchase. Else: 5.
  const freeRunLimit = isBuilderTest
    ? FREE_BUILDER_RUNS
    : isDemo && userId !== "anonymous_demo_user"
      ? FREE_RUNS_PER_PURCHASE
      : FREE_BETA_RUNS;

  try {
    // For anonymous demo users, allow the run and use Edgaze key
    if (userId === "anonymous_demo_user" || isDemo) {
      const premiumNodeSpecs = ["openai-chat", "openai-embeddings", "openai-image", "http-request"];
      const premiumNodes = nodes.filter((n) => premiumNodeSpecs.includes(n.data?.specId ?? ""));
      const shouldUseEdgazeKey = hasEdgazeApiKey() && premiumNodes.length > 0;

      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining: 0,
        useEdgazeKey: shouldUseEdgazeKey,
      };
    }

    const supabase = createSupabaseAdminClient();

    // Check if user is admin - admins bypass all limits
    const userIsAdmin = await isAdmin(userId);
    if (userIsAdmin) {
      const aiNodeSpecs = ["openai-chat", "openai-embeddings", "openai-image"];
      const aiNodes = nodes.filter((n) => aiNodeSpecs.includes(n.data?.specId ?? ""));
      const shouldUseEdgazeKey = hasEdgazeApiKey() && aiNodes.length > 0;

      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining: 999999, // Unlimited for admins
        useEdgazeKey: shouldUseEdgazeKey,
      };
    }

    // Check workflow-specific run count (check drafts if workflow doesn't exist)
    let draftId: string | null = null;
    try {
      const exists = await workflowExists(workflowId);
      if (!exists && isBuilderTest) {
        draftId = await getWorkflowDraftId(workflowId, userId);
      }
    } catch (err) {
      // If check fails, proceed with workflowId only
    }
    const workflowRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);

    // Check user's total run count across all workflows
    const { count: userTotalRuns, error: userCountError } = await supabase
      .from("workflow_runs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["completed", "failed"]);

    if (userCountError) {
      console.error("Error checking user total runs:", userCountError);
    }

    const totalUserRuns = userTotalRuns ?? 0;

    // Strict limits: block if exceeded
    if (workflowRunCount >= MAX_RUNS_PER_WORKFLOW) {
      return {
        allowed: false,
        requiresApiKeys: [],
        freeRunsRemaining: 0,
        useEdgazeKey: false,
        error: `Maximum runs (${MAX_RUNS_PER_WORKFLOW}) reached for this workflow. Please contact support for higher limits.`,
      };
    }

    if (totalUserRuns >= MAX_RUNS_PER_USER) {
      return {
        allowed: false,
        requiresApiKeys: [],
        freeRunsRemaining: 0,
        useEdgazeKey: false,
        error: `Maximum runs (${MAX_RUNS_PER_USER}) reached for your account. Please contact support for higher limits.`,
      };
    }

    const freeRunsRemaining = Math.max(0, freeRunLimit - workflowRunCount);

    // Only check for AI nodes (not http-request) - if no AI nodes, allow unlimited runs
    const aiNodeSpecs = ["openai-chat", "openai-embeddings", "openai-image"];
    const aiNodes = nodes.filter((n) => aiNodeSpecs.includes(n.data?.specId ?? ""));

    // If no AI nodes, allow unlimited runs without API keys
    if (aiNodes.length === 0) {
      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining: 0,
        useEdgazeKey: false,
      };
    }

    // Determine if we should use Edgaze API key
    // Use Edgaze key for: demos or first N free runs (builder: 10, else 5)
    const shouldUseEdgazeKey =
      (isDemo || workflowRunCount < freeRunLimit) &&
      hasEdgazeApiKey() &&
      aiNodes.length > 0;

    if (workflowRunCount < freeRunLimit || isDemo) {
      // Under free run limit or demo: allowed, use Edgaze key if available
      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining: isDemo ? 0 : freeRunsRemaining,
        useEdgazeKey: shouldUseEdgazeKey,
      };
    }

    // Over free run limit: check for required API keys
    const missingKeys: string[] = [];
    for (const node of aiNodes) {
      const nodeKeys = userApiKeys[node.id];
      // Also check if API key is stored in node config
      const configKey = node.data?.config?.apiKey;
      if ((!nodeKeys || !nodeKeys.apiKey || nodeKeys.apiKey.trim() === "") &&
          (!configKey || typeof configKey !== "string" || configKey.trim() === "")) {
        missingKeys.push(node.id);
      }
    }

    if (missingKeys.length > 0) {
      return {
        allowed: false,
        requiresApiKeys: missingKeys,
        freeRunsRemaining: 0,
        useEdgazeKey: false,
        error: `You've used your ${freeRunLimit} free runs for this workflow. Please provide your OpenAI API key in the run modal to continue.`,
      };
    }

    return {
      allowed: true,
      requiresApiKeys: [],
      freeRunsRemaining: 0,
      useEdgazeKey: false, // After free runs, user must provide their own keys
    };
  } catch (err: any) {
    return {
      allowed: false,
      requiresApiKeys: [],
      freeRunsRemaining: 0,
      useEdgazeKey: false,
      error: `Enforcement check failed: ${err?.message ?? "Unknown error"}`,
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
  if (t.startsWith("data:image/")) return true;
  if (/oaidalleapiprodscus\.blob\.core\.windows\.net|blob\.core\.windows\.net/i.test(t)) return true;
  return false;
}

/**
 * Redacts API keys from logs and error messages to prevent leakage.
 * Never redacts URLs (image URLs, blob storage, etc.) - those are not secrets and must stay intact.
 */
export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    // Never redact URLs - they contain long hex strings (e.g. Azure blob sig) that are not secrets
    if (looksLikeUrl(value)) return value;
    // Redact API keys only in non-URL strings
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
      if (k.toLowerCase().includes("key") || k.toLowerCase().includes("secret") || k.toLowerCase().includes("token")) {
        redacted[k] = "***REDACTED***";
      } else {
        redacted[k] = redactSecrets(v);
      }
    }
    return redacted;
  }
  return value;
}
