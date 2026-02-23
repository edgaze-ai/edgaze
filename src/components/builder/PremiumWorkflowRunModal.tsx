"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sparkles,
  Play,
  ArrowRight,
  Zap,
  Code,
  FileText,
  Image as ImageIcon,
  Database,
  Globe,
  Send,
  Download,
  Copy,
  Check,
  Rocket,
  ShoppingCart,
} from "lucide-react";
import { cx } from "../../lib/cx";
import { track } from "../../lib/mixpanel";
import { WorkflowInputField } from "./WorkflowInputField";
import RunCountDiagnosticModal from "./RunCountDiagnosticModal";

function safeTrack(event: string, props?: Record<string, any>) {
  try {
    track(event, props);
  } catch {}
}

export type RunPhase = "input" | "executing" | "output";

export type RunStepStatus = "queued" | "running" | "done" | "error" | "skipped";

export type WorkflowRunStep = {
  id: string;
  title: string;
  detail?: string;
  status: RunStepStatus;
  icon?: React.ReactNode;
  timestamp?: number;
};

export type WorkflowRunLogLine = {
  t: number;
  level: "info" | "warn" | "error";
  text: string;
  nodeId?: string;
  specId?: string;
};

export type WorkflowInput = {
  nodeId: string;
  specId: string;
  name: string;
  description?: string;
  type: "text" | "number" | "textarea" | "url" | "file" | "json";
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
};

export type WorkflowRunState = {
  workflowId: string;
  workflowName: string;
  phase: RunPhase;
  status: "idle" | "running" | "success" | "error";
  startedAt?: number;
  finishedAt?: number;
  steps: WorkflowRunStep[];
  currentStepId?: string | null;
  logs: WorkflowRunLogLine[];
  summary?: string;
  inputs?: WorkflowInput[];
  inputValues?: Record<string, any>;
  outputs?: Array<{ nodeId: string; label: string; value: any; type?: string }>;
  outputsByNode?: Record<string, unknown>;
  error?: string;
  graph?: {
    nodes: Array<{ id: string; data: { specId?: string; title?: string; config?: any } }>;
    edges: Array<{ source: string; target: string }>;
  };
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  input: <ArrowRight className="h-4 w-4" />,
  "openai-chat": <Zap className="h-4 w-4" />,
  "openai-embeddings": <Code className="h-4 w-4" />,
  "openai-image": <ImageIcon className="h-4 w-4" />,
  "http-request": <Globe className="h-4 w-4" />,
  merge: <Database className="h-4 w-4" />,
  transform: <Code className="h-4 w-4" />,
  output: <Send className="h-4 w-4" />,
  default: <Sparkles className="h-4 w-4" />,
};

function getStepIcon(specId: string): React.ReactNode {
  return STEP_ICONS[specId] || STEP_ICONS.default;
}

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

/** Human-friendly message for workflow/OpenAI errors. Used for all user-facing error text. */
function simplifyError(error: string): string {
  const e = error.trim();
  // Image / limit verification – keep full message so user knows the cause
  if (
    e.includes("Image limit check") ||
    e.includes("image generation limits") ||
    e.includes("Unable to verify image generation")
  ) {
    return e;
  }
  // OpenAI / API key
  if (/invalid.*api.*key|incorrect API key|401|authentication/i.test(e)) {
    return "The API key is invalid or expired. Check your key in the run modal or in the node settings.";
  }
  if (e.includes("API key required") || e.includes("API key is required")) {
    return "An API key is needed to run this workflow. Please add your API key in the run modal.";
  }
  // Rate limits
  if (/rate limit|429|too many requests/i.test(e)) {
    return "Too many requests right now. Wait a moment and try again.";
  }
  // Context / token limits
  if (
    /token limit|context length|maximum context length|context_length_exceeded/i.test(e)
  ) {
    return "The input or output is too long for this step. Try shorter text or fewer items.";
  }
  if (e.includes("Token limit exceeded")) {
    return "The workflow uses too many tokens. Try reducing the size of your inputs or prompts.";
  }
  // Content / safety
  if (/content filter|content_policy|safety/i.test(e)) {
    return "The content was blocked by safety filters. Try rephrasing or using different input.";
  }
  // Model / request
  if (/invalid_request|invalid request|model.*not found|404/i.test(e)) {
    return "The request to the AI service was invalid. Check that the model name and settings are correct.";
  }
  if (e.includes("Prompt or messages array required")) {
    return "The AI chat node needs a prompt or message. Connect an input node and make sure it has a value.";
  }
  // Server / timeout
  if (/timeout|timed out|ETIMEDOUT/i.test(e)) {
    return "The request took too long. Try again or simplify the workflow.";
  }
  if (/500|server error|internal error/i.test(e)) {
    return "The AI service had a temporary problem. Try again in a moment.";
  }
  // Workflow / nodes
  if (e.includes("Invalid node transition")) {
    return "A step in the workflow failed unexpectedly. Check that all required inputs are connected.";
  }
  if (e.includes("free runs") || e.includes("5 free runs")) {
    return "You've used all your free demo runs. Add your API key or purchase to continue.";
  }
  // Fallback: first sentence, no "Error:" prefix, cap length
  const cleaned = e.replace(/^Error:\s*/i, "").trim();
  const first = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  return first.length > 140 ? first.slice(0, 137) + "…" : first;
}

/** Human-friendly title: remove tech, trim, limit. Fallback "Next step". */
function humanizeTitle(title?: string): string {
  if (!title || typeof title !== "string") return "Next step";
  const t = title
    .replace(/\s*\[.*?\]\s*/g, "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim();
  if (!t) return "Next step";
  return t.length > 40 ? t.slice(0, 37) + "…" : t;
}

/** Friendly verb from title (e.g. "Summarize" -> "Summarizing"). */
function toVerb(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("summariz")) return "Summarizing";
  if (lower.includes("generat")) return "Generating";
  if (lower.includes("extract")) return "Extracting";
  if (lower.includes("creat")) return "Creating";
  if (lower.includes("process")) return "Processing";
  if (lower.includes("transform")) return "Transforming";
  if (lower.includes("merge")) return "Combining";
  if (lower.includes("fetch")) return "Fetching";
  return "Working on";
}

/** User-facing error text: human-friendly, no technical jargon. */
function sanitizeErrorForDisplay(error?: string): string {
  if (!error || typeof error !== "string") return "Try again in a moment.";
  return simplifyError(error);
}

