// src/lib/supabase/executions.ts
// Use admin (service role) client so run tracking works in API routes where
// cookie-based session is not available; userId is always verified by the route (Bearer token).
import { createSupabaseAdminClient } from "./admin";

/**
 * Check if a user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_roles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error checking admin status:", error);
    return false;
  }

  return !!data;
}

export type WorkflowRunRow = {
  id: string;
  workflow_id: string | null;
  draft_id: string | null;
  workflow_version_id?: string | null;
  user_id: string;
  status: "pending" | "running" | "cancelling" | "completed" | "failed" | "cancelled" | "timeout";
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_details: any | null;
  state_snapshot: any | null;
  checkpoint: any | null;
  metadata: any | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
};

export async function createWorkflowRun(params: {
  workflowId?: string | null;
  draftId?: string | null;
  workflowVersionId?: string | null;
  userId: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
  status?: WorkflowRunRow["status"];
  checkpoint?: WorkflowRunRow["checkpoint"];
}) {
  const supabase = createSupabaseAdminClient();
  const trimmedIdempotencyKey = params.idempotencyKey?.trim() || null;

  if (trimmedIdempotencyKey) {
    const { data: existing, error: existingError } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("user_id", params.userId)
      .eq("idempotency_key", trimmedIdempotencyKey)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing as WorkflowRunRow;
  }

  const insertData: Record<string, unknown> = {
    user_id: params.userId,
    status: params.status ?? "pending",
    started_at: new Date().toISOString(),
    metadata: params.metadata ?? {},
    idempotency_key: trimmedIdempotencyKey,
  };
  if (params.checkpoint !== undefined) {
    insertData.checkpoint = params.checkpoint;
  }

  if (params.workflowId) {
    insertData.workflow_id = params.workflowId;
  } else if (params.draftId) {
    insertData.draft_id = params.draftId;
  } else {
    throw new Error("Either workflowId or draftId must be provided");
  }

  if (params.workflowVersionId) {
    insertData.workflow_version_id = params.workflowVersionId;
  }

  const { data, error } = await supabase.from("workflow_runs").insert(insertData).select().single();

  if (error) {
    if (trimmedIdempotencyKey && error.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("user_id", params.userId)
        .eq("idempotency_key", trimmedIdempotencyKey)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return existing as WorkflowRunRow;
    }
    throw error;
  }
  return data as WorkflowRunRow;
}

export async function updateWorkflowRun(
  runId: string,
  updates: Partial<
    Pick<
      WorkflowRunRow,
      | "status"
      | "completed_at"
      | "duration_ms"
      | "error_details"
      | "state_snapshot"
      | "checkpoint"
      | "user_id"
    >
  >,
) {
  const supabase = createSupabaseAdminClient();

  // Always use direct update so usage tracking works with service_role (no RPC permission dependency).
  // For terminal statuses, ensure completed_at is set so the run is counted.
  const terminalStatuses = ["completed", "failed", "timeout", "cancelled"];
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if (updates.status && terminalStatuses.includes(updates.status)) {
    payload.completed_at = payload.completed_at ?? new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("workflow_runs")
    .update(payload)
    .eq("id", runId)
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowRunRow;
}

/**
 * Mark a run failed only if it is still active (pending / running / cancelling).
 * Used when the in-process worker stalls or crashes so the UI does not stay "running" forever.
 */
