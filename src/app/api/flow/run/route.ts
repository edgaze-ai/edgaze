import { NextResponse } from "next/server";
import { getUserFromRequest } from "../_auth";
import { runFlow } from "src/server/flow/engine";
import { enforceRuntimeLimits, redactSecrets } from "src/server/flow/runtime-enforcement";
import {
  createWorkflowRun,
  updateWorkflowRun,
  getUserWorkflowRunCount,
  workflowExists,
  getWorkflowDraftId,
} from "@lib/supabase/executions";
import { getEdgazeApiKey } from "@lib/workflow/edgaze-api-key";
import type { GraphPayload } from "src/server/flow/types";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";

const FREE_BUILDER_RUNS = 10;

export async function POST(req: Request) {
  try {
    // Parse request body first to check if this is a demo run
    const body = (await req.json()) as GraphPayload & {
      workflowId?: string;
      userApiKeys?: Record<string, Record<string, string>>;
      isDemo?: boolean;
      isBuilderTest?: boolean;
      openaiApiKey?: string;
    };

    const { nodes = [], edges = [], inputs = {}, workflowId, userApiKeys = {}, isDemo = false, isBuilderTest = false, openaiApiKey: modalOpenaiKey } = body;

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    // Auth: Bearer token only (client sends Authorization: Bearer <accessToken>). Demo runs allowed without auth.
    const { user, error: authError } = await getUserFromRequest(req);
    let userId: string;
    if (user) {
      userId = user.id;
    } else if (isDemo) {
      userId = "anonymous_demo_user";
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: authError ?? "Authentication required. Please sign in to run workflows, or try a demo run.",
        },
        { status: 401 }
      );
    }

    // Runtime enforcement: check free runs and BYO keys
    const enforcement = await enforceRuntimeLimits({
      userId,
      workflowId,
      nodes,
      userApiKeys: isBuilderTest && modalOpenaiKey?.trim()
        ? Object.fromEntries(
            (nodes as { id: string; data?: { specId?: string } }[])
              .filter((n) => ["openai-chat", "openai-embeddings", "openai-image"].includes(n.data?.specId ?? ""))
              .map((n) => [n.id, { apiKey: modalOpenaiKey.trim() }])
          )
        : userApiKeys,
      isDemo,
      isBuilderTest,
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
    const userProvidedKey = isBuilderTest && typeof modalOpenaiKey === "string" && modalOpenaiKey.trim().length > 0;
    if (isBuilderTest) {
      enrichedInputs["__builder_test"] = true;
      if (userProvidedKey) {
        enrichedInputs["__builder_user_key"] = true; // Premium: use inspector model and normal token limits
      }
    }
    const edgazeKey = enforcement.useEdgazeKey ? getEdgazeApiKey() : null;
    const premiumNodeSpecs = ["openai-chat", "openai-embeddings", "openai-image"];
    for (const node of nodes) {
      const specId = node.data?.specId;
      if (premiumNodeSpecs.includes(specId || "")) {
        const modalKey = isBuilderTest && modalOpenaiKey?.trim() ? modalOpenaiKey.trim() : null;
        if (modalKey) {
          enrichedInputs[`__api_key_${node.id}`] = modalKey;
        } else if (edgazeKey) {
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

    // Create run record for authenticated users only (demo user_id is not a valid UUID for FK)
    // Check workflow_drafts if workflow doesn't exist (builder test runs)
    let runId: string | null = null;
    let draftId: string | null = null; // Store for count recalculation
    const isTrackedUser = userId !== "anonymous_demo_user";
    if (isTrackedUser) {
      try {
        // Check if workflow exists in workflows table
        const workflowExistsInDb = await workflowExists(workflowId);
        
        if (!workflowExistsInDb && isBuilderTest) {
          // For builder test runs, check if it's a draft
          draftId = await getWorkflowDraftId(workflowId, userId);
          if (!draftId) {
            console.log(`[Run Tracking] Skipping run tracking: workflow ${workflowId} not found in workflows or drafts`);
          }
        }
        
        if (workflowExistsInDb || draftId) {
          const run = await createWorkflowRun({
            workflowId: workflowExistsInDb ? workflowId : null,
            draftId: draftId,
            userId,
            metadata: {
              nodeCount: nodes.length,
              edgeCount: edges.length,
              freeRunsRemaining: enforcement.freeRunsRemaining,
              isDemo: isDemo,
              isBuilderTest: isBuilderTest,
            },
          });
          runId = run.id;
          await updateWorkflowRun(runId, { status: "running" });
          console.log(
            `[Run Tracking] Created run ${runId} for user ${userId}, ${draftId ? `draft ${draftId}` : `workflow ${workflowId}`}, status: running`
          );
        }
      } catch (err: any) {
        console.error("[Run Tracking] CRITICAL: Failed to create run record:", {
          error: err?.message,
          code: err?.code,
          details: err?.details,
          hint: err?.hint,
          userId,
          workflowId,
          stack: err?.stack,
        });
        // Continue execution; usage count will not increment for this run
      }
    }

    const startTime = Date.now();
    let result;

    try {
      // Add workflow ID to inputs so handlers can access it for token limits
      enrichedInputs["__workflow_id"] = workflowId;
      
      // Extract client identifier for rate limiting
      const clientId = extractClientIdentifier(req);
      
      // Execute workflow with request metadata for rate limiting
      result = await runFlow({
        nodes,
        edges,
        inputs: enrichedInputs,
        workflowId,
        requestMetadata: {
          userId: userId || null,
          identifier: clientId.identifier,
          identifierType: clientId.type,
          workflowId: workflowId,
        },
      });

      const duration = Date.now() - startTime;

      // Update run record on completion - ALWAYS update to track usage
      let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;
      const finalStatus = result.workflowStatus === "completed" ? "completed" : "failed";
      
      // CRITICAL: Update run status - retry up to 3 times if it fails
      let updateSuccess = false;
      if (runId) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await updateWorkflowRun(runId, {
              status: finalStatus,
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              state_snapshot: {
                nodeStatus: result.nodeStatus,
                outputsByNode: redactSecrets(result.outputsByNode),
              },
            });
            updateSuccess = true;
            console.log(`[Run Tracking] Successfully updated run ${runId} to ${finalStatus} (attempt ${attempt})`);
            break;
          } catch (updateErr: any) {
            console.error(`[Run Tracking] Update attempt ${attempt} failed:`, {
              error: updateErr?.message,
              code: updateErr?.code,
              details: updateErr?.details,
              hint: updateErr?.hint,
              runId,
              userId,
              workflowId,
              finalStatus,
            });
            
            if (attempt < 3) {
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            } else {
              // Last attempt failed - log critical error
              console.error("[Run Tracking] CRITICAL: All update attempts failed for run:", runId);
            }
          }
        }
      } else {
        console.warn(`[Run Tracking] No runId available - run was not tracked. User: ${userId}, Workflow: ${workflowId}`);
      }
      
      // ALWAYS recalculate count after completion - retry up to 3 times
      let countSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Add a delay to ensure DB consistency (longer delay for first attempt)
          await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 300 : 100));
          
          const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
          const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
          updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
          countSuccess = true;
          
          console.log(`[Run Tracking] Recalculated count: ${updatedRunCount}/${freeRunLimit}, remaining: ${updatedFreeRunsRemaining} (attempt ${attempt})`);
          
          // Verify the update worked
          if (updateSuccess && updatedRunCount <= enforcement.freeRunsRemaining && enforcement.freeRunsRemaining < freeRunLimit && updatedRunCount < freeRunLimit) {
            console.warn(`[Run Tracking] WARNING: Count may not have updated correctly. Expected increase but got: ${updatedRunCount} (was ${enforcement.freeRunsRemaining}). RunId: ${runId}, Status: ${finalStatus}`);
          }
          break;
        } catch (countErr: any) {
          console.error(`[Run Tracking] Count attempt ${attempt} failed:`, {
            error: countErr?.message,
            code: countErr?.code,
            details: countErr?.details,
            hint: countErr?.hint,
            userId,
            workflowId,
            runId,
          });
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          } else {
            console.error("[Run Tracking] CRITICAL: All count attempts failed");
          }
        }
      }
      
      // Final verification: if update succeeded but count didn't increase, log warning
      if (updateSuccess && !countSuccess) {
        console.error("[Run Tracking] CRITICAL: Run was updated but count query failed. RunId:", runId);
      }
      
      // Redact secrets from response
      const safeResult = {
        ...result,
        outputsByNode: redactSecrets(result.outputsByNode) as Record<string, unknown>,
        finalOutputs: result.finalOutputs.map((fo) => ({
          nodeId: fo.nodeId,
          value: redactSecrets(fo.value),
        })),
      };

      return NextResponse.json({
        ok: true,
        result: safeResult,
        freeRunsRemaining: updatedFreeRunsRemaining,
        runId,
      });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const errorMessage = err?.message || "Unknown error";

      // Update run record on error - ALWAYS update to track usage with retries
      let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;
      let updateSuccess = false;
      
      if (runId) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await updateWorkflowRun(runId, {
              status: "failed",
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              error_details: redactSecrets({ message: errorMessage, stack: err?.stack }),
            });
            updateSuccess = true;
            console.log(`[Run Tracking] Successfully updated run ${runId} to failed (attempt ${attempt})`);
            break;
          } catch (updateErr: any) {
            console.error(`[Run Tracking] Update attempt ${attempt} failed:`, {
              error: updateErr?.message,
              code: updateErr?.code,
              details: updateErr?.details,
              hint: updateErr?.hint,
              runId,
              userId,
              workflowId,
            });
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            } else {
              console.error("[Run Tracking] CRITICAL: All update attempts failed for failed run:", runId);
            }
          }
        }
      } else {
        console.warn(`[Run Tracking] No runId available on error - run was not tracked. User: ${userId}, Workflow: ${workflowId}`);
      }
      
      // ALWAYS recalculate count after error - retry up to 3 times
      let countSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 300 : 100));
          
          const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
          const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
          updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
          countSuccess = true;
          
          console.log(`[Run Tracking] Recalculated count after error: ${updatedRunCount}/${freeRunLimit}, remaining: ${updatedFreeRunsRemaining} (attempt ${attempt})`);
          
          if (updateSuccess && updatedRunCount <= enforcement.freeRunsRemaining && enforcement.freeRunsRemaining < freeRunLimit && updatedRunCount < freeRunLimit) {
            console.warn(`[Run Tracking] WARNING: Count may not have updated correctly after error. Expected increase but got: ${updatedRunCount} (was ${enforcement.freeRunsRemaining}). RunId: ${runId}`);
          }
          break;
        } catch (countErr: any) {
          console.error(`[Run Tracking] Count attempt ${attempt} failed after error:`, {
            error: countErr?.message,
            code: countErr?.code,
            details: countErr?.details,
            hint: countErr?.hint,
            userId,
            workflowId,
            runId,
          });
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          } else {
            console.error("[Run Tracking] CRITICAL: All count attempts failed after error");
          }
        }
      }
      
      if (updateSuccess && !countSuccess) {
        console.error("[Run Tracking] CRITICAL: Failed run was updated but count query failed. RunId:", runId);
      }

      return NextResponse.json(
        {
          ok: false,
          error: redactSecrets(errorMessage) as string,
          runId,
          freeRunsRemaining: updatedFreeRunsRemaining,
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
