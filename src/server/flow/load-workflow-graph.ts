import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getWorkflowVersionById } from "@lib/supabase/workflow-versions";
import type { GraphEdge, GraphNode } from "./types";

/**
 * Canonical published graph for execution (active workflow version, else workflows row).
 * Uses service role — only call after authz checks in API routes.
 */
export async function loadPublishedWorkflowGraphForExecution(workflowId: string): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> {
  const supabase = createSupabaseAdminClient();
  const { data: wf, error } = await supabase
    .from("workflows")
    .select("graph_json, graph, active_version_id")
    .eq("id", workflowId)
    .maybeSingle();

  if (error || !wf) {
    throw new Error("Workflow not found");
  }

  const versionId = (wf as { active_version_id?: string | null }).active_version_id;
  if (versionId) {
    const ver = await getWorkflowVersionById(versionId);
    if (ver?.graph_json && typeof ver.graph_json === "object") {
      const g = ver.graph_json as { nodes?: GraphNode[]; edges?: GraphEdge[] };
      return {
        nodes: (g.nodes ?? []) as GraphNode[],
        edges: (g.edges ?? []) as GraphEdge[],
      };
    }
  }

  const raw =
    (wf as { graph_json?: unknown; graph?: unknown }).graph_json ??
    (wf as { graph?: unknown }).graph;
  const g = (raw && typeof raw === "object" ? raw : {}) as {
    nodes?: GraphNode[];
    edges?: GraphEdge[];
  };
  return {
    nodes: (g.nodes ?? []) as GraphNode[],
    edges: (g.edges ?? []) as GraphEdge[],
  };
}