function getFailedNodeIds(state: WorkflowRunState | null): Set<string> {
  if (!state) return new Set();
  const failed = new Set<string>();
  state.steps?.forEach(step => {
    if (step.status === "error") {
      failed.add(step.id);
    }
  });
  // Also check logs for error nodeIds
  state.logs?.forEach(log => {
    if (log.level === "error" && log.nodeId) {
      failed.add(log.nodeId);
    }
  });
  return failed;
}

function isImageUrl(s: string): boolean {
  if (typeof s !== "string" || !s.trim()) return false;
  const t = s.trim();

  // Data URLs
  if (t.startsWith("data:image/")) return true;

  // Check for common image file extensions
  if (/^https?:\/\//i.test(t)) {
    // Check for image extensions
    if (/\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?|$)/i.test(t)) return true;

    // Check for DALL-E blob URLs (oaidalleapiprodscus.blob.core.windows.net)
    if (/oaidalleapiprodscus\.blob\.core\.windows\.net/i.test(t)) return true;

    // Check for other common image hosting patterns
    if (/imgur\.com|unsplash\.com|pexels\.com|pixabay\.com/i.test(t)) return true;

    // Check if URL contains image-related paths
    if (/\/images?\/|\/img\/|image|photo|picture/i.test(t)) return true;
  }

  return false;
}

// ============== CINEMATIC RUN VIEW ==============

type CinematicPhase = "preparing" | "live";

