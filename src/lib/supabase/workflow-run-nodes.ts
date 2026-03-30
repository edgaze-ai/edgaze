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
  }>,
): Promise<void> {
  if (traces.length === 0) return;
  const supabase = createSupabaseAdminClient();

  const { data: existingRows, error: existingError } = await supabase
    .from("workflow_run_nodes")
    .select("id, node_id")
    .eq("workflow_run_id", runId);

  if (existingError) {
    console.error("[workflow_run_nodes] Existing row lookup failed:", existingError);
    return;
  }

  const existingByNodeId = new Map(
    (existingRows ?? []).map((row) => [String(row.node_id), String(row.id)]),
  );

  const inserts = traces
    .filter((trace) => !existingByNodeId.has(trace.nodeId))
    .map((t) => ({
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

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("workflow_run_nodes").insert(inserts);
    if (insertError) {
      console.error("[workflow_run_nodes] Insert failed:", insertError);
      return;
    }
  }

  for (const trace of traces) {
    const existingId = existingByNodeId.get(trace.nodeId);
    if (!existingId) continue;

    const { error: updateError } = await supabase
      .from("workflow_run_nodes")
      .update({
        spec_id: trace.specId,
        status: trace.status,
        started_at: new Date(trace.startMs).toISOString(),
        ended_at: new Date(trace.endMs).toISOString(),
        duration_ms: trace.endMs - trace.startMs,
        error_message: trace.error ?? null,
        tokens_used: trace.tokens ?? null,
        model: trace.model ?? null,
        retries: trace.retries,
      })
      .eq("id", existingId);

    if (updateError) {
      console.error("[workflow_run_nodes] Update failed:", updateError);
      return;
    }
  }
}
