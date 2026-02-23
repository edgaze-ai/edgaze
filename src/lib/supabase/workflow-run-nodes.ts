import { createSupabaseAdminClient } from "./admin";

export async function insertWorkflowRunNodes(
  runId: string,
  traces: Array<{
    nodeId: string;
    specId: string;
    status: string;
    startMs: number;
    endMs: number;
    error?: string;
    retries: number;
    tokens?: number;
    model?: string;
  }>
): Promise<void> {
  if (traces.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const rows = traces.map((t) => ({
    workflow_run_id: runId,
    node_id: t.nodeId,
    spec_id: t.specId,
    status: t.status,
    started_at: new Date(t.startMs).toISOString(),
    ended_at: new Date(t.endMs).toISOString(),
    duration_ms: t.endMs - t.startMs,
    error_message: t.error ?? null,
    tokens_used: t.tokens ?? null,
    model: t.model ?? null,
    retries: t.retries,
  }));
  const { error } = await supabase.from("workflow_run_nodes").insert(rows);
  if (error) {
    console.error("[workflow_run_nodes] Insert failed:", error);
  }
}