function CinematicRunView({
  state,
  isStopping,
}: {
  state: WorkflowRunState;
  isStopping: boolean;
}) {
  const [viewPhase, setViewPhase] = useState<CinematicPhase>("preparing");
  const [prepDots, setPrepDots] = useState(0);
  const [showTakingLong, setShowTakingLong] = useState(false);

  const steps = state.steps || [];

  const { displayStep, isFinalizing } = useMemo(() => {
    const running = steps.find((s) => s.status === "running");
    const done = steps.filter((s) => s.status === "done");
    const allDone = steps.length > 0 && done.length === steps.length;
    return {
      displayStep: running ?? (allDone ? null : steps.find((s) => s.status === "queued") ?? null),
      isFinalizing: allDone,
    };
  }, [steps]);

  const humanTitle = useMemo(() => humanizeTitle(displayStep?.title), [displayStep?.title]);
  const displayStepTitle = displayStep?.title;
  const verbLine = useMemo(() => {
    if (isFinalizing) return "Finalizing…";
    if (!displayStepTitle) return "Creating your result…";
    const verb = toVerb(displayStepTitle);
    return `${verb} ${humanizeTitle(displayStepTitle).toLowerCase()}…`;
  }, [displayStepTitle, isFinalizing]);

  useEffect(() => {
    if (viewPhase === "live") return;
    const hasActive = steps.some((s) => s.status === "running");
    const timer = setTimeout(() => setViewPhase("live"), hasActive ? 0 : 1200);
    return () => clearTimeout(timer);
  }, [viewPhase, steps]);

  useEffect(() => {
    if (viewPhase !== "preparing") return;
    const t1 = setTimeout(() => setPrepDots(1), 400);
    const t2 = setTimeout(() => setPrepDots(2), 800);
    const t3 = setTimeout(() => setPrepDots(3), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [viewPhase]);

  useEffect(() => {
    if (!state.startedAt || state.status !== "running" || isStopping) {
      queueMicrotask(() => setShowTakingLong(false));
      return;
    }
    const id = setTimeout(() => setShowTakingLong(true), 5000);
    return () => clearTimeout(id);
  }, [state.startedAt, state.status, isStopping]);

  if (viewPhase === "preparing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] px-6">
        <div className="relative mb-14">
          <div
            className="absolute inset-0 rounded-full opacity-50 blur-2xl cinematic-orb"
            style={{
              background: "radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(99,102,241,0.1) 50%, transparent 70%)",
            }}
          />
          <div className="relative w-14 h-14 rounded-full border-2 border-white/10 border-t-white/30 cinematic-spinner" />
        </div>
        <div className="text-xl font-medium text-white/95 mb-3">Getting things ready…</div>
        <div className="text-sm text-white/50 mb-14">Warming up your workflow</div>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cx(
                "w-1.5 h-1.5 rounded-full transition-all duration-500",
                i < prepDots ? "bg-white/60 scale-100" : "bg-white/20 scale-90"
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col items-center px-6 py-12 max-w-xl mx-auto", isStopping && "cinematic-reduce-motion")}>
      <div className="text-center mb-14">
        {!isStopping && (
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full opacity-40 blur-xl"
                style={{
                  background: "radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(99,102,241,0.15) 50%, transparent 70%)",
                }}
              />
              <div className="relative w-10 h-10 rounded-full border-2 border-white/10 border-t-white/40 cinematic-spinner" />
            </div>
          </div>
        )}
        <div className="text-2xl font-medium text-white/95 mb-3 transition-opacity duration-300">
          {isStopping ? "Stopping…" : verbLine}
        </div>
        <div className="text-sm text-white/50 leading-relaxed">
          {isStopping ? "We'll stop after the current step." : isFinalizing ? "Almost there…" : `Now working on: ${humanTitle}`}
        </div>
      </div>

      <div className="w-full mb-14">
        {isFinalizing ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 cinematic-float-in text-center">
            <div className="text-lg font-medium text-white/90 mb-3">Finalizing</div>
            <div className="h-0.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-1/3 rounded-full cinematic-shimmer bg-white/30" />
            </div>
          </div>
        ) : displayStep ? (
          <div
            className={cx(
              "rounded-2xl border border-white/10 bg-white/[0.04] p-7 cinematic-float-in",
              isStopping && "opacity-70"
            )}
          >
            <div className="text-lg font-medium text-white/90 mb-3">{humanizeTitle(displayStep.title)}</div>
            <div className="text-sm text-white/50 mb-5">
              {displayStep.status === "running" && !isStopping ? "In progress" : "Starting…"}
            </div>
            {displayStep.status === "running" && !isStopping && (
              <div className="h-0.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-1/3 rounded-full cinematic-shimmer bg-white/30" />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {showTakingLong && (
        <div className="mt-12 text-xs text-white/40">This usually takes a few seconds.</div>
      )}
    </div>
  );
}

/** Extract displayable content from any OpenAI-style response. Supports string, array (multimodal), tool_calls. */
function extractOpenAIDisplayContent(value: unknown): { kind: "string"; text: string } | { kind: "parts"; parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> } | null {
  if (value === null || value === undefined) return null;
  const v = value as Record<string, unknown>;

  // choices[0].message.content (string or array of parts)
  if (Array.isArray(v?.choices) && v.choices[0] && typeof (v.choices[0] as any)?.message === "object") {
    const msg = (v.choices[0] as any).message;
    const content = msg?.content;
    if (typeof content === "string" && content.trim()) return { kind: "string", text: content };
    if (Array.isArray(content)) {
      const parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [];
      for (const part of content) {
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          if (p.type === "text" && typeof p.text === "string") parts.push({ type: "text", text: p.text });
          if (p.type === "image_url" && p.image_url && typeof (p.image_url as any)?.url === "string") parts.push({ type: "image", url: (p.image_url as any).url });
        }
      }
      if (parts.length) return { kind: "parts", parts };
    }
  }

  // Top-level .content (string or array)
  const content = v?.content;
  if (typeof content === "string" && content.trim()) return { kind: "string", text: content };
  if (Array.isArray(content)) {
    const parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [];
    for (const part of content) {
      if (part && typeof part === "object") {
        const p = part as Record<string, unknown>;
        if (p.type === "text" && typeof p.text === "string") parts.push({ type: "text", text: p.text });
        if (p.type === "image_url" && p.image_url && typeof (p.image_url as any)?.url === "string") parts.push({ type: "image", url: (p.image_url as any).url });
      }
    }
    if (parts.length) return { kind: "parts", parts };
  }

  // .message.content
  const msg = v?.message;
  if (msg && typeof msg === "object") {
    const mc = (msg as Record<string, unknown>).content;
    if (typeof mc === "string" && (mc as string).trim()) return { kind: "string", text: mc as string };
    if (Array.isArray(mc)) {
      const parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [];
      for (const part of mc) {
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          if (p.type === "text" && typeof p.text === "string") parts.push({ type: "text", text: p.text });
          if (p.type === "image_url" && p.image_url && typeof (p.image_url as any)?.url === "string") parts.push({ type: "image", url: (p.image_url as any).url });
        }
      }
      if (parts.length) return { kind: "parts", parts };
    }
  }

  // tool_calls: show a short summary instead of raw object
  const choices0 = (v as any).choices?.[0];
  if (Array.isArray((v as any).tool_calls) && (v as any).tool_calls.length > 0) {
    const count = (v as any).tool_calls.length;
    return { kind: "string", text: `Tool calls (${count}): use the raw output or logs for details.` };
  }
  if (choices0 && Array.isArray(choices0?.message?.tool_calls) && choices0.message.tool_calls.length > 0) {
    const count = choices0.message.tool_calls.length;
    return { kind: "string", text: `Tool calls (${count}): use the raw output or logs for details.` };
  }

  return null;
}

function PremiumStepView({
  state,
  onCopyOutput,
  copiedOutput,
  isExecuting = false
}: {
  state: WorkflowRunState;
  onCopyOutput: (value: any, index: number) => void;
  copiedOutput: string | null;
  isExecuting?: boolean;
}) {
  if (!state.graph || !state.steps) return null;

  // Get execution order from graph edges (topological sort)
  const nodeOrder: string[] = [];
  const visited = new Set<string>();
  const nodeMap = new Map(state.graph.nodes.map(n => [n.id, n]));
  const edgesBySource = new Map<string, string[]>();

  state.graph.edges.forEach(e => {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, []);
    edgesBySource.get(e.source)!.push(e.target);
  });

  // Find input nodes (no incoming edges or specId === "input")
  const hasIncoming = new Set(state.graph.edges.map(e => e.target));
  const inputNodes = state.graph.nodes.filter(n => {
    const specId = n.data?.specId;
    return !hasIncoming.has(n.id) || specId === "input";
  });
  const inputNodeIds = new Set(inputNodes.map(n => n.id));

  // Start DFS from input nodes
  const dfs = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    // Only add non-input nodes to the order
    if (!inputNodeIds.has(nodeId)) {
      nodeOrder.push(nodeId);
    }
    const targets = edgesBySource.get(nodeId) || [];
    targets.forEach(dfs);
  };

  inputNodes.forEach(n => dfs(n.id));
  // Add any remaining nodes (that aren't inputs)
  state.graph.nodes.forEach(n => {
    if (!visited.has(n.id) && !inputNodeIds.has(n.id)) {
      nodeOrder.push(n.id);
    }
  });

  const getNodeSpecId = (nodeId: string) => {
    return nodeMap.get(nodeId)?.data?.specId || "default";
  };

  const getNodeTitle = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    const specId = getNodeSpecId(nodeId);
    if (specId === "merge") return "Merge Node";
    return node?.data?.title || humanReadableStep(specId);
  };

  const getNodeOutput = (nodeId: string) => {
    const raw = state.outputsByNode?.[nodeId];
    if (raw === undefined || raw === null) return raw;
    // Never show raw input passthrough (e.g. Merge output "Arjun\n\n18") in step cards
    const displayEntries = state.inputValues
      ? Object.entries(state.inputValues).filter(
          ([k]) =>
            !k.startsWith("__") &&
            k !== "__openaiApiKey" &&
            k !== "__builder_test" &&
            k !== "__builder_user_key" &&
            k !== "__workflow_id"
        )
      : [];
    const echoParts = displayEntries.map(([, v]) => String(v ?? "").trim()).filter(Boolean);
    const inputValsNorm = echoParts.slice().sort().join("\n");
    const echoPartSet = new Set(echoParts);
    if (!inputValsNorm) return raw;
    const norm = (s: string) =>
      s
        .trim()
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .sort()
        .join("\n");
    const isEcho = (s: string) => echoPartSet.has(s.trim()) || norm(s) === inputValsNorm;
    if (typeof raw === "string" && isEcho(raw)) return undefined;
    if (
      typeof raw === "object" &&
      raw !== null &&
      Array.isArray((raw as any).results)
    ) {
      const filtered = ((raw as any).results as unknown[]).filter(
        (item) => typeof item !== "string" || !isEcho(item)
      );
      if (filtered.length === 0) return undefined;
      return filtered.length === 1 ? filtered[0] : { ...(raw as object), results: filtered };
    }
    return raw;
  };

  const isOpenAIChat = (specId: string) => {
    return specId === "openai-chat";
  };

  const getNodeIcon = (specId: string) => {
    if (specId === "openai-chat") {
      return (
        <img
          src="/misc/chatgpt.png"
          alt="ChatGPT"
          className="h-6 w-6 object-contain"
        />
      );
    }
    return getStepIcon(specId);
  };

  // Determine which steps should be visible (one by one as they execute)
  // Inputs are shown in a separate section - do not show as an execution step
  const visibleSteps: string[] = [];

  // Show steps as they become active or complete - one by one
  nodeOrder.forEach((nodeId, stepIndex) => {
    const step = state.steps.find(s => s.id === nodeId);
    const status = step?.status || (isExecuting ? "queued" : "done");

    // Show step if:
    // 1. It's running (currently executing) - show immediately
    // 2. It's done (completed) - show immediately
    // 3. Previous step is done - show next one in sequence (only during execution)
    const prevStepId = stepIndex > 0 ? nodeOrder[stepIndex - 1] : null;
    const prevStep = prevStepId ? state.steps.find(s => s.id === prevStepId) : null;
    const prevStepDone = prevStep?.status === "done";

    if (status === "running" || status === "done") {
      // Always show running or done steps
      visibleSteps.push(nodeId);
    } else if (isExecuting && stepIndex === 0 && status === "queued") {
      // Show first step when execution starts
      visibleSteps.push(nodeId);
    } else if (isExecuting && prevStepDone && status === "queued") {
      // Show next step when previous is done (only show one upcoming step)
      visibleSteps.push(nodeId);
    }
  });

  return (
    <div className="space-y-8">
      {/* Each Node Step - Show one by one (inputs shown in separate section) */}
      {nodeOrder.map((nodeId, idx) => {
        if (!visibleSteps.includes(nodeId)) return null;

        const specId = getNodeSpecId(nodeId);
        const step = state.steps.find(s => s.id === nodeId);
        const output = getNodeOutput(nodeId);
        const status = step?.status || (isExecuting ? "queued" : "done");

        // During execution, show all visible steps. After completion, skip errors and only show completed ones
        if (!isExecuting && status === "error") return null;
        if (!isExecuting && output === undefined) return null;

        // Calculate animation delay based on position
        const stepPosition = visibleSteps.indexOf(nodeId);
        const animationDelay = stepPosition * 200; // 200ms delay between each step

        return (
          <div
            key={nodeId}
            className="step-fade-in"
            style={{ animationDelay: `${animationDelay}ms` }}
          >
            <StepBox
              title={getNodeTitle(nodeId)}
              icon={getNodeIcon(specId)}
              output={isExecuting ? output : output} // Show output during execution if available
              isOpenAI={isOpenAIChat(specId)}
              status={status}
              onCopy={output !== undefined && !isExecuting ? () => onCopyOutput(output, idx) : undefined}
              copied={copiedOutput === `output-${idx}`}
            />
          </div>
        );
      })}

      {/* Loading indicator if we're executing and waiting for more steps */}
      {isExecuting && visibleSteps.length < nodeOrder.length && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      )}
    </div>
  );
}

