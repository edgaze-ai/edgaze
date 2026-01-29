// src/lib/workflow/execution-manager.ts
/**
 * Manages workflow execution with real-time updates
 */

import type {
  WorkflowRunState,
  WorkflowRunStep,
  WorkflowRunLogLine,
  RunPhase,
} from "../../components/builder/PremiumWorkflowRunModal";
import type { GraphNode, GraphEdge } from "../../server/flow/types";
import { extractWorkflowInputs, extractWorkflowOutputs } from "./input-extraction";

// Icon mapping is handled in the component

function humanReadableStep(specId: string, nodeTitle?: string): string {
  const title = nodeTitle || specId;
  const map: Record<string, string> = {
    input: "Collecting input data",
    "openai-chat": "Processing with AI",
    "openai-embeddings": "Generating embeddings",
    "openai-image": "Creating image",
    "http-request": "Fetching data",
    merge: "Combining data",
    transform: "Transforming data",
    output: "Preparing output",
  };
  return map[specId] || `Executing ${title}`;
}

export type ExecutionUpdate = {
  phase?: RunPhase;
  status?: WorkflowRunState["status"];
  steps?: WorkflowRunStep[];
  currentStepId?: string | null;
  logs?: WorkflowRunLogLine[];
  summary?: string;
  outputs?: Array<{ nodeId: string; label: string; value: any; type?: string }>;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
};

export class WorkflowExecutionManager {
  private state: WorkflowRunState;
  private updateCallback?: (state: WorkflowRunState) => void;
  private abortController?: AbortController;

  constructor(
    workflowId: string,
    workflowName: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    onUpdate?: (state: WorkflowRunState) => void
  ) {
    const inputs = extractWorkflowInputs(nodes);
    const outputs = extractWorkflowOutputs(nodes);

    this.state = {
      workflowId,
      workflowName,
      phase: inputs.length > 0 ? "input" : "executing",
      status: "idle",
      steps: [],
      logs: [],
      inputs: inputs.length > 0 ? inputs : undefined,
      outputs: outputs.map((o) => ({ ...o, value: null, type: "any" })),
    };

    this.updateCallback = onUpdate;
  }

  getState(): WorkflowRunState {
    return { ...this.state };
  }

  update(updates: ExecutionUpdate) {
    this.state = {
      ...this.state,
      ...updates,
      steps: updates.steps || this.state.steps,
      logs: updates.logs || this.state.logs,
    };
    this.updateCallback?.(this.state);
  }

  async execute(inputs?: Record<string, any>): Promise<void> {
    if (this.state.phase === "input" && inputs) {
      this.state.inputValues = inputs;
    }

    this.abortController = new AbortController();
    this.update({ phase: "executing", status: "running", startedAt: Date.now() });

    try {
      // Initialize steps from nodes
      const steps = this.initializeSteps();
      this.update({ steps });

      // Start execution
      const result = await this.runWorkflow(inputs || {}, this.abortController.signal);

      // Process results
      this.processResults(result);
    } catch (error: any) {
      if (error.name === "AbortError") {
        this.update({ status: "error", error: "Execution cancelled", finishedAt: Date.now() });
      } else {
        this.update({
          status: "error",
          error: error.message || "Execution failed",
          finishedAt: Date.now(),
        });
      }
    }
  }

  cancel() {
    this.abortController?.abort();
    this.update({ status: "error", error: "Cancelled by user", finishedAt: Date.now() });
  }

  private initializeSteps(): WorkflowRunStep[] {
    // This would be populated from the actual workflow graph
    // For now, return empty - will be populated during execution
    return [];
  }

  private async runWorkflow(
    inputs: Record<string, any>,
    signal: AbortSignal
  ): Promise<any> {
    // This will call the actual API endpoint
    const workflowId = this.state.workflowId;
    
    // Get the graph from somewhere (would need to be passed in)
    // For now, we'll make a placeholder call
    
    const response = await fetch("/api/flow/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId,
        inputs,
      }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private processResults(result: any) {
    const outputs = this.state.outputs || [];
    
    // Map results to outputs
    if (result.result?.finalOutputs) {
      for (const finalOutput of result.result.finalOutputs) {
        const output = outputs.find((o) => o.nodeId === finalOutput.nodeId);
        if (output) {
          output.value = finalOutput.value;
        }
      }
    }

    // Convert logs
    const logs: WorkflowRunLogLine[] = (result.result?.logs || []).map((log: any) => ({
      t: log.timestamp || Date.now(),
      level: log.type === "error" ? "error" : log.type === "warn" ? "warn" : "info",
      text: log.message || "",
      nodeId: log.nodeId,
      specId: log.specId,
    }));

    // Convert steps from node status
    const steps: WorkflowRunStep[] = [];
    if (result.result?.nodeStatus) {
      for (const [nodeId, status] of Object.entries(result.result.nodeStatus)) {
        // Would need node metadata to get specId and title
        steps.push({
          id: nodeId,
          title: humanReadableStep("default", nodeId),
          status: this.mapNodeStatus(status as string),
          // Icon is handled by the component, not needed here
        });
      }
    }

    this.update({
      phase: "output",
      status: result.result?.workflowStatus === "completed" ? "success" : "error",
      steps,
      logs,
      outputs,
      finishedAt: Date.now(),
    });
  }

  private mapNodeStatus(status: string): WorkflowRunStep["status"] {
    const map: Record<string, WorkflowRunStep["status"]> = {
      idle: "queued",
      ready: "queued",
      running: "running",
      success: "done",
      failed: "error",
      timeout: "error",
      skipped: "skipped",
    };
    return map[status] || "queued";
  }
}
