import { createSupabaseAdminClient } from "./admin";
import { computeWorkflowVersionHash } from "@lib/workflow/version-hash";

export type WorkflowVersionRow = {
  id: string;
  workflow_id: string;
  graph_json: Record<string, unknown>;
  version_hash: string;
  created_at: string;
};

export async function createWorkflowVersion(workflowId: string, graph: { nodes: unknown[]; edges: unknown[] }): Promise<WorkflowVersionRow> {
  const supabase = createSupabaseAdminClient();
  const versionHash = computeWorkflowVersionHash(graph);
  const { data, error } = await supabase
    .from("workflow_versions")
    .insert({
      workflow_id: workflowId,
      graph_json: graph,
      version_hash: versionHash,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WorkflowVersionRow;
}

export async function getWorkflowVersionById(versionId: string): Promise<WorkflowVersionRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("workflow_versions").select("*").eq("id", versionId).maybeSingle();
  if (error) throw error;
  return data as WorkflowVersionRow | null;
}

export async function setWorkflowActiveVersion(workflowId: string, versionId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("workflows").update({ active_version_id: versionId }).eq("id", workflowId);
  if (error) throw error;
}

export async function getWorkflowActiveVersionId(workflowId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("active_version_id")
    .eq("id", workflowId)
    .maybeSingle();
  if (error) throw error;
  return data?.active_version_id ?? null;
}
