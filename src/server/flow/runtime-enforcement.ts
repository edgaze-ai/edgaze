// src/server/flow/runtime-enforcement.ts
import { getUserWorkflowRunCount } from "../../lib/supabase/executions";
import type { GraphNode } from "./types";

const FREE_RUN_LIMIT = 10;

export type RuntimeEnforcementResult = {
  allowed: boolean;
  requiresApiKeys: string[]; // node IDs that need user-supplied API keys
  freeRunsRemaining: number;
  error?: string;
};

/**
 * Validates whether a user can run a workflow and which nodes require BYO API keys.
 * After 10 free runs, users must provide their own API keys for premium nodes.
 */
export async function enforceRuntimeLimits(params: {
  userId: string;
  workflowId: string;
  nodes: GraphNode[];
  userApiKeys?: Record<string, Record<string, string>>; // nodeId -> { apiKey: "...", apiKeyName: "..." }
}): Promise<RuntimeEnforcementResult> {
  const { userId, workflowId, nodes, userApiKeys = {} } = params;

  try {
    const runCount = await getUserWorkflowRunCount(userId, workflowId);
    const freeRunsRemaining = Math.max(0, FREE_RUN_LIMIT - runCount);

    // Nodes that require external API keys (OpenAI, HTTP with auth, etc.)
    const premiumNodeSpecs = ["openai-chat", "openai-embeddings", "openai-image", "http-request"];
    const premiumNodes = nodes.filter((n) => premiumNodeSpecs.includes(n.data?.specId ?? ""));

    if (runCount < FREE_RUN_LIMIT) {
      // Under free limit: allowed, no keys needed
      return {
        allowed: true,
        requiresApiKeys: [],
        freeRunsRemaining,
      };
    }

    // Over free limit: check for required API keys
    const missingKeys: string[] = [];
    for (const node of premiumNodes) {
      const nodeKeys = userApiKeys[node.id];
      if (!nodeKeys || !nodeKeys.apiKey || nodeKeys.apiKey.trim() === "") {
        missingKeys.push(node.id);
      }
    }

    if (missingKeys.length > 0) {
      return {
        allowed: false,
        requiresApiKeys: missingKeys,
        freeRunsRemaining: 0,
        error: `You've used your ${FREE_RUN_LIMIT} free runs. Please provide API keys for premium nodes to continue.`,
      };
    }

    return {
      allowed: true,
      requiresApiKeys: [],
      freeRunsRemaining: 0,
    };
  } catch (err: any) {
    return {
      allowed: false,
      requiresApiKeys: [],
      freeRunsRemaining: 0,
      error: `Enforcement check failed: ${err?.message ?? "Unknown error"}`,
    };
  }
}

/**
 * Redacts API keys from logs and error messages to prevent leakage.
 */
export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    // Redact potential API keys (long alphanumeric strings, sk- prefixes, etc.)
    return value
      .replace(/\bsk-[a-zA-Z0-9]{20,}\b/g, "sk-***REDACTED***")
      .replace(/\b[A-Za-z0-9]{32,}\b/g, (m) => `${m.slice(0, 8)}***REDACTED***`)
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
