import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getWorkflowVersionById } from "@lib/supabase/workflow-versions";
import type { GraphEdge, GraphNode } from "./types";

/**
 * Canonical graph JSON for publishing a listing — read from DB so the publish API
 * request body stays small (avoids serverless payload limits).
 */
export async function loadWorkflowGraphJsonForPublishing(
  workflowId: string,
  ownerId: string,
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();

  const { data: draft, error: draftErr } = await supabase
    .from("workflow_drafts")
    .select("graph")
    .eq("id", workflowId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!draftErr && draft?.graph != null && typeof draft.graph === "object") {
    return draft.graph as Record<string, unknown>;
  }

  const { data: wf, error: wfErr } = await supabase
    .from("workflows")
    .select("graph_json, graph, active_version_id")
    .eq("id", workflowId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (wfErr || !wf) {
    throw new Error("Workflow graph not found. Save your draft and try again.");
  }

  const versionId = (wf as { active_version_id?: string | null }).active_version_id;
  if (versionId) {
    const ver = await getWorkflowVersionById(versionId);
    if (ver?.graph_json && typeof ver.graph_json === "object") {
      return ver.graph_json as Record<string, unknown>;
    }
  }

  const raw =
    (wf as { graph_json?: unknown; graph?: unknown }).graph_json ??
    (wf as { graph?: unknown }).graph;
  if (raw && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return { nodes: [], edges: [] };
}

async function workflowRowExists(workflowId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("id")
    .eq("id", workflowId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    console.warn("[load-workflow-graph] workflowRowExists:", error.message);
  }
  return !!data;
}

/**
 * Draft graph for builder execution — must match the row the user is allowed to run.
 * Uses service role — only call after authz checks in API routes.
 */
export async function loadWorkflowDraftGraphForExecution(
  draftId: string,
  ownerId: string,
): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> {
  const supabase = createSupabaseAdminClient();
  const { data: draft, error } = await supabase
    .from("workflow_drafts")
    .select("graph")
    .eq("id", draftId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error || !draft) {
    throw new Error("Draft not found");
  }

  const raw = draft.graph as { nodes?: GraphNode[]; edges?: GraphEdge[] } | null;
  return {
    nodes: (raw?.nodes ?? []) as GraphNode[],
    edges: (raw?.edges ?? []) as GraphEdge[],
  };
}

export type AuthenticatedRunGraphEntitlement = {
  useServerMarketplaceGraph: boolean;
  draftIdForCount: string | null;
};

/**
 * Resolves nodes/edges from Supabase immediately before a run (same rules as
 * POST /api/workflow/resolve-run-graph) so execution never relies on a stale client payload.
 */
export async function resolveAuthenticatedRunGraphForExecution(params: {
  userId: string;
  workflowId: string;
  entitlement: AuthenticatedRunGraphEntitlement;
}): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] } | null> {
  const { userId, workflowId, entitlement } = params;
  if (entitlement.useServerMarketplaceGraph) {
    return loadPublishedWorkflowGraphForExecution(workflowId);
  }
  if (entitlement.draftIdForCount) {
    return loadWorkflowDraftGraphForExecution(entitlement.draftIdForCount, userId);
  }
  if (await workflowRowExists(workflowId)) {
    return loadPublishedWorkflowGraphForExecution(workflowId);
  }
  return null;
}

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
