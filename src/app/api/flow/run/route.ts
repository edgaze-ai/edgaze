import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { runFlow } from "src/server/flow/engine";
import { enforceRuntimeLimits, redactSecrets } from "src/server/flow/runtime-enforcement";
import {
  createWorkflowRun,
  updateWorkflowRun,
  completeWorkflowRunAndGetCount,
  getUserWorkflowRunCount,
  workflowExists,
  getWorkflowDraftId,
  getCreatorUserIdForWorkflowRun,
} from "@lib/supabase/executions";
import { createRun, updateRun } from "@lib/supabase/runs";
import { insertWorkflowRunNodes } from "@lib/supabase/workflow-run-nodes";
import { getWorkflowActiveVersionId, getWorkflowVersionById } from "@lib/supabase/workflow-versions";
import { getEdgazeApiKey } from "@lib/workflow/edgaze-api-key";
import type { GraphPayload } from "src/server/flow/types";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

const FREE_BUILDER_RUNS = 10;

async function finishUnifiedRun(
  unifiedRunId: string | null,
  status: "success" | "error",
  duration: number,
  errorMessage?: string,
  nodeTraces?: Array<{ tokens?: number; model?: string }>
): Promise<void> {
  if (!unifiedRunId) return;
  const traces = nodeTraces ?? [];
  const totalTokens = traces.reduce((s, t) => s + (t.tokens ?? 0), 0);
  const model = traces.find((t) => t.model)?.model ?? null;
  try {
    await updateRun(unifiedRunId, {
      status,
      endedAt: new Date().toISOString(),
      durationMs: duration,
      errorMessage: status === "error" ? (errorMessage ?? null) : null,
      tokensIn: totalTokens > 0 ? totalTokens : null,
      tokensOut: null, // Node traces don't separate in/out
      model,
    });
  } catch (e) {
    console.error("[Runs] Update unified run failed:", e);
  }
}