export async function failWorkflowRunIfNonTerminal(
  runId: string,
  errorDetails: Record<string, unknown>,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("workflow_runs")
    .update({
      status: "failed",
      error_details: errorDetails,
      updated_at: now,
      completed_at: now,
    })
    .eq("id", runId)
    .in("status", ["pending", "running", "cancelling"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[failWorkflowRunIfNonTerminal]", error);
    return false;
  }
  return !!data;
}

/** Terminal statuses that consume a run slot (counted toward limit) */
const TERMINAL_STATUSES = ["completed", "failed", "timeout", "cancelled"] as const;

/**
 * Atomically complete a workflow run and return the new run count.
 * Use this instead of updateWorkflowRun + getUserWorkflowRunCount for reliable counting.
 * Eliminates race conditions and removes need for delayed reads.
 */
export async function completeWorkflowRunAndGetCount(params: {
  runId: string;
  status: "completed" | "failed" | "timeout" | "cancelled";
  durationMs?: number | null;
  errorDetails?: Record<string, unknown> | null;
  stateSnapshot?: Record<string, unknown> | null;
}): Promise<{ newCount: number } | null> {
  const supabase = createSupabaseAdminClient();
  try {
    const { data, error } = await supabase.rpc("complete_workflow_run_and_get_count", {
      p_run_id: params.runId,
      p_status: params.status,
      p_duration_ms: params.durationMs ?? null,
      p_error_details: params.errorDetails ?? null,
      p_state_snapshot: params.stateSnapshot ?? null,
    });
    if (error) {
      console.warn(
        "[completeWorkflowRunAndGetCount] RPC failed, falling back to updateWorkflowRun:",
        error.message,
      );
      return null;
    }
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row || typeof row.new_count !== "number") return null;
    return { newCount: row.new_count };
  } catch (err: unknown) {
    console.warn(
      "[completeWorkflowRunAndGetCount] Error:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Head count for account-wide terminal runs (runtime enforcement cap). */
export async function countUserTerminalRunsForCap(userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("workflow_runs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["completed", "failed"]);

  if (error) {
    console.error("Error checking user total runs:", error);
    return 0;
  }

  return count ?? 0;
}

export async function getUserWorkflowRunCount(
  userId: string,
  workflowId: string,
  draftId?: string | null,
): Promise<number> {
  const supabase = createSupabaseAdminClient();

  // Try using the database function first (more reliable)
  // When draftId is set, pass null for workflow_id so RPC counts by draft_id (draft runs have workflow_id NULL)
  try {
    const { data, error } = await supabase.rpc("get_user_workflow_run_count", {
      p_user_id: userId,
      p_workflow_id: draftId ? null : workflowId || null,
      p_draft_id: draftId || null,
    });

    if (
      !error &&
      (typeof data === "number" || (typeof data === "string" && !isNaN(Number(data))))
    ) {
      return typeof data === "number" ? data : Number(data);
    }

    // If function doesn't exist or fails, log and fallback
    if (error) {
      console.warn("[getUserWorkflowRunCount] RPC function failed, using fallback:", error.message);
    }
  } catch (err: any) {
    // RPC function might not exist yet, that's okay - use fallback
    console.warn("[getUserWorkflowRunCount] RPC call error, using fallback:", err?.message);
  }

  // Fallback: direct query (count all terminal states)
  let query = supabase
    .from("workflow_runs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", [...TERMINAL_STATUSES])
    .not("completed_at", "is", null);

  if (draftId) {
    query = query.eq("draft_id", draftId);
  } else if (workflowId) {
    query = query.eq("workflow_id", workflowId);
  } else {
    return 0;
  }

  const { count, error } = await query;

  if (error) {
    console.error("[getUserWorkflowRunCount] Query failed:", error);
    throw error;
  }

  return count ?? 0;
}

export async function getWorkflowRunById(runId: string): Promise<WorkflowRunRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  return data as WorkflowRunRow | null;
}

/**
 * Check if a workflow exists in the database.
 * Returns true if the workflow exists, false otherwise.
 */
export async function workflowExists(workflowId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("id")
    .eq("id", workflowId)
    .maybeSingle();

  if (error) {
    // If error is "not found" or similar, workflow doesn't exist
    if (error.code === "PGRST116") return false;
    // Other errors (e.g. RLS) - log and assume it doesn't exist to be safe
    console.warn("[workflowExists] Error checking workflow:", error.message);
    return false;
  }

  return !!data;
}

/**
 * Check if a workflow draft exists in the database.
 * Returns the draft ID if it exists, null otherwise.
 */
export async function getWorkflowDraftId(
  workflowId: string,
  userId: string,
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  // Check if workflowId matches a draft ID (builder might send draft ID as workflowId)
  const { data: draftById, error: draftByIdError } = await supabase
    .from("workflow_drafts")
    .select("id")
    .eq("id", workflowId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!draftByIdError && draftById) {
    return draftById.id;
  }

  return null;
}

/**
 * Get creator (owner) user ID for a workflow run.
 * Used for unified runs analytics.
 */
export async function getCreatorUserIdForWorkflowRun(
  workflowId: string | null,
  draftId: string | null,
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  if (workflowId) {
    const { data } = await supabase
      .from("workflows")
      .select("owner_id")
      .eq("id", workflowId)
      .maybeSingle();
    return (data as { owner_id?: string } | null)?.owner_id ?? null;
  }
  if (draftId) {
    const { data } = await supabase
      .from("workflow_drafts")
      .select("owner_id")
      .eq("id", draftId)
      .maybeSingle();
    return (data as { owner_id?: string } | null)?.owner_id ?? null;
  }
  return null;
}
