import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@lib/supabase/server";
import { runFlow } from "src/server/flow/engine";
import { enforceRuntimeLimits, redactSecrets } from "src/server/flow/runtime-enforcement";
import { createWorkflowRun, updateWorkflowRun } from "@lib/supabase/executions";
import { getEdgazeApiKey } from "@lib/workflow/edgaze-api-key";
import type { GraphPayload } from "src/server/flow/types";

export async function POST(req: Request) {
  try {
    // Parse request body first to check if this is a demo run
    const body = (await req.json()) as GraphPayload & {
      workflowId?: string;
      userApiKeys?: Record<string, Record<string, string>>;
      isDemo?: boolean;
    };

    const { nodes = [], edges = [], inputs = {}, workflowId, userApiKeys = {}, isDemo = false } = body;

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    // Create Supabase client - this reads cookies from the request automatically
    const supabase = await createSupabaseServerClient();
    
    // Get user session - allow demo runs without auth
    let userId: string | null = null;
    let isAuthenticated = false;
    
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    
    if (authErr || !auth?.user) {
      // Fallback to getSession (sometimes works when getUser doesn't)
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      
      if (sessionErr || !sessionData?.session?.user) {
        // No auth session - allow if this is a demo run
        if (isDemo) {
          // Use anonymous user ID for demo runs
          userId = "anonymous_demo_user";
          isAuthenticated = false;
        } else {
          // Not a demo and no auth - require sign in
          const errorMsg = authErr?.message || sessionErr?.message || "No active session found";
          
          console.error("Auth error in /api/flow/run:", {
            getUserError: authErr?.message,
            getSessionError: sessionErr?.message,
            getUserStatus: authErr?.status,
            getSessionStatus: sessionErr?.status,
            isDemo,
          });
          
          return NextResponse.json({ 
            ok: false, 
            error: errorMsg.includes("session") ? errorMsg : `Authentication required. Please sign in to run workflows, or try a demo run.`
          }, { status: 401 });
        }
      } else {
        // Use session user
        userId = sessionData.session.user.id;
        isAuthenticated = true;
      }
    } else {
      // getUser succeeded
      userId = auth.user.id;
      isAuthenticated = true;
    }

    if (!userId) {
      return NextResponse.json({ 
        ok: false, 
        error: "Unable to determine user ID" 
      }, { status: 401 });
    }

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    // Runtime enforcement: check free runs and BYO keys
    const enforcement = await enforceRuntimeLimits({
      userId,
      workflowId,
      nodes,
      userApiKeys,
      isDemo,
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

    // Inject API keys into inputs for premium nodes
    const enrichedInputs: Record<string, unknown> = { ...inputs };
    const edgazeKey = enforcement.useEdgazeKey ? getEdgazeApiKey() : null;
    
    const premiumNodeSpecs = ["openai-chat", "openai-embeddings", "openai-image"];
    for (const node of nodes) {
      const specId = node.data?.specId;
      if (premiumNodeSpecs.includes(specId || "")) {
        if (edgazeKey) {
          enrichedInputs[`__api_key_${node.id}`] = edgazeKey;
        } else {
          const nodeKeys = userApiKeys[node.id];
          if (nodeKeys?.apiKey) {
            enrichedInputs[`__api_key_${node.id}`] = nodeKeys.apiKey;
          } else {
            const configKey = node.data?.config?.apiKey;
            if (configKey && typeof configKey === "string" && configKey.trim()) {
              enrichedInputs[`__api_key_${node.id}`] = configKey.trim();
            }
          }
        }
      }
    }

    // Create run record (skip for anonymous demo users)
    let runId: string | null = null;
    if (isAuthenticated) {
      try {
        const run = await createWorkflowRun({
          workflowId,
          userId,
          metadata: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            freeRunsRemaining: enforcement.freeRunsRemaining,
            isDemo: isDemo,
          },
        });
        runId = run.id;
        await updateWorkflowRun(runId, { status: "running" });
      } catch (err) {
        console.error("Failed to create run record:", err);
        // Continue execution even if tracking fails
      }
    }

    const startTime = Date.now();
    let result;

    try {
      // Add workflow ID to inputs so handlers can access it for token limits
      enrichedInputs["__workflow_id"] = workflowId;
      
      // Execute workflow
      result = await runFlow({
        nodes,
        edges,
        inputs: enrichedInputs,
        workflowId,
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
