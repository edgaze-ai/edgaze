/**
 * Workflow execution policies: unknown specId handling, failure behavior, run mode.
 */

/** Run mode: dev allows passthrough for unknown nodes; marketplace hard-fails */
export type RunMode = "dev" | "marketplace";

/** Per-node failure policy */
export type FailurePolicy =
  | "fail_fast"   // Default: fail workflow immediately
  | "continue"    // Mark node failed, continue downstream
  | "skip_downstream"  // Mark failed, don't run downstream
  | "use_fallback_value";  // Use config.fallbackValue instead

/** Per-edge gating: when does an edge "satisfy" its target's dependency? */
export type EdgeGating =
  | "require_success"       // default: only when source succeeded
  | "allow_on_failure"      // run downstream even when source failed
  | "require_non_empty"     // source succeeded AND output is non-empty
  | "require_truthy"        // source succeeded AND output is truthy
  | "require_type:json"     // source succeeded AND output is json object/array
  | "require_type:array"    // source succeeded AND output is array
  | "require_type:string"; // source succeeded AND output is string

export function getRunMode(options: {
  isBuilderTest?: boolean;
  isDemo?: boolean;
  isMarketplaceRun?: boolean;
}): RunMode {
  // Builder test = dev mode (creator editing)
  if (options.isBuilderTest) return "dev";
  // Demo runs on marketplace = marketplace mode (buyers)
  if (options.isDemo) return "marketplace";
  // Explicit marketplace flag
  if (options.isMarketplaceRun) return "marketplace";
  // Default: if not builder test, treat as marketplace for safety
  return "marketplace";
}

export function getFailurePolicy(node: { data?: { config?: Record<string, unknown> } }): FailurePolicy {
  const policy = node.data?.config?.failurePolicy;
  if (
    policy === "fail_fast" ||
    policy === "continue" ||
    policy === "skip_downstream" ||
    policy === "use_fallback_value"
  ) {
    return policy;
  }
  return "fail_fast";
}

export function getEdgeGating(edge: { data?: Record<string, unknown> }): EdgeGating {
  const gating = edge.data?.gating;
  if (
    gating === "allow_on_failure" || gating === "require_non_empty" || gating === "require_truthy" ||
    gating === "require_type:json" || gating === "require_type:array" || gating === "require_type:string"
  ) {
    return gating as EdgeGating;
  }
  return "require_success";
}

/** Check if upstream output satisfies the edge gating. */
export function satisfiesEdgeGating(
  output: unknown,
  sourceStatus: "success" | "failed",
  gating: EdgeGating
): boolean {
  if (sourceStatus === "failed") {
    return gating === "allow_on_failure";
  }
  if (gating === "require_success" || gating === "allow_on_failure") return true;
  if (gating === "require_non_empty") {
    if (output === null || output === undefined) return false;
    if (typeof output === "string") return output.trim().length > 0;
    if (Array.isArray(output)) return output.length > 0;
    return true;
  }
  if (gating === "require_truthy") return Boolean(output);
  if (gating === "require_type:json") return typeof output === "object" && output !== null;
  if (gating === "require_type:array") return Array.isArray(output);
  if (gating === "require_type:string") return typeof output === "string";
  return true;
}

export function getFallbackValue(node: { data?: { config?: Record<string, unknown> } }): unknown {
  return node.data?.config?.fallbackValue;
}
