// src/lib/supabase/executions.ts
import { createSupabaseServerClient } from "./server";

export type WorkflowRunRow = {
  id: string;
  workflow_id: string | null;
  user_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "timeout";
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_details: any | null;
  state_snapshot: any | null;
  checkpoint: any | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
};

export async function createWorkflowRun(params: {
  workflowId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .insert({
      workflow_id: params.workflowId,
      user_id: params.userId,
      status: "pending",
      started_at: new Date().toISOString(),
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowRunRow;
}

export async function updateWorkflowRun(
  runId: string,
  updates: Partial<Pick<WorkflowRunRow, "status" | "completed_at" | "duration_ms" | "error_details" | "state_snapshot" | "checkpoint">>
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowRunRow;
}

export async function getUserWorkflowRunCount(userId: string, workflowId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("workflow_runs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workflow_id", workflowId)
    .in("status", ["completed", "failed"]);

  if (error) throw error;
  return count ?? 0;
}

export async function getWorkflowRunById(runId: string): Promise<WorkflowRunRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("workflow_runs").select("*").eq("id", runId).maybeSingle();
  if (error) throw error;
  return data as WorkflowRunRow | null;
}
