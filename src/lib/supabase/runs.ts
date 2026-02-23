// src/lib/supabase/runs.ts
// Unified run tracking for workflow and prompt executions (analytics).
// Uses admin client - server-side only.

import { createSupabaseAdminClient } from "./admin";

export type RunKind = "workflow" | "prompt";

export type RunStatus = "running" | "success" | "error" | "canceled";

export type RunRow = {
  id: string;
  kind: RunKind;
  workflow_id: string | null;
  prompt_id: string | null;
  version_id: string | null;
  runner_user_id: string | null;
  creator_user_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: RunStatus;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
  input_bytes: number | null;
  output_bytes: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  model: string | null;
  workflow_run_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CreateRunParams = {
  kind: RunKind;
  workflowId?: string | null;
  promptId?: string | null;
  versionId?: string | null;
  runnerUserId?: string | null;
  creatorUserId: string | null;
  workflowRunId?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateRunParams = {
  endedAt?: string;
  status?: RunStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  inputBytes?: number | null;
  outputBytes?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createRun(params: CreateRunParams): Promise<RunRow> {
  const supabase = createSupabaseAdminClient();
  const row: Record<string, unknown> = {
    kind: params.kind,
    creator_user_id: params.creatorUserId,
    runner_user_id: params.runnerUserId ?? null,
    status: "running",
    started_at: new Date().toISOString(),
    metadata: params.metadata ?? {},
  };
  if (params.workflowId) row.workflow_id = params.workflowId;
  if (params.promptId) row.prompt_id = params.promptId;
  if (params.versionId) row.version_id = params.versionId;
  if (params.workflowRunId) row.workflow_run_id = params.workflowRunId;

  const { data, error } = await supabase
    .from("runs")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data as RunRow;
}

export async function updateRun(runId: string, params: UpdateRunParams): Promise<RunRow> {
  const supabase = createSupabaseAdminClient();
  const updates: Record<string, unknown> = {
    ...params,
    updated_at: new Date().toISOString(),
  };
  if (params.endedAt) updates.ended_at = params.endedAt;
  if (params.status) updates.status = params.status;
  if (params.errorCode !== undefined) updates.error_code = params.errorCode;
  if (params.errorMessage !== undefined) updates.error_message = params.errorMessage;
  if (params.durationMs !== undefined) updates.duration_ms = params.durationMs;
  if (params.inputBytes !== undefined) updates.input_bytes = params.inputBytes;
  if (params.outputBytes !== undefined) updates.output_bytes = params.outputBytes;
  if (params.tokensIn !== undefined) updates.tokens_in = params.tokensIn;
  if (params.tokensOut !== undefined) updates.tokens_out = params.tokensOut;
  if (params.model !== undefined) updates.model = params.model;
  if (params.metadata) updates.metadata = params.metadata;

  const { data, error } = await supabase
    .from("runs")
    .update(updates)
    .eq("id", runId)
    .select()
    .single();

  if (error) throw error;
  return data as RunRow;
}