function StepBox({
  title,
  icon,
  output,
  isOpenAI,
  status,
  onCopy,
  copied,
}: {
  title: string;
  icon: React.ReactNode;
  output?: unknown;
  isOpenAI: boolean;
  status: RunStepStatus;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="relative">
      {/* Glaze Animation Container */}
      <div className={cx(
        "relative rounded-xl border overflow-hidden",
        isOpenAI
          ? "bg-white border-white/20"
          : "bg-gray-800/90 border-gray-700/50"
      )}>
        {/* Subtle shimmer animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -inset-24 rotate-12 glaze-sheen"
            style={{
              backgroundImage: isOpenAI
                ? "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.08) 70%, transparent 100%)"
                : "linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.08) 30%, rgba(168,85,247,0.12) 50%, rgba(34,211,238,0.08) 70%, transparent 100%)",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={cx(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              isOpenAI ? "bg-black" : "bg-gradient-to-br from-cyan-500/30 to-purple-500/30"
            )}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={cx(
                "text-sm font-semibold truncate",
                isOpenAI ? "text-black" : "text-white"
              )}>
                {title}
              </div>
            </div>
            {status === "running" && (
              <Loader2 className={cx(
                "h-4 w-4 animate-spin shrink-0",
                isOpenAI ? "text-black/60" : "text-cyan-400"
              )} />
            )}
            {status === "done" && output !== undefined && onCopy && (
              <button
                onClick={onCopy}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all shrink-0",
                  isOpenAI
                    ? "bg-black/10 hover:bg-black/20 text-black/80"
                    : "bg-white/10 hover:bg-white/20 text-white/80"
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            )}
          </div>

          {/* Output */}
          {output !== undefined && (
            <div className={cx(
              "rounded-lg p-4 mt-5",
              isOpenAI ? "bg-black/5" : "bg-black/30"
            )}>
              <PremiumOutputDisplay value={output} isOpenAI={isOpenAI} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple markdown renderer for output display
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-2.5 my-6 ml-4">
          {listItems.map((item, i) => {
            // Process bold text in list items
            const parts = item.trim().split(/(\*\*.*?\*\*)/g);
            return (
              <li key={i} className="text-white/90 leading-[1.85]">
                {parts.map((part, j) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
                  }
                  return part;
                })}
              </li>
            );
          })}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={idx} className="text-xl font-semibold text-white mt-8 mb-4">{trimmed.substring(4)}</h3>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={idx} className="text-2xl font-semibold text-white mt-10 mb-5">{trimmed.substring(3)}</h2>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={idx} className="text-3xl font-bold text-white mt-12 mb-6">{trimmed.substring(2)}</h1>
      );
      return;
    }

    // Lists
    if (trimmed.match(/^[-*•]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      if (!inList) flushList();
      inList = true;
      const itemText = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
      listItems.push(itemText);
      return;
    }

    // Regular paragraph
    flushList();
    if (trimmed === '') {
      elements.push(<div key={idx} className="h-6" />);
      return;
    }

    // Process bold text
    const parts = trimmed.split(/(\*\*.*?\*\*)/g);
    const processedLine = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    elements.push(
      <p key={idx} className="text-base leading-[1.85] text-white/90 mb-6">
        {processedLine}
      </p>
    );
  });

  flushList();
  return <div className="markdown-content">{elements}</div>;
}

