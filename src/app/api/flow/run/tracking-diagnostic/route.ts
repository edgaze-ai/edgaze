import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getUserFromRequest } from "../../_auth";
import {
  getUserWorkflowRunCount,
  createWorkflowRun,
  updateWorkflowRun,
  workflowExists,
  getWorkflowDraftId,
} from "@lib/supabase/executions";

export type TrackingDiagnosticRow = {
  id: string;
  status: string;
  completed_at: string | null;
  created_at: string;
};

/**
 * GET /api/flow/run/tracking-diagnostic?workflowId=...&testInsert=0
 * Returns why run usage might not be increasing: env, count (RPC vs direct), recent runs, optional test insert.
 * Requires auth via Authorization: Bearer <accessToken>.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");
    const testInsert = searchParams.get("testInsert") === "1" || searchParams.get("testInsert") === "true";

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: authError ?? "Sign in required" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const supabase = createSupabaseAdminClient();

    // Check if it's a draft (for builder test runs)
    let draftId: string | null = null;
    const exists = await workflowExists(workflowId);
    if (!exists) {
      draftId = await getWorkflowDraftId(workflowId, userId);
    }

    // 1) Env check
    const envCheck = {
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
    };

    // 2) Count via RPC only (capture error)
    let countRpc: { value: number | null; error: string | null } = { value: null, error: null };
    try {
      const { data, error } = await supabase.rpc("get_user_workflow_run_count", {
        p_user_id: userId,
        p_workflow_id: exists ? workflowId : null,
        p_draft_id: draftId,
      });
      if (error) {
        countRpc.error = error.message || String(error);
      } else if (typeof data === "number" || (typeof data === "string" && !isNaN(Number(data)))) {
        countRpc.value = typeof data === "number" ? data : Number(data);
      } else {
        countRpc.error = "RPC returned no number";
      }
    } catch (err: unknown) {
      countRpc.error = err instanceof Error ? err.message : String(err);
    }

    // 3) Count via direct query only (capture error)
    let countDirect: { value: number | null; error: string | null } = { value: null, error: null };
    try {
      let query = supabase
        .from("workflow_runs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["completed", "failed"])
        .not("completed_at", "is", null);
      
      if (draftId) {
        query = query.eq("draft_id", draftId);
      } else {
        query = query.eq("workflow_id", workflowId);
      }
      
      const { count, error } = await query;
      if (error) {
        countDirect.error = error.message || String(error);
      } else {
        countDirect.value = count ?? 0;
      }
    } catch (err: unknown) {
      countDirect.error = err instanceof Error ? err.message : String(err);
    }

    // 4) Recent runs (last 20)
    let recentRuns: { rows: TrackingDiagnosticRow[]; error: string | null } = { rows: [], error: null };
    try {
      let query = supabase
        .from("workflow_runs")
        .select("id, status, completed_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (draftId) {
        query = query.eq("draft_id", draftId);
      } else {
        query = query.eq("workflow_id", workflowId);
      }
      
      const { data, error } = await query;
      if (error) {
        recentRuns.error = error.message || String(error);
      } else {
        recentRuns.rows = (data ?? []) as TrackingDiagnosticRow[];
      }
    } catch (err: unknown) {
      recentRuns.error = err instanceof Error ? err.message : String(err);
    }

    // Helper to extract error message from Supabase errors
    const extractError = (err: unknown): string => {
      if (err instanceof Error) return err.message;
      if (err && typeof err === "object") {
        const e = err as { message?: string; code?: string; details?: string; hint?: string };
        if (e.message) return e.message;
        if (e.code && e.details) return `${e.code}: ${e.details}`;
        if (e.code) return e.code;
        if (e.details) return e.details;
      }
      return String(err);
    };

    // 5) Optional test insert + update (creates one real row, then marks it failed)
    let testInsertResult: {
      createOk: boolean;
      createError: string | null;
      createErrorDetails?: { code?: string; details?: string; hint?: string };
      updateOk: boolean;
      updateError: string | null;
      updateErrorDetails?: { code?: string; details?: string; hint?: string };
      runId: string | null;
    } | null = null;

    if (testInsert) {
      let runId: string | null = null;
      try {
        const run = await createWorkflowRun({
          workflowId: exists ? workflowId : null,
          draftId: draftId,
          userId,
          metadata: { diagnostic: true, testInsert: true },
        });
        runId = run.id;
        testInsertResult = { createOk: true, createError: null, updateOk: false, updateError: null, runId };
      } catch (err: unknown) {
        const errObj = err && typeof err === "object" ? (err as { code?: string; details?: string; hint?: string }) : {};
        testInsertResult = {
          createOk: false,
          createError: extractError(err),
          createErrorDetails: errObj.code || errObj.details || errObj.hint ? errObj : undefined,
          updateOk: false,
          updateError: null,
          runId: null,
        };
      }
      if (runId) {
        try {
          await updateWorkflowRun(runId, {
            status: "failed",
            completed_at: new Date().toISOString(),
            error_details: { message: "Diagnostic test run" },
          });
          if (testInsertResult) testInsertResult.updateOk = true;
        } catch (err: unknown) {
          if (testInsertResult) {
            const errObj = err && typeof err === "object" ? (err as { code?: string; details?: string; hint?: string }) : {};
            testInsertResult.updateError = extractError(err);
            testInsertResult.updateErrorDetails = errObj.code || errObj.details || errObj.hint ? errObj : undefined;
          }
        }
      }
    }

    // 6) Build summary: why usage might not be increasing
    const summary: string[] = [];
    if (envCheck.serviceRoleKey === "missing") {
      summary.push("SUPABASE_SERVICE_ROLE_KEY is missing. Run tracking uses the admin client; without it, inserts/updates/counts will fail.");
    }
    if (countRpc.error && countDirect.error) {
      summary.push(`Count failed: RPC error "${countRpc.error}", direct query error "${countDirect.error}". This may be RLS or missing grants (e.g. grant execute to service_role).`);
    } else if (countRpc.error && !countDirect.error) {
      summary.push(`RPC get_user_workflow_run_count failed: ${countRpc.error}. Direct count works (${countDirect.value}). Grant EXECUTE on the function to service_role.`);
    } else if (!countRpc.error && countDirect.error) {
      summary.push(`Direct count failed: ${countDirect.error}. RPC works (${countRpc.value}). Likely RLS blocking the direct query.`);
    }
    const rows = recentRuns.rows;
    const stuck = rows.filter((r) => r.status === "running" || r.status === "pending");
    const counted = rows.filter((r) => (r.status === "completed" || r.status === "failed") && r.completed_at);
    if (recentRuns.error) {
      summary.push(`Fetching recent runs failed: ${recentRuns.error}. This may be RLS blocking SELECT.`);
    } else if (rows.length === 0) {
      summary.push("No runs in the database for this user/workflow. Inserts are likely failing (e.g. RLS on INSERT, or missing service role key).");
    } else if (stuck.length > 0 && counted.length === 0) {
      summary.push(`${stuck.length} run(s) are stuck in "running" or "pending". Updates to "completed"/"failed" are likely failing (e.g. RLS on UPDATE, or updateWorkflowRun error). Only completed/failed runs with completed_at are counted.`);
    } else if (counted.length > 0 && (countRpc.value ?? 0) === 0 && (countDirect.value ?? 0) === 0) {
      summary.push("There are completed/failed runs in the table but count is 0. Count query or RPC may be wrong (e.g. wrong status filter or completed_at check).");
    } else if (counted.length > 0 && (countRpc.value ?? countDirect.value ?? 0) !== counted.length) {
      summary.push(`Count (${countRpc.value ?? countDirect.value}) does not match number of completed/failed rows with completed_at (${counted.length}). Check get_user_workflow_run_count logic.`);
    }
    if (testInsertResult && !testInsertResult.createOk) {
      summary.push(`Test insert failed: ${testInsertResult.createError || "Unknown error"}. This is why new runs are not being recorded (e.g. RLS INSERT policy, FK violation, or missing table).`);
      if (testInsertResult.createErrorDetails?.code) {
        summary.push(`Error code: ${testInsertResult.createErrorDetails.code}. ${testInsertResult.createErrorDetails.details || ""} ${testInsertResult.createErrorDetails.hint || ""}`);
      }
    } else if (testInsertResult && testInsertResult.createOk && !testInsertResult.updateOk) {
      summary.push(`Test insert succeeded but update to "failed" failed: ${testInsertResult.updateError || "Unknown error"}. Runs are created but never marked completed/failed, so they are not counted.`);
      if (testInsertResult.updateErrorDetails?.code) {
        summary.push(`Update error code: ${testInsertResult.updateErrorDetails.code}. ${testInsertResult.updateErrorDetails.details || ""} ${testInsertResult.updateErrorDetails.hint || ""}`);
      }
    }

    if (summary.length === 0 && rows.length > 0 && (countRpc.value != null || countDirect.value != null)) {
      summary.push("No obvious issue from this diagnostic. Count and recent runs look consistent. If usage still does not increase, check server logs when you run a workflow (createWorkflowRun / updateWorkflowRun errors).");
    }

    return NextResponse.json({
      ok: true,
      tracking: {
        userId,
        workflowId,
        envCheck,
        countRpc,
        countDirect,
        recentRuns,
        testInsertResult,
        summary,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
