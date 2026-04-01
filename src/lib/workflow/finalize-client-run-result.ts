import { extractWorkflowOutputs } from "./input-extraction";
import { canonicalSpecId } from "./spec-id-aliases";
import type { WorkflowRunLogLine, WorkflowRunStep } from "./run-types";

function humanReadableStep(specId: string, nodeTitle?: string): string {
  const title = nodeTitle || specId;
  const key = canonicalSpecId(specId);
  const map: Record<string, string> = {
    input: "Collecting input data",
    "llm-chat": "Processing with AI",
    "llm-embeddings": "Generating embeddings",
    "llm-image": "Creating image",
    "openai-chat": "Processing with AI",
    "openai-embeddings": "Generating embeddings",
    "openai-image": "Creating image",
    "http-request": "Fetching data",
    merge: "Combining data",
    transform: "Transforming data",
    output: "Preparing output",
  };
  return map[key] ?? map[specId] ?? `Executing ${title}`;
}

export function mapExecutionNodeStatusToStepStatus(status: string): WorkflowRunStep["status"] {
  const m: Record<string, WorkflowRunStep["status"]> = {
    idle: "queued",
    ready: "queued",
    running: "running",
    success: "done",
    failed: "error",
    timeout: "error",
    skipped: "skipped",
  };
  return m[status] ?? "queued";
}

export type FinalizeRunGraphNode = {
  id: string;
  data?: {
    specId?: string;
    title?: string;
    config?: { name?: string; label?: string };
  };
};

/**
 * Maps `/api/flow/run` execution payloads into customer/builder run modal state.
 * Matches builder `handleSubmitInputs` completion semantics (echo filtering, partial errors, outputsByNode).
 */
export function finalizeClientWorkflowRunFromExecutionResult(params: {
  executionResult: any;
  graphNodes: FinalizeRunGraphNode[];
  processedInputs: Record<string, unknown>;
}): {
  steps: WorkflowRunStep[];
  logs: WorkflowRunLogLine[];
  outputs?: Array<{ nodeId: string; label: string; value: unknown; type?: string }>;
  outputsByNode: Record<string, unknown>;
  phase: "output";
  status: "success" | "error";
  error?: string;
  summary?: string;
  finishedAt: number;
} {
  const { executionResult, graphNodes, processedInputs } = params;

  const logs: WorkflowRunLogLine[] = (executionResult.logs || []).map((log: any) => ({
    t: log.timestamp || Date.now(),
    level: log.type === "error" ? "error" : log.type === "warn" ? "warn" : "info",
    text: log.message || log.text || "",
    nodeId: log.nodeId,
    specId: log.specId,
  }));

  const steps: WorkflowRunStep[] = Object.entries(executionResult.nodeStatus || {}).map(
    ([nodeId, rawStatus]) => {
      const node = graphNodes.find((n) => n.id === nodeId);
      const specId = node?.data?.specId || "default";
      const nodeTitle = node?.data?.title || node?.data?.config?.name || humanReadableStep(specId);
      const errorLog = logs.find((l) => l.nodeId === nodeId && l.level === "error");
      return {
        id: nodeId,
        title: nodeTitle,
        detail: errorLog ? errorLog.text : undefined,
        status: mapExecutionNodeStatusToStepStatus(String(rawStatus)),
        timestamp: Date.now(),
      };
    },
  );

  const displayInputValues = Object.fromEntries(
    Object.entries(processedInputs).filter(
      ([k]) =>
        !k.startsWith("__") &&
        k !== "__openaiApiKey" &&
        k !== "__anthropicApiKey" &&
        k !== "__geminiApiKey" &&
        k !== "__builder_test" &&
        k !== "__builder_user_key" &&
        k !== "__workflow_id",
    ),
  );
  const echoParts = Object.values(displayInputValues)
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  const echoPartSet = new Set(echoParts);
  const normalizeLines = (s: string) =>
    s
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .sort()
      .join("\n");
  const isEchoString = (s: string) => {
    const t = String(s).trim();
    if (!t.length) return false;
    if (echoPartSet.has(t)) return true;
    const norm = normalizeLines(t);
    const expectedNorm = echoParts.slice().sort().join("\n");
    return norm === expectedNorm;
  };

  const outputs = extractWorkflowOutputs(graphNodes as any[])
    .map((output) => {
      const finalOutput = executionResult.finalOutputs?.find(
        (fo: any) => fo.nodeId === output.nodeId,
      );
      if (!finalOutput) return null;
      let value = finalOutput.value;
      if (typeof value === "string" && isEchoString(value)) return null;
      if (value !== null && typeof value === "object" && Array.isArray((value as any).results)) {
        const results = ((value as any).results as unknown[]).filter(
          (item) => typeof item !== "string" || !isEchoString(item),
        );
        if (results.length === 0) return null;
        value = results.length === 1 ? results[0] : { ...(value as object), results };
      }
      return {
        ...output,
        value,
        type: typeof value === "string" ? "string" : "json",
      };
    })
    .filter((o): o is NonNullable<typeof o> => o != null);

  const hasError =
    executionResult.workflowStatus === "failed" ||
    logs.some((l) => l.level === "error") ||
    Object.values(executionResult.nodeStatus || {}).some(
      (s: any) => s === "failed" || s === "timeout",
    );

  const errorMessage = hasError
    ? logs.find((l) => l.level === "error")?.text ||
      Object.entries(executionResult.nodeStatus || {})
        .filter(([_, st]) => st === "failed" || st === "timeout")
        .map(([nid]) => {
          const node = graphNodes.find((n) => n.id === nid);
          return node?.data?.title || nid;
        })
        .join(", ") + " failed"
    : undefined;

  const outputsByNode = (executionResult.outputsByNode || {}) as Record<string, unknown>;

  return {
    steps,
    logs,
    outputs: hasError ? undefined : outputs,
    outputsByNode,
    phase: "output",
    status: hasError ? "error" : "success",
    error: errorMessage,
    summary: hasError ? undefined : "Workflow executed successfully",
    finishedAt: Date.now(),
  };
}