function PremiumOutputDisplay({ value, isOpenAI = false }: { value: unknown; isOpenAI?: boolean }) {
  const textColor = isOpenAI ? "text-black/90" : "text-white/90";
  const textColorMuted = isOpenAI ? "text-black/50" : "text-white/50";
  const borderColor = isOpenAI ? "border-black/10" : "border-white/10";
  const bgColor = isOpenAI ? "bg-black/5" : "bg-white/[0.02]";
  const bgColorHeader = isOpenAI ? "bg-black/10" : "bg-white/5";

  if (value === null || value === undefined) {
    return (
      <div className={cx("text-sm italic", textColorMuted)}>No value</div>
    );
  }
  if (typeof value === "string") {
    // Check if it's an image URL (including DALL-E URLs)
    if (isImageUrl(value)) {
      return (
        <div className={cx("rounded-xl overflow-hidden border", borderColor, bgColor, "relative group")}>
          <img
            src={value}
            alt="Generated image"
            className="w-full max-h-[500px] object-contain"
            onError={(e) => {
              // If image fails to load, show the URL as text (use textContent to prevent XSS)
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                const fallback = document.createElement("div");
                fallback.className = "p-4 text-sm text-white/70 break-all";
                fallback.textContent = value;
                parent.replaceChildren(fallback);
              }
            }}
          />
          {/* Download button overlay */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement("a");
                link.href = value;
                link.download = `image-${Date.now()}.png`;
                link.target = "_blank";
                link.click();
              }}
              className="rounded-lg bg-black/80 hover:bg-black/90 p-2 border border-white/20"
              title="Download image"
            >
              <Download className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      );
    }

    // Check if string contains image URLs (extract and display them)
    // Match DALL-E URLs and standard image URLs
    const urlPattern = /(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|gif|webp|avif|svg))[^\s]*|https?:\/\/[^\s]*oaidalleapiprodscus[^\s]*|https?:\/\/[^\s]*blob\.core\.windows\.net[^\s]*)/gi;
    const urlMatches: Array<{ url: string; index: number }> = [];
    let match;
    const regex = new RegExp(urlPattern);

    while ((match = regex.exec(value)) !== null) {
      urlMatches.push({ url: match[0], index: match.index });
    }

    if (urlMatches.length > 0) {
      // Extract text before/after URLs
      const parts: Array<string | { type: "image"; url: string }> = [];
      let lastIndex = 0;

      urlMatches.forEach(({ url, index }) => {
        if (index > lastIndex) {
          const textPart = value.substring(lastIndex, index);
          if (textPart.trim()) {
            parts.push(textPart);
          }
        }
        parts.push({ type: "image", url });
        lastIndex = index + url.length;
      });

      if (lastIndex < value.length) {
        const textPart = value.substring(lastIndex);
        if (textPart.trim()) {
          parts.push(textPart);
        }
      }

      return (
        <div className="space-y-4">
          {parts.map((part, i) => {
            if (typeof part === "object" && part.type === "image") {
              return (
                <div key={i} className={cx("rounded-xl overflow-hidden border", borderColor, bgColor, "relative group")}>
                  <img
                    src={part.url}
                    alt="Generated image"
                    className="w-full max-h-[500px] object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement("div");
                        fallback.className = "p-4 text-sm text-white/70 break-all";
                        fallback.textContent = part.url;
                        parent.replaceChildren(fallback);
                      }
                    }}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement("a");
                        link.href = part.url;
                        link.download = `image-${Date.now()}.png`;
                        link.target = "_blank";
                        link.click();
                      }}
                      className="rounded-lg bg-black/80 hover:bg-black/90 p-2 border border-white/20"
                      title="Download image"
                    >
                      <Download className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              );
            }
            if (typeof part === "string" && part.trim()) {
              return (
                <div key={i} className="text-base leading-7 text-white/90">
                  {renderMarkdown(part)}
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }
    // Extract just the content/text from ChatGPT responses (remove metadata)
    let displayValue = value;
    if (isOpenAI && typeof value === "string") {
      // Try to extract message content if it's a structured response
      try {
        const parsed = JSON.parse(value);
        if (parsed.choices && parsed.choices[0]?.message?.content) {
          displayValue = parsed.choices[0].message.content;
        } else if (parsed.content) {
          displayValue = parsed.content;
        } else if (parsed.message) {
          displayValue = typeof parsed.message === "string" ? parsed.message : parsed.message.content || value;
        }
      } catch {
        // Not JSON, use as-is
      }
    }

    // Check if extracted content is an image URL
    if (typeof displayValue === "string" && isImageUrl(displayValue)) {
      return (
        <div className={cx("rounded-xl overflow-hidden border", borderColor, bgColor, "relative group")}>
          <img
            src={displayValue}
            alt="Generated image"
            className="w-full max-h-[500px] object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                const fallback = document.createElement("div");
                fallback.className = "p-4 text-sm text-white/70 break-all";
                fallback.textContent = displayValue;
                parent.replaceChildren(fallback);
              }
            }}
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement("a");
                link.href = displayValue;
                link.download = `image-${Date.now()}.png`;
                link.target = "_blank";
                link.click();
              }}
              className="rounded-lg bg-black/80 hover:bg-black/90 p-2 border border-white/20"
              title="Download image"
            >
              <Download className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      );
    }

    // Render markdown for string outputs
    return (
      <div className={cx("text-base leading-[1.85] [&>p+p]:mt-5 [&>p]:mb-4", textColor)}>
        {renderMarkdown(displayValue)}
      </div>
    );
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <span className={cx("inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium", bgColorHeader, textColor)}>
        {String(value)}
      </span>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-5">
        {value.map((item, i) => (
          <div
            key={i}
            className={cx("rounded-lg border p-4 mt-5", borderColor, bgColor)}
          >
            <span className={cx("text-[11px] font-medium uppercase tracking-wider mr-2", textColorMuted)}>{i + 1}</span>
            <PremiumOutputDisplay value={item} isOpenAI={isOpenAI} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    // For OpenAI responses, extract displayable content first (avoids gibberish; supports all response shapes)
    if (isOpenAI) {
      const extracted = extractOpenAIDisplayContent(value);
      if (extracted) {
        if (extracted.kind === "string") {
          return (
            <div className={cx("text-base leading-7", textColor)}>
              {renderMarkdown(extracted.text)}
            </div>
          );
        }
        if (extracted.kind === "parts") {
          return (
            <div className="space-y-4">
              {extracted.parts.map((part, i) => {
                if (part.type === "text" && part.text.trim()) {
                  return (
                    <div key={i} className={cx("text-base leading-7", textColor)}>
                      {renderMarkdown(part.text)}
                    </div>
                  );
                }
                if (part.type === "image") {
                  return (
                    <div key={i} className={cx("rounded-xl overflow-hidden border", borderColor, bgColor, "relative group")}>
                      <img src={part.url} alt="Response" className="w-full max-h-[500px] object-contain" />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          );
        }
      }
    }

    // Filter out OpenAI API metadata fields (no finishReason / finish_reason in UI)
    const metadataFields = new Set([
      "model",
      "usage",
      "prompt_tokens",
      "completion_tokens",
      "total_tokens",
      "prompt_tokens_details",
      "completion_tokens_details",
      "finishReason",
      "finish_reason",
      "id",
      "object",
      "created",
      "system_fingerprint",
    ]);

    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([k, v]) => {
        if (metadataFields.has(k.toLowerCase())) return false;
        return v !== undefined && v !== null;
      }
    );

    if (entries.length === 0) {
      return <div className={cx("text-sm italic", textColorMuted)}>No content</div>;
    }

    return (
      <div className="space-y-5 [&>div]:mt-5">
        {entries.map(([k, v]) => (
          <div key={k} className={cx("rounded-lg border overflow-hidden", borderColor, bgColor)}>
            <div className={cx("px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider", bgColorHeader, borderColor, textColorMuted)}>
              {k}
            </div>
            <div className="px-4 py-4">
              <PremiumOutputDisplay value={v} isOpenAI={isOpenAI} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cx("text-sm font-mono leading-[1.85]", textColor)}>{String(value)}</div>
  );
}

export type BuilderRunLimit = { used: number; limit: number; isAdmin?: boolean };

export default function PremiumWorkflowRunModal({
  open,
  onClose,
  state,
  onCancel,
  onRerun,
  onSubmitInputs,
  onBuyWorkflow,
  remainingDemoRuns,
  workflowId,
  isBuilderTest,
  builderRunLimit,
  requiresApiKeys,
}: {
  open: boolean;
  onClose: () => void;
  state: WorkflowRunState | null;
  onCancel?: () => void;
  onRerun?: () => void;
  onSubmitInputs?: (values: Record<string, any>) => void;
  onBuyWorkflow?: () => void;
  remainingDemoRuns?: number;
  workflowId?: string;
  isBuilderTest?: boolean;
  builderRunLimit?: BuilderRunLimit;
  requiresApiKeys?: string[];
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [copiedOutput, setCopiedOutput] = useState<string | null>(null);
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [executionStep, setExecutionStep] = useState<"preparing" | "generating" | "finalizing">("preparing");
  const [isStopping, setIsStopping] = useState(false);

  const canClose = useMemo(() => {
    if (!state) return true;
    return state.status !== "running" && state.phase !== "executing";
  }, [state]);

  useEffect(() => {
    if (!open) return;

    safeTrack("Workflow Run Modal Opened", {
      surface: "builder",
      workflow_id: state?.workflowId,
      workflow_name: state?.workflowName,
      phase: state?.phase,
      status: state?.status,
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canClose) {
        safeTrack("Workflow Run Modal Closed", {
          surface: "builder",
          workflow_id: state?.workflowId,
          method: "escape_key",
          final_status: state?.status,
        });
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, canClose, state?.workflowId, state?.workflowName, state?.status, state?.phase]);

  useEffect(() => {
    if (!open) return;
    if (state?.phase === "executing" && state?.status === "running") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [open, state?.logs?.length, state?.status, state?.phase]);

  useEffect(() => {
    const values = state?.inputValues;
    if (values) {
      queueMicrotask(() => setInputValues(values));
    }
  }, [state?.inputValues]);

  // Execution step transitions - advance automatically during running
  useEffect(() => {
    if (state?.phase === "executing" && state?.status === "running") {
      queueMicrotask(() => {
        setExecutionStep("preparing");
        setIsStopping(false);
      });

      const timer1 = setTimeout(() => setExecutionStep("generating"), 600);
      const timer2 = setTimeout(() => setExecutionStep("finalizing"), 2000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }

    queueMicrotask(() => {
      setExecutionStep("preparing");
      setIsStopping(false);
    });
    return undefined;
  }, [state?.phase, state?.status]);

  // Show loading state immediately even if state is null
  const isLoading = open && !state;

  const statusPill =
    state?.status === "running"
      ? { label: "Running", icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "text-cyan-400" }
      : state?.status === "success"
      ? { label: "Completed", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-400" }
      : state?.status === "error"
      ? { label: "Failed", icon: <AlertTriangle className="h-4 w-4" />, color: "text-red-400" }
      : { label: "Ready", icon: <Sparkles className="h-4 w-4" />, color: "text-purple-400" };

  const handleInputSubmit = () => {
    if (!onSubmitInputs) return;
    const payload = { ...inputValues };
    if (openaiApiKey.trim() && (isBuilderTest || requiresApiKeys?.length)) {
      payload.__openaiApiKey = openaiApiKey.trim();
    }
    onSubmitInputs(payload);
  };

  const needsApiKey = (isBuilderTest && (builderRunLimit?.used ?? 0) >= (builderRunLimit?.limit ?? 10)) || (requiresApiKeys && requiresApiKeys.length > 0);
  const canSubmitBuilder = !needsApiKey || (needsApiKey && openaiApiKey.trim().length > 0);

  const handleCopyOutput = (value: any, index: number) => {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedOutput(`output-${index}`);
      setTimeout(() => setCopiedOutput(null), 2000);
    });
  };

  if (!open && !isLoading) return null;

  const phase = state?.phase;
  const status = state?.status;
  const isExecuting = phase === "executing";
  const isOutput = phase === "output";
  const isErrorDuringRun = status === "error" && phase === "executing";
  const isRunExperience = isExecuting || isOutput || isErrorDuringRun;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-xl">
      {/* Background - transparent, blurred, animated throughout */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden backdrop-blur-xl">
        {/* Animated gradient shapes - visible for entire modal (input + executing + output) */}
        <>
        {/* Moving organic gradient shape - primary */}
        <div
          className="absolute opacity-60 animate-[edgazeShape1_20s_ease-in-out_infinite]"
          style={{
            width: '800px',
            height: '800px',
            borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
            background: 'radial-gradient(circle at 30% 50%, rgba(34,211,238,0.4), rgba(168,85,247,0.3), transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Moving organic gradient shape - secondary */}
        <div
          className="absolute opacity-50 animate-[edgazeShape2_25s_ease-in-out_infinite]"
          style={{
            width: '600px',
            height: '600px',
            borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%',
            background: 'radial-gradient(circle at 70% 30%, rgba(217,70,239,0.35), rgba(34,211,238,0.25), transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
        {/* Moving organic gradient shape - tertiary */}
        <div
          className="absolute opacity-40 animate-[edgazeShape3_30s_ease-in-out_infinite]"
          style={{
            width: '700px',
            height: '700px',
            borderRadius: '50% 50% 50% 50% / 60% 40% 60% 40%',
            background: 'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.3), rgba(217,70,239,0.2), transparent 65%)',
            filter: 'blur(55px)',
          }}
        />
        {/* Rotating conic gradient overlay */}
        <div className="absolute -inset-[50%] opacity-30 animate-[spin_15s_linear_infinite] [background:conic-gradient(from_0deg,rgba(34,211,238,0.2),rgba(168,85,247,0.15),rgba(217,70,239,0.18),rgba(34,211,238,0.2))]" />
        {/* Subtle radial overlay during run - keeps animation visible */}
        {isRunExperience && (
          <div
            className="absolute inset-0 opacity-100 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(56,189,248,0.06) 0%, rgba(99,102,241,0.05) 30%, transparent 60%)",
            }}
          />
        )}
        </>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes edgazeShape1 {
          0%, 100% {
            transform: translate(10%, 20%) scale(1) rotate(0deg);
          }
          33% {
            transform: translate(60%, 40%) scale(1.2) rotate(120deg);
          }
          66% {
            transform: translate(30%, 70%) scale(0.9) rotate(240deg);
          }
        }
        @keyframes edgazeShape2 {
          0%, 100% {
            transform: translate(70%, 10%) scale(1.1) rotate(0deg);
          }
          33% {
            transform: translate(20%, 50%) scale(0.8) rotate(-120deg);
          }
          66% {
            transform: translate(80%, 60%) scale(1.3) rotate(-240deg);
          }
        }
        @keyframes edgazeShape3 {
          0%, 100% {
            transform: translate(40%, 60%) scale(1) rotate(0deg);
          }
          33% {
            transform: translate(10%, 30%) scale(1.1) rotate(90deg);
          }
          66% {
            transform: translate(50%, 80%) scale(0.95) rotate(180deg);
          }
        }
        @keyframes glazeSheenLoop {
          0% {
            transform: translateX(-100%) translateY(-50%) rotate(12deg);
          }
          100% {
            transform: translateX(200%) translateY(-50%) rotate(12deg);
          }
        }
        .glaze-sheen {
          animation: glazeSheenLoop 3s ease-in-out infinite;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .step-fade-in {
          animation: fadeInSlide 0.5s ease-out forwards;
          opacity: 0;
        }
        @keyframes cinematicOrb {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        .cinematic-orb {
          animation: cinematicOrb 2.4s ease-in-out infinite;
        }
        @keyframes cinematicSpin {
          to { transform: rotate(360deg); }
        }
        .cinematic-spinner {
          animation: cinematicSpin 1.2s linear infinite;
        }
        @keyframes cinematicShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .cinematic-shimmer {
          animation: cinematicShimmer 1.8s ease-in-out infinite;
        }
        @keyframes cinematicFloatIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cinematic-float-in {
          animation: cinematicFloatIn 0.5s ease-out forwards;
        }
        .cinematic-reduce-motion .cinematic-orb,
        .cinematic-reduce-motion .cinematic-spinner,
        .cinematic-reduce-motion .cinematic-shimmer {
          animation-duration: 3s;
          opacity: 0.7;
        }
      `}} />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className={cx(
          "w-[min(900px,92vw)] h-[min(700px,88vh)] rounded-2xl overflow-hidden flex flex-col",
          "border border-white/15 bg-black/50 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
        )}>
          {/* Instant Loading Screen - Shows immediately */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 rounded-2xl">
              <div className="text-center">
                <div className="relative inline-block mb-6">
                  {/* Animated gradient orb */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-75 blur-xl animate-pulse" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-500/30 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
                  </div>
                </div>
                <div className="text-xl font-semibold text-white mb-2">Preparing Workflow</div>
                <div className="text-sm text-white/60">Initializing execution environment...</div>
                {/* Animated dots */}
                <div className="flex items-center justify-center gap-1 mt-4">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white truncate">
                {state?.phase === "executing" ? (
                  <span className="text-[11px] font-medium uppercase tracking-widest text-white/50">Edgaze Run</span>
                ) : (
                  state?.workflowName || "Workflow"
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {state?.status === "running" && state?.phase === "executing" && (
                  <button
                    onClick={() => {
                      setIsStopping(true);
                      safeTrack("Workflow Run Cancelled", {
                        surface: "workflow_modal",
                        workflow_id: state?.workflowId,
                      });
                      // Show stopping state for 400ms, then cancel
                      setTimeout(() => {
                        onCancel?.();
                      }, 400);
                    }}
                    className="rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-white/85 transition-all duration-200"
                  >
                    {isStopping ? "Stopping…" : "Cancel"}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!canClose) return;
                    safeTrack("Workflow Run Modal Closed", {
                      surface: "workflow_modal",
                      workflow_id: state?.workflowId,
                      method: "close_button",
                      final_status: state?.status,
                    });
                    onClose();
                  }}
                  className={cx(
                    "h-9 w-9 rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 grid place-items-center transition-all duration-200",
                    !canClose && "opacity-50 cursor-not-allowed"
                  )}
                  title={canClose ? "Close" : "Running…"}
                >
                  <X className="h-4 w-4 text-white/85" />
                </button>
              </div>
            </div>
          </div>

          {/* Body - Phase-based content */}
          <div className="flex-1 overflow-hidden">
            {!isLoading && state?.phase === "input" && (state?.inputs?.length ? true : requiresApiKeys?.length) && (
              <div className="h-full overflow-auto px-6 py-8">
                <div className="max-w-2xl mx-auto space-y-7">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-white/15 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 mb-5">
                      <ArrowRight className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Workflow Inputs</h3>
                    <p className="text-sm text-white/60 leading-relaxed">Provide the required information to run this workflow</p>
                  </div>

                  {((isBuilderTest && builderRunLimit != null) || requiresApiKeys?.length) && needsApiKey && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-semibold text-white/90">
                          OpenAI API key
                          <span className="text-red-400 ml-1.5">*</span>
                        </label>
                        {builderRunLimit?.isAdmin ? (
                          <span className="text-xs text-amber-300 font-medium">Admin</span>
                        ) : builderRunLimit ? (
                          <span className="text-xs text-white/50">Runs {builderRunLimit.used}/{builderRunLimit.limit}</span>
                        ) : (
                          <span className="text-xs text-white/50">Free runs used</span>
                        )}
                      </div>
                      <p className="text-xs text-white/50 mb-4 leading-relaxed">
                        {requiresApiKeys?.length
                          ? "You've used your 10 free runs for this workflow. Add your OpenAI API key to continue running."
                          : "Free runs use gpt-4o-mini (5k tokens). With your key, the model you chose in the inspector is used (Premium). Stored locally."}
                      </p>
                      <input
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                        autoComplete="off"
                      />
                    </div>
                  )}

                  {isBuilderTest && builderRunLimit != null && !needsApiKey && !requiresApiKeys?.length && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/90">Free Runs Remaining</span>
                        <div className="flex items-center gap-3">
                          {builderRunLimit.isAdmin ? (
                            <span className="text-xs text-amber-300 font-medium">Admin (Unlimited)</span>
                          ) : (
                            <>
                              <span className="text-xs text-white/70 font-medium">
                                {builderRunLimit.limit - builderRunLimit.used} / {builderRunLimit.limit} remaining
                              </span>
                              <button
                                onClick={() => setShowDiagnosticModal(true)}
                                className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                                title="Debug run count issues"
                              >
                                Debug
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-5">
                    {(state.inputs ?? []).map((input) => (
                      <div key={input.nodeId} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                        <label className="block text-sm font-semibold text-white/90 mb-2">
                          {input.name}
                          {input.required && <span className="text-red-400 ml-1.5">*</span>}
                        </label>
                        {input.description && (
                          <p className="text-xs text-white/50 mb-4 leading-relaxed">{input.description}</p>
                        )}

                        <WorkflowInputField
                          input={input}
                          value={inputValues[input.nodeId]}
                          onChange={(value) => setInputValues((prev) => ({ ...prev, [input.nodeId]: value }))}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-6">
                    <button
                      onClick={handleInputSubmit}
                      disabled={
                        (state.inputs ?? []).some((i) => i.required && !inputValues[i.nodeId] && !i.defaultValue) ||
                        !onSubmitInputs ||
                        !canSubmitBuilder
                      }
                      className={cx(
                        "inline-flex items-center gap-2 rounded-xl border border-white/15 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(34,211,238,0.25)] transition-all duration-200",
                        ((state.inputs ?? []).some((i) => i.required && !inputValues[i.nodeId] && !i.defaultValue) ||
                          !onSubmitInputs ||
                          (isBuilderTest && !canSubmitBuilder)) &&
                          "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Play className="h-4 w-4" />
                      Start Execution
                    </button>
                  </div>
                </div>
              </div>
            )}

            {state?.phase === "executing" && (
              <div className="h-full overflow-auto flex flex-col items-center justify-center bg-transparent" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56,189,248,0.06) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)" }}>
                <CinematicRunView state={state} isStopping={isStopping} />
              </div>
            )}

            {(state?.phase === "output" || (state?.status === "error" && state?.phase === "executing")) && (
              <div className="h-full overflow-auto bg-transparent" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56,189,248,0.06) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)" }}>
                <div className="max-w-3xl mx-auto px-6 py-12">
                  {state.status === "error" ? (
                    /* Error State - Human message only; debug panel for admins only */
                    <div className="flex flex-col items-center text-center min-h-[320px]">
                      <div className="space-y-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-white/10 bg-white/5">
                          <AlertTriangle className="h-8 w-8 text-white/50" />
                        </div>
                        <div className="space-y-3">
                          <div className="text-xl font-medium text-white">Something didn&apos;t go through.</div>
                          <p className="text-sm text-white/50 max-w-md mx-auto leading-relaxed">
                            {sanitizeErrorForDisplay(state.error)}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                          {onRerun && (
                            <button
                              onClick={() => {
                                safeTrack("Workflow Run Again Clicked", {
                                  surface: "workflow_modal",
                                  workflow_id: state?.workflowId,
                                });
                                onRerun();
                              }}
                              className="h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors"
                            >
                              Run again
                            </button>
                          )}
                          <button
                            onClick={() => {
                              safeTrack("Workflow Run Modal Closed", {
                                surface: "workflow_modal",
                                workflow_id: state?.workflowId,
                                method: "close_button",
                                final_status: state?.status,
                              });
                              onClose();
                            }}
                            className="h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      {/* Admin-only debug panel – exact errors, full logs. Not shown to non-admins. */}
                      {builderRunLimit?.isAdmin === true && (
                        <details className="mt-10 w-full max-w-2xl mx-auto text-left border border-white/10 rounded-xl bg-black/40 overflow-hidden">
                          <summary className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70 select-none">
                            Debug (admin)
                          </summary>
                          <div className="px-4 py-4 space-y-4 border-t border-white/10">
                            {state.error && (
                              <div>
                                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Raw error</div>
                                <pre className="text-xs text-red-300/90 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto p-3 rounded-lg bg-red-950/30 border border-red-500/20">
                                  {state.error}
                                </pre>
                              </div>
                            )}
                            {state.logs && state.logs.length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Logs</div>
                                <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto p-3 rounded-lg bg-white/5 border border-white/10">
                                  {state.logs.map((l, i) => `[${l.level}] ${l.text}${l.nodeId ? ` (node: ${l.nodeId})` : ""}`).join("\n")}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  ) : state?.outputs && state.outputs.length > 0 ? (
                    /* Result - Premium, minimal */
                    <div className="space-y-14">
                      <div className="text-center space-y-5">
                        <div className="text-2xl font-medium text-white">Done.</div>
                        <p className="text-sm text-white/50 leading-relaxed">Here&apos;s what it produced.</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 md:p-10">
                        <div className="prose prose-invert max-w-none space-y-10">
                          {(state.outputs || []).map((output, idx) => (
                            <div key={output.nodeId || idx} className="space-y-6">
                              {(state.outputs?.length ?? 0) > 1 && (
                                <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
                                  {output.label || "Result"}
                                </div>
                              )}
                              <div className="text-base leading-[1.85] text-white/90">
                                <PremiumOutputDisplay value={output.value} isOpenAI={false} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-6">
                        <button
                          onClick={() => {
                            const firstOutput = state.outputs?.[0];
                            if (firstOutput) handleCopyOutput(firstOutput.value, 0);
                          }}
                          className="h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors inline-flex items-center gap-2"
                        >
                          {copiedOutput === "output-0" ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </button>
                        <button
                          onClick={async () => {
                            const firstOutput = state.outputs?.[0];
                            if (!firstOutput) return;
                            const value = firstOutput.value;
                            if (typeof value === "string" && isImageUrl(value)) {
                              try {
                                const res = await fetch(value, { mode: "cors" });
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `image-${Date.now()}.png`;
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch {
                                const a = document.createElement("a");
                                a.href = value;
                                a.download = `image-${Date.now()}.png`;
                                a.target = "_blank";
                                a.click();
                              }
                              return;
                            }
                            const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
                            const blob = new Blob([text], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `workflow-output-${Date.now()}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors inline-flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                        {onRerun && (
                          <button
                            onClick={() => {
                              safeTrack("Workflow Run Again Clicked", { surface: "workflow_modal", workflow_id: state?.workflowId });
                              onRerun();
                            }}
                            className="h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors inline-flex items-center gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Run again
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-14 space-y-3">
                      <div className="text-2xl font-medium text-white">Done.</div>
                      <p className="text-sm text-white/50 leading-relaxed">Your workflow finished successfully.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diagnostic Modal */}
      <RunCountDiagnosticModal
        open={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
        workflowId={workflowId || null}
        onRefresh={() => {
          // Trigger a refresh of the run limit if parent provides callback
          // This will be handled by the parent component
        }}
      />
    </div>
  );
}