export async function POST(req: Request) {
  try {
    // Parse request body first to check if this is a demo run
    const body = (await req.json()) as GraphPayload & {
      workflowId?: string;
      userApiKeys?: Record<string, Record<string, string>>;
      isDemo?: boolean;
      isBuilderTest?: boolean;
      openaiApiKey?: string;
      deviceFingerprint?: string;
      stream?: boolean;
      adminDemoToken?: string;
    };

    const { nodes = [], edges = [], inputs = {}, workflowId, userApiKeys = {}, isDemo = false, isBuilderTest = false, openaiApiKey: modalOpenaiKey, deviceFingerprint, stream: useStream = false, adminDemoToken } = body;

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    // Auth: Bearer token only (client sends Authorization: Bearer <accessToken>). Demo runs and admin demo link allowed without auth.
    const { user, error: authError } = await getUserFromRequest(req);
    let userId: string;
    if (user) {
      userId = user.id;
    } else if (adminDemoToken && typeof adminDemoToken === "string" && adminDemoToken.length >= 16) {
      // Admin demo link: verify token matches workflow, bypass device limit
      const supabase = createSupabaseAdminClient();
      const { data: wf, error: wfError } = await supabase
        .from("workflows")
        .select("id")
        .eq("id", workflowId)
        .eq("demo_mode_enabled", true)
        .eq("demo_token", adminDemoToken.trim())
        .maybeSingle();
      if (wfError || !wf) {
        return NextResponse.json(
          { ok: false, error: "Invalid or expired demo link. Please use the link from the admin panel." },
          { status: 403 }
        );
      }
      userId = "admin_demo_user";
    } else if (isDemo) {
      // For anonymous demo runs, check server-side tracking (device fingerprint + IP)
      if (!deviceFingerprint || deviceFingerprint.length < 10) {
        return NextResponse.json(
          {
            ok: false,
            error: "Device fingerprint is required for demo runs",
          },
          { status: 400 }
        );
      }

      // Extract IP address
      const clientId = extractClientIdentifier(req);
      const ipAddress = clientId.type === "ip" ? clientId.identifier : "unknown";

      // Check if demo run is allowed (strict one-time check)
      const supabase = createSupabaseAdminClient();
      const { data: checkData, error: checkError } = await supabase.rpc("can_run_anonymous_demo", {
        p_workflow_id: workflowId,
        p_device_fingerprint: deviceFingerprint,
        p_ip_address: ipAddress,
      });

      if (checkError) {
        console.error("[Demo Runs] Error checking demo run eligibility:", checkError);
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to verify demo run eligibility. Please try again.",
          },
          { status: 500 }
        );
      }

      if (checkData !== true) {
        // Demo run already used for this device + IP combination
        return NextResponse.json(
          {
            ok: false,
            error: "You've already used your one-time demo run for this workflow. Each device and IP address combination gets one demo run.",
          },
          { status: 403 }
        );
      }

      // Record the demo run (atomic operation with duplicate check)
      const { data: recordData, error: recordError } = await supabase.rpc("record_anonymous_demo_run", {
        p_workflow_id: workflowId,
        p_device_fingerprint: deviceFingerprint,
        p_ip_address: ipAddress,
      });

      if (recordError) {
        console.error("[Demo Runs] Error recording demo run:", recordError);
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to record demo run. Please try again.",
          },
          { status: 500 }
        );
      }

      const recordResult = recordData as {
        success: boolean;
        allowed: boolean;
        error?: string;
      };

      if (!recordResult.success || !recordResult.allowed) {
        // Race condition: another request already recorded this demo run
        return NextResponse.json(
          {
            ok: false,
            error: recordResult.error || "Demo run already used for this device and IP address.",
          },
          { status: 403 }
        );
      }

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
    let unifiedRunId: string | null = null; // For runs table (analytics)
    let draftId: string | null = null; // Store for count recalculation
    const isTrackedUser = userId !== "anonymous_demo_user";
    const isValidRunnerUuid = /^[0-9a-f-]{36}$/i.test(userId ?? "");
    if (isTrackedUser) {
      try {
        // Check if workflow exists in workflows table
        const workflowExistsInDb = await workflowExists(workflowId);

        if (!workflowExistsInDb && isBuilderTest) {
          // For builder test runs, check if it's a draft
          draftId = await getWorkflowDraftId(workflowId, userId);
          if (!draftId) {
            console.warn(`[Run Tracking] Skipping run tracking: workflow ${workflowId} not found in workflows or drafts`);
          }
        }

        if (workflowExistsInDb || draftId) {
          let workflowVersionId: string | null = null;
          let workflowVersionHash: string | null = null;
          if (workflowExistsInDb && !isBuilderTest && workflowId) {
            workflowVersionId = await getWorkflowActiveVersionId(workflowId);
            if (workflowVersionId) {
              const versionRow = await getWorkflowVersionById(workflowVersionId);
              workflowVersionHash = versionRow?.version_hash ?? null;
            }
          }
          const run = await createWorkflowRun({
            workflowId: workflowExistsInDb ? workflowId : null,
            draftId: draftId,
            workflowVersionId: workflowVersionId ?? undefined,
            userId,
            metadata: {
              nodeCount: nodes.length,
              edgeCount: edges.length,
              freeRunsRemaining: enforcement.freeRunsRemaining,
              isDemo: isDemo,
              isBuilderTest: isBuilderTest,
              workflow_version_hash: workflowVersionHash ?? undefined,
            },
          });
          runId = run.id;
          await updateWorkflowRun(runId, { status: "running" });
          // Unified runs table (analytics)
          try {
            const creatorUserId = await getCreatorUserIdForWorkflowRun(
              workflowExistsInDb ? workflowId : null,
              draftId
            );
            const unifiedRun = await createRun({
              kind: "workflow",
              workflowId: workflowExistsInDb ? workflowId : null,
              versionId: workflowVersionId ?? undefined,
              runnerUserId: isValidRunnerUuid ? userId : null,
              creatorUserId,
              workflowRunId: run.id,
              metadata: {
                nodeCount: nodes.length,
                isBuilderTest,
                isDemo,
              },
            });
            unifiedRunId = unifiedRun.id;
          } catch (runErr: unknown) {
            console.warn("[Runs] Failed to create unified run record:", runErr);
          }
          console.warn(
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
    const clientId = extractClientIdentifier(req);
    const flowPayload = {
      nodes,
      edges,
      inputs: { ...enrichedInputs, __workflow_id: workflowId } as Record<string, unknown>,
      workflowId,
      requestMetadata: {
        userId: userId || null,
        identifier: clientId.identifier,
        identifierType: clientId.type,
        workflowId: workflowId,
      },
    };

    // Streaming mode: return NDJSON stream with live node progress
    if (useStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (obj: object) => {
            try {
              controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
            } catch (e) {
              console.error("[Flow Stream] Failed to write:", e);
            }
          };
          try {
            result = await runFlow(flowPayload, {
              onProgress: (event) => write(event),
              runMode: isBuilderTest ? "dev" : "marketplace",
            });
            const duration = Date.now() - startTime;
            const finalStatus =
              result.workflowStatus === "completed" || result.workflowStatus === "completed_with_skips"
                ? "completed"
                : "failed";
            let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;

            if (runId && isTrackedUser) {
              const countResult = await completeWorkflowRunAndGetCount({
                runId,
                status: finalStatus,
                durationMs: duration,
                stateSnapshot: {
                  nodeStatus: result.nodeStatus,
                  outputsByNode: redactSecrets(result.outputsByNode),
                },
              });
              if (countResult) {
                const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
                updatedFreeRunsRemaining = Math.max(0, freeRunLimit - countResult.newCount);
              } else {
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
                  const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
                  const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
                  updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
                } catch (e) {
                  console.error("[Flow Stream] Run update failed:", (e as Error)?.message);
                }
              }
            } else if (runId) {
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
              } catch {
                // ignore
              }
            }
            if (result.nodeTraces?.length && runId) {
              try {
                await insertWorkflowRunNodes(
                  runId,
                  result.nodeTraces.map((t) => ({
                    nodeId: t.nodeId,
                    specId: t.specId,
                    status: t.status,
                    startMs: t.startMs,
                    endMs: t.endMs,
                    error: t.error,
                    retries: t.retries,
                    tokens: t.tokens,
                    model: t.model,
                  }))
                );
              } catch {
                // ignore
              }
            }
            await finishUnifiedRun(unifiedRunId, finalStatus === "completed" ? "success" : "error", duration, undefined, result.nodeTraces);
            const safeResult = {
              ...result,
              outputsByNode: redactSecrets(result.outputsByNode) as Record<string, unknown>,
              finalOutputs: result.finalOutputs.map((fo) => ({
                nodeId: fo.nodeId,
                value: redactSecrets(fo.value),
              })),
            };
            write({ type: "complete", ok: true, result: safeResult, freeRunsRemaining: updatedFreeRunsRemaining, runId });
          } catch (err: any) {
            const duration = Date.now() - startTime;
            let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;
            if (runId && isTrackedUser) {
              const countResult = await completeWorkflowRunAndGetCount({
                runId,
                status: "failed",
                durationMs: duration,
                errorDetails: redactSecrets({ message: err?.message, stack: err?.stack }),
              });
              if (countResult) {
                const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
                updatedFreeRunsRemaining = Math.max(0, freeRunLimit - countResult.newCount);
              } else {
                try {
                  await updateWorkflowRun(runId, {
                    status: "failed",
                    completed_at: new Date().toISOString(),
                    duration_ms: duration,
                    error_details: redactSecrets({ message: err?.message, stack: err?.stack }),
                  });
                  const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
                  const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
                  updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
                } catch {
                  // ignore
                }
              }
            } else if (runId) {
              try {
                await updateWorkflowRun(runId, {
                  status: "failed",
                  completed_at: new Date().toISOString(),
                  duration_ms: duration,
                  error_details: redactSecrets({ message: err?.message, stack: err?.stack }),
                });
              } catch {
                // ignore
              }
            }
            await finishUnifiedRun(unifiedRunId, "error", duration, err?.message);
            write({ type: "complete", ok: false, error: err?.message || "Unknown error", freeRunsRemaining: updatedFreeRunsRemaining, runId });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming: execute and return JSON
    try {
      result = await runFlow(flowPayload, {
        runMode: isBuilderTest ? "dev" : "marketplace",
      });

      const duration = Date.now() - startTime;

      // Update run record on completion - ALWAYS update to track usage
      let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;
      const finalStatus =
        result.workflowStatus === "completed" || result.workflowStatus === "completed_with_skips"
          ? "completed"
          : "failed";

      // CRITICAL: Atomic completion (update + get count in one DB round-trip)
      let updateSuccess = false;
      if (runId && isTrackedUser) {
        const countResult = await completeWorkflowRunAndGetCount({
          runId,
          status: finalStatus,
          durationMs: duration,
          stateSnapshot: {
            nodeStatus: result.nodeStatus,
            outputsByNode: redactSecrets(result.outputsByNode),
          },
        });
        if (countResult) {
          updateSuccess = true;
          const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
          updatedFreeRunsRemaining = Math.max(0, freeRunLimit - countResult.newCount);
          console.warn(`[Run Tracking] Atomic complete: run ${runId} → ${finalStatus}, count=${countResult.newCount}/${freeRunLimit}`);
        }
      }
      if (!updateSuccess && runId) {
        // Fallback: RPC not available, use update + count
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
            break;
          } catch (updateErr: any) {
            console.error(`[Run Tracking] Fallback update attempt ${attempt} failed:`, updateErr?.message);
            if (attempt < 3) await new Promise((r) => setTimeout(r, 100 * attempt));
          }
        }
        if (updateSuccess && isTrackedUser) {
          const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
          const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
          updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
        }
      }
      if (result.nodeTraces?.length && runId) {
        try {
          await insertWorkflowRunNodes(
            runId,
            result.nodeTraces.map((t) => ({
              nodeId: t.nodeId,
              specId: t.specId,
              status: t.status,
              startMs: t.startMs,
              endMs: t.endMs,
              error: t.error,
              retries: t.retries,
              tokens: t.tokens,
              model: t.model,
            }))
          );
        } catch (e) {
          console.warn("[Run Tracking] insertWorkflowRunNodes failed:", e);
        }
      }
      if (!runId) {
        console.warn(`[Run Tracking] No runId - run was not tracked. User: ${userId}, Workflow: ${workflowId}`);
      }
      await finishUnifiedRun(unifiedRunId, finalStatus === "completed" ? "success" : "error", duration, undefined, result.nodeTraces);

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

      // Atomic completion for failed runs
      let updatedFreeRunsRemaining = enforcement.freeRunsRemaining;
      let updateSuccess = false;
      if (runId && isTrackedUser) {
        const countResult = await completeWorkflowRunAndGetCount({
          runId,
          status: "failed",
          durationMs: duration,
          errorDetails: redactSecrets({ message: errorMessage, stack: err?.stack }),
        });
        if (countResult) {
          updateSuccess = true;
          const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
          updatedFreeRunsRemaining = Math.max(0, freeRunLimit - countResult.newCount);
          console.warn(`[Run Tracking] Atomic complete (error): run ${runId} → failed, count=${countResult.newCount}/${freeRunLimit}`);
        }
      }
      if (!updateSuccess && runId) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await updateWorkflowRun(runId, {
              status: "failed",
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              error_details: redactSecrets({ message: errorMessage, stack: err?.stack }),
            });
            updateSuccess = true;
            if (isTrackedUser) {
              const updatedRunCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
              const freeRunLimit = isBuilderTest ? FREE_BUILDER_RUNS : 5;
              updatedFreeRunsRemaining = Math.max(0, freeRunLimit - updatedRunCount);
            }
            break;
          } catch (updateErr: any) {
            console.error(`[Run Tracking] Fallback update (error) attempt ${attempt} failed:`, updateErr?.message);
            if (attempt < 3) await new Promise((r) => setTimeout(r, 100 * attempt));
          }
        }
      }
      if (!runId) {
        console.warn(`[Run Tracking] No runId on error - run was not tracked. User: ${userId}, Workflow: ${workflowId}`);
      }
      await finishUnifiedRun(unifiedRunId, "error", duration, errorMessage);

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
