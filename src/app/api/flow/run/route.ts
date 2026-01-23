import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@lib/supabase/server";
import { runFlow } from "src/server/flow/engine";
import { enforceRuntimeLimits, redactSecrets } from "src/server/flow/runtime-enforcement";
import { createWorkflowRun, updateWorkflowRun } from "@lib/supabase/executions";
import type { GraphPayload } from "src/server/flow/types";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();

    if (authErr || !auth?.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const userId = auth.user.id;
    const body = (await req.json()) as GraphPayload & {
      workflowId?: string;
      userApiKeys?: Record<string, Record<string, string>>;
    };

    const { nodes = [], edges = [], inputs = {}, workflowId, userApiKeys = {} } = body;

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    // Runtime enforcement: check free runs and BYO keys
    const enforcement = await enforceRuntimeLimits({
      userId,
      workflowId,
      nodes,
      userApiKeys,
    });

    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: enforcement.error || "Runtime limit exceeded",
          requiresApiKeys: enforcement.requiresApiKeys,
          freeRunsRemaining: enforcement.freeRunsRemaining,
        },
        { status: 403 }
      );
    }

    // Inject user API keys into inputs for premium nodes
    const enrichedInputs: Record<string, unknown> = { ...inputs };
    for (const [nodeId, keys] of Object.entries(userApiKeys)) {
      enrichedInputs[`__api_key_${nodeId}`] = keys.apiKey;
    }

    // Create run record
    let runId: string | null = null;
    try {
      const run = await createWorkflowRun({
        workflowId,
        userId,
        metadata: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          freeRunsRemaining: enforcement.freeRunsRemaining,
        },
      });
      runId = run.id;

      // Update to running
      await updateWorkflowRun(runId, { status: "running" });
    } catch (err) {
      console.error("Failed to create run record:", err);
      // Continue execution even if tracking fails
    }

    const startTime = Date.now();
    let result;

    try {
      // Execute workflow
      result = await runFlow({
        nodes,
        edges,
        inputs: enrichedInputs,
      });

      const duration = Date.now() - startTime;

      // Update run record on completion
      if (runId) {
        await updateWorkflowRun(runId, {
          status: result.workflowStatus === "completed" ? "completed" : "failed",
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          state_snapshot: {
            nodeStatus: result.nodeStatus,
            outputsByNode: redactSecrets(result.outputsByNode),
          },
        });
      }

      // Redact secrets from response
      const safeResult = {
        ...result,
        outputsByNode: redactSecrets(result.outputsByNode) as Record<string, unknown>,
        finalOutputs: result.finalOutputs.map((fo) => ({
          ...fo,
          value: redactSecrets(fo.value),
        })),
      };

      return NextResponse.json({
        ok: true,
        result: safeResult,
        freeRunsRemaining: enforcement.freeRunsRemaining,
        runId,
      });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const errorMessage = err?.message || "Unknown error";

      if (runId) {
        await updateWorkflowRun(runId, {
          status: "failed",
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          error_details: redactSecrets({ message: errorMessage, stack: err?.stack }),
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error: redactSecrets(errorMessage) as string,
          runId,
        },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: redactSecrets(e?.message || "Unknown error") as string },
      { status: 500 }
    );
  }
}
