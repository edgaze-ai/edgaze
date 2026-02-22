/**
 * Workflow version hash for reproducibility.
 * Hash the graph structure to create an immutable version identifier.
 */

import crypto from "crypto";

export function computeWorkflowVersionHash(graph: { nodes?: unknown[]; edges?: unknown[] }): string {
  const canonical = JSON.stringify({
    nodes: (graph?.nodes ?? []).map((n: any) => ({
      id: n?.id,
      specId: n?.data?.specId,
      config: n?.data?.config,
    })),
    edges: (graph?.edges ?? []).map((e: any) => ({
      source: e?.source,
      target: e?.target,
    })),
  });
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
