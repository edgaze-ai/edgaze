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
  workflowId?: string | null;
  draftId?: string | null;
  userId: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const insertData: Record<string, unknown> = {
    user_id: params.userId,
    status: "pending",
    started_at: new Date().toISOString(),
    metadata: params.metadata ?? {},
  };
  
  if (params.workflowId) {
    insertData.workflow_id = params.workflowId;
  } else if (params.draftId) {
    insertData.draft_id = params.draftId;
  } else {
    throw new Error("Either workflowId or draftId must be provided");
  }

  const { data, error } = await supabase
    .from("workflow_runs")
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowRunRow;
}

export async function updateWorkflowRun(
  runId: string,
  updates: Partial<Pick<WorkflowRunRow, "status" | "completed_at" | "duration_ms" | "error_details" | "state_snapshot" | "checkpoint">>
) {
  const supabase = createSupabaseAdminClient();

  // Always use direct update so usage tracking works with service_role (no RPC permission dependency).
  // For completed/failed, ensure completed_at is set so the run is counted.
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if (updates.status === "completed" || updates.status === "failed") {
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

export async function getUserWorkflowRunCount(
  userId: string,
  workflowId: string,
  draftId?: string | null
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  
  // Try using the database function first (more reliable)
  // When draftId is set, pass null for workflow_id so RPC counts by draft_id (draft runs have workflow_id NULL)
  try {
    const { data, error } = await supabase.rpc("get_user_workflow_run_count", {
      p_user_id: userId,
      p_workflow_id: draftId ? null : (workflowId || null),
      p_draft_id: draftId || null,
    });
    
    if (!error && (typeof data === "number" || (typeof data === "string" && !isNaN(Number(data))))) {
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
  
  // Fallback: direct query
  let query = supabase
    .from("workflow_runs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["completed", "failed"])
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
  const { data, error } = await supabase.from("workflow_runs").select("*").eq("id", runId).maybeSingle();
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
export async function getWorkflowDraftId(workflowId: string, userId: string): Promise<string | null> {
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
