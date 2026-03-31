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
import type {
  RunStepStatus,
  WorkflowInput,
  WorkflowRunLogLine,
  WorkflowRunState,
  WorkflowRunStep,
} from "../../lib/workflow/run-types";
import { simplifyWorkflowError } from "../../lib/workflow/simplify-error";
import {
  brandIconPathForSpec,
  canonicalSpecId,
  isPremiumAiSpec,
  providerForAiSpec,
} from "../../lib/workflow/spec-id-aliases";
import { WorkflowInputField } from "./WorkflowInputField";
import RunCountDiagnosticModal from "./RunCountDiagnosticModal";
import CustomerWorkflowRuntimeSurface from "../runtime/customer/CustomerWorkflowRuntimeSurface";
import { UserApiKeysDialog } from "../settings/UserApiKeysDialog";
import { bearerAuthHeaders } from "../../lib/auth/bearer-headers";
import { useAuth } from "../auth/AuthContext";

export type {
  RunStepStatus,
  WorkflowInput,
  WorkflowRunLogLine,
  WorkflowRunState,
  WorkflowRunStep,
} from "../../lib/workflow/run-types";

function safeTrack(event: string, props?: Record<string, any>) {
  try {
    track(event, props);
  } catch {}
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  input: <ArrowRight className="h-4 w-4" />,
  "llm-chat": <Zap className="h-4 w-4" />,
  "llm-embeddings": <Code className="h-4 w-4" />,
  "llm-image": <ImageIcon className="h-4 w-4" />,
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
  const c = canonicalSpecId(specId);
  return STEP_ICONS[specId] || STEP_ICONS[c] || STEP_ICONS.default;
}

function humanReadableStep(specId: string, nodeTitle?: string): string {
  const title = nodeTitle || specId;
  const c = canonicalSpecId(specId);
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
  return map[specId] || map[c] || `Executing ${title}`;
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
function sanitizeErrorForDisplay(error?: string | unknown): string {
  if (!error) return "Something went wrong. Try again.";
  return simplifyWorkflowError(error);
}

function getFailedNodeIds(state: WorkflowRunState | null): Set<string> {
  if (!state) return new Set();
  const failed = new Set<string>();
  state.steps?.forEach((step) => {
    if (step.status === "error") {
      failed.add(step.id);
    }
  });
  // Also check logs for error nodeIds
  state.logs?.forEach((log) => {
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

function CinematicRunView({ state, isStopping }: { state: WorkflowRunState; isStopping: boolean }) {
  const [viewPhase, setViewPhase] = useState<CinematicPhase>("preparing");
  const [prepDots, setPrepDots] = useState(0);
  const [showTakingLong, setShowTakingLong] = useState(false);

  const steps = useMemo(() => state.steps || [], [state.steps]);

  const { displayStep, isFinalizing } = useMemo(() => {
    const running = steps.find((s) => s.status === "running");
    const done = steps.filter((s) => s.status === "done");
    const allDone = steps.length > 0 && done.length === steps.length;
    return {
      displayStep: running ?? (allDone ? null : (steps.find((s) => s.status === "queued") ?? null)),
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
    const hasRuntimeSignal =
      Boolean(state.startedAt) ||
      (state.lastEventSequence ?? 0) > 0 ||
      steps.some((step) => step.status === "running" || step.status === "queued" || step.status === "done");
    queueMicrotask(() => setViewPhase(hasRuntimeSignal ? "live" : "preparing"));
  }, [state.startedAt, state.lastEventSequence, steps]);

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
              background:
                "radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(99,102,241,0.1) 50%, transparent 70%)",
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
                i < prepDots ? "bg-white/60 scale-100" : "bg-white/20 scale-90",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex flex-col items-center px-6 py-12 max-w-xl mx-auto",
        isStopping && "cinematic-reduce-motion",
      )}
    >
      <div className="text-center mb-14">
        {!isStopping && (
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full opacity-40 blur-xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(99,102,241,0.15) 50%, transparent 70%)",
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
          {isStopping
            ? "We'll stop after the current step."
            : isFinalizing
              ? "Almost there…"
              : `Now working on: ${humanTitle}`}
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
              isStopping && "opacity-70",
            )}
          >
            <div className="text-lg font-medium text-white/90 mb-3">
              {humanizeTitle(displayStep.title)}
            </div>
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
function extractOpenAIDisplayContent(
  value: unknown,
):
  | { kind: "string"; text: string }
  | { kind: "parts"; parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> }
  | null {
  if (value === null || value === undefined) return null;
  const v = value as Record<string, unknown>;

  // choices[0].message.content or choices[0].text (OpenAI / Anthropic-style)
  if (Array.isArray(v?.choices) && v.choices[0]) {
    const c0 = v.choices[0] as Record<string, unknown>;
    const msg = c0?.message;
    const content =
      msg && typeof msg === "object" ? (msg as Record<string, unknown>).content : null;
    const textDirect = typeof c0?.text === "string" ? c0.text : null;
    if (typeof content === "string" && content.trim()) return { kind: "string", text: content };
    if (textDirect && textDirect.trim()) return { kind: "string", text: textDirect };
    if (Array.isArray(content)) {
      const parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [];
      for (const part of content) {
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          if (p.type === "text" && typeof p.text === "string")
            parts.push({ type: "text", text: p.text });
          if (
            p.type === "image_url" &&
            p.image_url &&
            typeof (p.image_url as any)?.url === "string"
          )
            parts.push({ type: "image", url: (p.image_url as any).url });
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
        if (p.type === "text" && typeof p.text === "string")
          parts.push({ type: "text", text: p.text });
        if (p.type === "image_url" && p.image_url && typeof (p.image_url as any)?.url === "string")
          parts.push({ type: "image", url: (p.image_url as any).url });
      }
    }
    if (parts.length) return { kind: "parts", parts };
  }

  // .message.content
  const msg = v?.message;
  if (msg && typeof msg === "object") {
    const mc = (msg as Record<string, unknown>).content;
    if (typeof mc === "string" && (mc as string).trim())
      return { kind: "string", text: mc as string };
    if (Array.isArray(mc)) {
      const parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [];
      for (const part of mc) {
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          if (p.type === "text" && typeof p.text === "string")
            parts.push({ type: "text", text: p.text });
          if (
            p.type === "image_url" &&
            p.image_url &&
            typeof (p.image_url as any)?.url === "string"
          )
            parts.push({ type: "image", url: (p.image_url as any).url });
        }
      }
      if (parts.length) return { kind: "parts", parts };
    }
  }

  // tool_calls: show a short summary instead of raw object
  const choices0 = (v as any).choices?.[0];
  if (Array.isArray((v as any).tool_calls) && (v as any).tool_calls.length > 0) {
    const count = (v as any).tool_calls.length;
    return {
      kind: "string",
      text: `Tool calls (${count}): use the raw output or logs for details.`,
    };
  }
  if (
    choices0 &&
    Array.isArray(choices0?.message?.tool_calls) &&
    choices0.message.tool_calls.length > 0
  ) {
    const count = choices0.message.tool_calls.length;
    return {
      kind: "string",
      text: `Tool calls (${count}): use the raw output or logs for details.`,
    };
  }

  return null;
}

/** Common keys that typically hold displayable text in API/LLM responses. */
const DISPLAY_TEXT_KEYS = [
  "content",
  "text",
  "output",
  "result",
  "message",
  "value",
  "response",
  "answer",
  "reply",
  "body",
  "summary",
] as const;

function getStringFrom(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v : null;
}

/** Extract displayable text from common API/object shapes (not OpenAI-specific). */
function extractGenericDisplayContent(obj: Record<string, unknown>): string | null {
  if (!obj || typeof obj !== "object") return null;
  const v = obj;

  for (const key of DISPLAY_TEXT_KEYS) {
    const s = getStringFrom(v, key);
    if (s) return s;
  }

  // Nested: message.content, message.text
  const msg = v.message;
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    const m = msg as Record<string, unknown>;
    for (const key of DISPLAY_TEXT_KEYS) {
      const s = getStringFrom(m, key);
      if (s) return s;
    }
  }

  // Nested: data.content, data.text, result.content
  for (const outer of ["data", "result", "response"] as const) {
    const inner = v[outer];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      for (const key of DISPLAY_TEXT_KEYS) {
        const s = getStringFrom(inner, key);
        if (s) return s;
      }
    }
  }

  // Array with single object: [{}] - take first element
  if (Array.isArray(v.results) && v.results.length === 1) {
    const first = v.results[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      for (const key of DISPLAY_TEXT_KEYS) {
        const s = getStringFrom(first, key);
        if (s) return s;
      }
    }
  }

  return null;
}

/** If the model returned a string that is actually JSON with a text field, extract it. */
function extractFromJsonString(str: string): string | null {
  let t = str.trim();
  // Strip markdown code block: ```json\n...\n``` or ```\n...\n```
  const codeBlockMatch = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  const captured = codeBlockMatch?.[1];
  if (captured !== undefined) t = captured.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return null;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    for (const key of DISPLAY_TEXT_KEYS) {
      const s = getStringFrom(parsed, key);
      if (s) return s;
    }
    return null;
  } catch {
    return null;
  }
}

function PremiumStepView({
  state,
  onCopyOutput,
  copiedOutput,
  isExecuting = false,
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
  const nodeMap = new Map(state.graph.nodes.map((n) => [n.id, n]));
  const edgesBySource = new Map<string, string[]>();

  state.graph.edges.forEach((e) => {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, []);
    edgesBySource.get(e.source)!.push(e.target);
  });

  // Find input nodes (no incoming edges or specId === "input")
  const hasIncoming = new Set(state.graph.edges.map((e) => e.target));
  const inputNodes = state.graph.nodes.filter((n) => {
    const specId = n.data?.specId;
    return !hasIncoming.has(n.id) || specId === "input";
  });
  const inputNodeIds = new Set(inputNodes.map((n) => n.id));

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

  inputNodes.forEach((n) => dfs(n.id));
  // Add any remaining nodes (that aren't inputs)
  state.graph.nodes.forEach((n) => {
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
            k !== "__anthropicApiKey" &&
            k !== "__geminiApiKey" &&
            k !== "__builder_test" &&
            k !== "__builder_user_key" &&
            k !== "__workflow_id",
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
    if (typeof raw === "object" && raw !== null && Array.isArray((raw as any).results)) {
      const filtered = ((raw as any).results as unknown[]).filter(
        (item) => typeof item !== "string" || !isEcho(item),
      );
      if (filtered.length === 0) return undefined;
      return filtered.length === 1 ? filtered[0] : { ...(raw as object), results: filtered };
    }
    return raw;
  };

  const getNodeIcon = (nodeId: string) => {
    const sid = getNodeSpecId(nodeId);
    const cfg = nodeMap.get(nodeId)?.data?.config as Record<string, unknown> | undefined;
    const path = brandIconPathForSpec(sid, cfg);
    if (path) {
      return <img src={path} alt="" className="h-6 w-6 object-contain" />;
    }
    return getStepIcon(sid);
  };

  // Determine which steps should be visible (one by one as they execute)
  // Inputs are shown in a separate section - do not show as an execution step
  const visibleSteps: string[] = [];

  // Show steps as they become active or complete - one by one
  nodeOrder.forEach((nodeId, stepIndex) => {
    const step = state.steps.find((s) => s.id === nodeId);
    const status = step?.status || (isExecuting ? "queued" : "done");

    // Show step if:
    // 1. It's running (currently executing) - show immediately
    // 2. It's done (completed) - show immediately
    // 3. Previous step is done - show next one in sequence (only during execution)
    const prevStepId = stepIndex > 0 ? nodeOrder[stepIndex - 1] : null;
    const prevStep = prevStepId ? state.steps.find((s) => s.id === prevStepId) : null;
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
        const step = state.steps.find((s) => s.id === nodeId);
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
              icon={getNodeIcon(nodeId)}
              output={isExecuting ? output : output} // Show output during execution if available
              isOpenAI={
                providerForAiSpec(
                  specId,
                  nodeMap.get(nodeId)?.data?.config as Record<string, unknown> | undefined,
                ) === "openai"
              }
              status={status}
              onCopy={
                output !== undefined && !isExecuting ? () => onCopyOutput(output, idx) : undefined
              }
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
      <div
        className={cx(
          "relative rounded-xl border overflow-hidden",
          isOpenAI ? "bg-white border-white/20" : "bg-gray-800/90 border-gray-700/50",
        )}
      >
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
            <div
              className={cx(
                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                isOpenAI ? "bg-black" : "bg-gradient-to-br from-cyan-500/30 to-purple-500/30",
              )}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cx(
                  "text-sm font-semibold truncate",
                  isOpenAI ? "text-black" : "text-white",
                )}
              >
                {title}
              </div>
            </div>
            {status === "running" && (
              <Loader2
                className={cx(
                  "h-4 w-4 animate-spin shrink-0",
                  isOpenAI ? "text-black/60" : "text-cyan-400",
                )}
              />
            )}
            {status === "done" && output !== undefined && onCopy && (
              <button
                onClick={onCopy}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all shrink-0",
                  isOpenAI
                    ? "bg-black/10 hover:bg-black/20 text-black/80"
                    : "bg-white/10 hover:bg-white/20 text-white/80",
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
            <div className={cx("rounded-lg p-4 mt-5", isOpenAI ? "bg-black/5" : "bg-black/30")}>
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
  const lines = text.split("\n");
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
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return (
                      <strong key={j} className="font-semibold text-white">
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  return part;
                })}
              </li>
            );
          })}
        </ul>,
      );
      listItems = [];
    }
    inList = false;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={idx} className="text-xl font-semibold text-white mt-8 mb-4">
          {trimmed.substring(4)}
        </h3>,
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={idx} className="text-2xl font-semibold text-white mt-10 mb-5">
          {trimmed.substring(3)}
        </h2>,
      );
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={idx} className="text-3xl font-bold text-white mt-12 mb-6">
          {trimmed.substring(2)}
        </h1>,
      );
      return;
    }

    // Lists
    if (trimmed.match(/^[-*•]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      if (!inList) flushList();
      inList = true;
      const itemText = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
      listItems.push(itemText);
      return;
    }

    // Regular paragraph
    flushList();
    if (trimmed === "") {
      elements.push(<div key={idx} className="h-6" />);
      return;
    }

    // Process bold text
    const parts = trimmed.split(/(\*\*.*?\*\*)/g);
    const processedLine = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    elements.push(
      <p key={idx} className="text-base leading-[1.85] text-white/90 mb-6">
        {processedLine}
      </p>,
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
    return <div className={cx("text-sm italic", textColorMuted)}>No value</div>;
  }

  // Recovery: strip "[object Object]" lines leaked from server-side String() coercion.
  // Handles both standalone and mixed-in cases (e.g. "[object Object]\n\nfrance\n\n[object Object]").
  if (typeof value === "string" && value.includes("[object Object]")) {
    const cleaned = value
      .split(/\n+/)
      .filter((line) => !/^\[object\s+\w+\]$/.test(line.trim()))
      .join("\n\n")
      .trim();
    if (!cleaned) {
      return <div className={cx("text-sm italic", textColorMuted)}>No output was produced.</div>;
    }
    return <PremiumOutputDisplay value={cleaned} isOpenAI={isOpenAI} />;
  }

  if (typeof value === "string") {
    // Check if it's an image URL (including DALL-E URLs)
    if (isImageUrl(value)) {
      return (
        <div
          className={cx(
            "rounded-xl overflow-hidden border",
            borderColor,
            bgColor,
            "relative group",
          )}
        >
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
    const urlPattern =
      /(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|gif|webp|avif|svg))[^\s]*|https?:\/\/[^\s]*oaidalleapiprodscus[^\s]*|https?:\/\/[^\s]*blob\.core\.windows\.net[^\s]*)/gi;
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
                <div
                  key={i}
                  className={cx(
                    "rounded-xl overflow-hidden border",
                    borderColor,
                    bgColor,
                    "relative group",
                  )}
                >
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
    // Extract content from JSON-wrapped strings (model sometimes returns {"response":"..."} etc.)
    let displayValue: string = value;
    const unwrapped = extractFromJsonString(value);
    if (unwrapped) {
      displayValue = unwrapped;
    } else if (isOpenAI) {
      // Try to extract message content from structured API response
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        const choices = parsed?.choices as Array<{ message?: { content?: string } }> | undefined;
        if (choices?.[0] && typeof choices[0]?.message === "object") {
          const content = choices[0].message?.content;
          if (typeof content === "string" && content.trim()) displayValue = content;
        } else if (typeof parsed?.content === "string" && parsed.content.trim()) {
          displayValue = parsed.content as string;
        } else if (parsed?.message) {
          const m = parsed.message as Record<string, unknown>;
          displayValue =
            typeof m === "string"
              ? m
              : ((typeof m?.content === "string" ? m.content : displayValue) as string);
        }
      } catch {
        // Not JSON, use as-is
      }
    }

    // Check if extracted content is an image URL
    if (typeof displayValue === "string" && isImageUrl(displayValue)) {
      return (
        <div
          className={cx(
            "rounded-xl overflow-hidden border",
            borderColor,
            bgColor,
            "relative group",
          )}
        >
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
      <span
        className={cx(
          "inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium",
          bgColorHeader,
          textColor,
        )}
      >
        {String(value)}
      </span>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-5">
        {value.map((item, i) => (
          <div key={i} className={cx("rounded-lg border p-4 mt-5", borderColor, bgColor)}>
            <span
              className={cx(
                "text-[11px] font-medium uppercase tracking-wider mr-2",
                textColorMuted,
              )}
            >
              {i + 1}
            </span>
            <PremiumOutputDisplay value={item} isOpenAI={isOpenAI} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Workflow input node shape { question, value } — value may be non-string (never render as [object Object])
    if (
      !Array.isArray(value) &&
      "value" in obj &&
      "question" in obj &&
      typeof obj.question === "string"
    ) {
      const inner = obj.value;
      return (
        <div className={cx("space-y-2 rounded-lg border p-3", borderColor, bgColor)}>
          <div className={cx("text-[11px] font-medium uppercase tracking-wider", textColorMuted)}>
            {obj.question}
          </div>
          <div className={textColor}>
            <PremiumOutputDisplay value={inner} isOpenAI={isOpenAI} />
          </div>
        </div>
      );
    }

    // Always try to extract displayable content from API-style objects (OpenAI, etc.)
    // Workflow outputs often pass through raw API responses - extract text to avoid "[object Object]"
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
                  <div
                    key={i}
                    className={cx(
                      "rounded-xl overflow-hidden border",
                      borderColor,
                      bgColor,
                      "relative group",
                    )}
                  >
                    <img
                      src={part.url}
                      alt="Response"
                      className="w-full max-h-[500px] object-contain"
                    />
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      }
    }

    // Try common API shapes: { content }, { text }, { output }, { message }, etc.
    const genericText = extractGenericDisplayContent(value as Record<string, unknown>);
    if (genericText) {
      return (
        <div className={cx("text-base leading-[1.85] [&>p+p]:mt-5 [&>p]:mb-4", textColor)}>
          {renderMarkdown(genericText)}
        </div>
      );
    }

    // Last resort for objects: find any string value, skipping metadata
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
      "timestamp",
      "count",
    ]);

    // Try to find a single string value by scanning all non-metadata keys
    for (const [k, v] of Object.entries(obj)) {
      if (metadataFields.has(k.toLowerCase())) continue;
      if (typeof v === "string" && v.trim()) {
        return (
          <div className={cx("text-base leading-[1.85] [&>p+p]:mt-5 [&>p]:mb-4", textColor)}>
            {renderMarkdown(v)}
          </div>
        );
      }
    }

    // If the object has a results array, try to render that
    if (Array.isArray(obj.results) && obj.results.length > 0) {
      return (
        <div className="space-y-5">
          {obj.results.map((item: unknown, i: number) => (
            <PremiumOutputDisplay key={i} value={item} isOpenAI={isOpenAI} />
          ))}
        </div>
      );
    }

    // Truly unrecognized object: JSON.stringify it cleanly
    const jsonStr = (() => {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return null;
      }
    })();

    if (jsonStr && jsonStr !== "{}") {
      return (
        <div className={cx("text-sm font-mono leading-[1.85] whitespace-pre-wrap", textColor)}>
          {jsonStr}
        </div>
      );
    }

    return <div className={cx("text-sm italic", textColorMuted)}>No output was produced.</div>;
  }

  // Non-object, non-string, non-number/boolean: stringify safely
  const display =
    value !== null && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  return (
    <div className={cx("text-sm font-mono leading-[1.85] whitespace-pre-wrap", textColor)}>
      {display}
    </div>
  );
}

export type BuilderRunLimit = { used: number; limit: number; isAdmin?: boolean };

type ExecutionNodeView = {
  id: string;
  title: string;
  specId: string;
  status: RunStepStatus;
  detail?: string;
  config?: unknown;
  output?: unknown;
  input?: unknown;
  attempts?: Array<{
    attemptNumber: number;
    status: string;
    materializedInput?: unknown;
    outputPayload?: unknown;
    errorPayload?: unknown;
    startedAt?: string | null;
    endedAt?: string | null;
    durationMs?: number | null;
  }>;
  dependencyState?: Array<{ dependencyNodeId: string; status: string }>;
  logs: WorkflowRunLogLine[];
  step?: WorkflowRunStep;
};

type ExecutionTimelineEntry = {
  id: string;
  t: number;
  text: string;
  level: "info" | "warn" | "error";
  nodeId?: string;
};

function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0s";
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatRelativeClock(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "Pending";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function readSessionPayloadValue(reference: unknown): unknown {
  if (
    reference &&
    typeof reference === "object" &&
    !Array.isArray(reference) &&
    "storageKind" in (reference as Record<string, unknown>)
  ) {
    return (reference as Record<string, unknown>).value;
  }
  return reference;
}

/** Strip nested inline payload envelopes (flow v2) so UI shows real data, not opaque refs. */
function unwrapInlinePayloadDeep(reference: unknown): unknown {
  let cur: unknown = reference;
  while (
    cur &&
    typeof cur === "object" &&
    !Array.isArray(cur) &&
    "storageKind" in (cur as Record<string, unknown>)
  ) {
    cur = readSessionPayloadValue(cur);
  }
  if (Array.isArray(cur)) return cur.map(unwrapInlinePayloadDeep);
  return cur;
}

/**
 * Unwrap input-node { value, question } and condition { __conditionResult, __passthrough }
 * shapes so the UI shows the actual user-facing data, not opaque wrapper objects.
 */
function unwrapNodeValueForDisplay(v: unknown): unknown {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const obj = v as Record<string, unknown>;
  if ("value" in obj && "question" in obj) {
    return obj.value;
  }
  if ("__conditionResult" in obj && "__passthrough" in obj) {
    return unwrapNodeValueForDisplay(obj.__passthrough);
  }
  return v;
}

/**
 * Frozen materialized input from the runner wraps port values; flatten to the actual prompt/data
 * so "Resolved input" matches what handlers see (avoids confusing port metadata trees).
 */
function unwrapMaterializedInputForDisplay(materialized: unknown): unknown {
  const v = unwrapInlinePayloadDeep(readSessionPayloadValue(materialized));
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const rec = v as Record<string, unknown>;
  const ports = rec.ports;
  if (ports && typeof ports === "object" && !Array.isArray(ports)) {
    const portMap = ports as Record<string, unknown>;
    const keys = Object.keys(portMap);
    if (keys.length === 1) {
      const pdata = portMap[keys[0]!];
      if (pdata && typeof pdata === "object" && !Array.isArray(pdata) && "value" in pdata) {
        return unwrapNodeValueForDisplay(
          unwrapInlinePayloadDeep((pdata as Record<string, unknown>).value),
        );
      }
    }
    const out: Record<string, unknown> = {};
    for (const [pid, pdata] of Object.entries(portMap)) {
      if (pdata && typeof pdata === "object" && !Array.isArray(pdata) && "value" in pdata) {
        out[pid] = unwrapNodeValueForDisplay(
          unwrapInlinePayloadDeep((pdata as Record<string, unknown>).value),
        );
      }
    }
    return Object.keys(out).length > 0 ? out : v;
  }
  return unwrapNodeValueForDisplay(v);
}

function sortNodeIdsStable(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function getDeterministicNodeOrder(state: WorkflowRunState): string[] {
  const graphNodes = state.graph?.nodes ?? [];
  const graphEdges = state.graph?.edges ?? [];
  if (!graphNodes.length) {
    return state.steps.map((step) => step.id);
  }

  const nodeIds = graphNodes.map((node) => node.id);
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const nodeId of nodeIds) {
    indegree.set(nodeId, 0);
    outgoing.set(nodeId, []);
  }

  for (const edge of graphEdges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const ready = sortNodeIdsStable(
    nodeIds.filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0),
  );
  const order: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) break;
    order.push(current);

    const nextTargets = sortNodeIdsStable(outgoing.get(current) ?? []);
    for (const target of nextTargets) {
      const nextDegree = (indegree.get(target) ?? 1) - 1;
      indegree.set(target, nextDegree);
      if (nextDegree === 0) {
        ready.push(target);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  const remaining = nodeIds.filter((nodeId) => !order.includes(nodeId));
  if (remaining.length > 0) {
    order.push(...sortNodeIdsStable(remaining));
  }

  return order;
}

function getNodeStatusForExecution(
  state: WorkflowRunState,
  nodeId: string,
  specId?: string,
): RunStepStatus {
  const step = state.steps.find((item) => item.id === nodeId);
  if (step?.status) return step.status;

  if (specId === "input" && state.phase !== "input") {
    const hasInputValue =
      state.inputValues && Object.prototype.hasOwnProperty.call(state.inputValues, nodeId);
    return hasInputValue ? "done" : "queued";
  }

  if (state.status === "success" && state.phase === "output") {
    return "done";
  }

  return "queued";
}

function getNodeOutputValue(state: WorkflowRunState, nodeId: string): unknown {
  const sessionNode = state.session?.nodesById?.[nodeId];
  const sessionOutput = readSessionPayloadValue(sessionNode?.outputPayload);
  if (sessionOutput !== undefined) {
    return unwrapNodeValueForDisplay(sessionOutput);
  }
  if (state.outputsByNode && Object.prototype.hasOwnProperty.call(state.outputsByNode, nodeId)) {
    return unwrapNodeValueForDisplay(state.outputsByNode[nodeId]);
  }
  const outputMatch = state.outputs?.find((output) => output.nodeId === nodeId);
  return outputMatch ? unwrapNodeValueForDisplay(outputMatch.value) : undefined;
}

function getNodeResolvedInput(state: WorkflowRunState, nodeId: string, specId?: string): unknown {
  const latestAttempt = state.session?.attemptsByNodeId?.[nodeId]?.slice(-1)[0];
  const materializedInput = readSessionPayloadValue(latestAttempt?.materializedInput);
  if (materializedInput !== undefined) {
    return unwrapMaterializedInputForDisplay(materializedInput);
  }
  const sessionNodeInput = readSessionPayloadValue(state.session?.nodesById?.[nodeId]?.inputPayload);
  if (sessionNodeInput !== undefined) {
    return unwrapMaterializedInputForDisplay(sessionNodeInput);
  }
  if (specId === "input") {
    const fromForm = state.inputValues?.[nodeId];
    if (fromForm !== undefined) return fromForm;
    return state.session?.runInput?.[nodeId];
  }

  const edges = state.graph?.edges ?? [];
  const nodes = state.graph?.nodes ?? [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const inbound = [...edges]
    .filter((edge) => edge.target === nodeId)
    .sort((a, b) =>
      `${a.source}:${a.target}`.localeCompare(`${b.source}:${b.target}`),
    );

  if (inbound.length === 0) {
    return undefined;
  }

  const resolved: Record<string, unknown> = {};
  for (const edge of inbound) {
    const sourceNode = nodeMap.get(edge.source);
    const key =
      sourceNode?.data?.title ||
      sourceNode?.data?.config?.name ||
      sourceNode?.data?.specId ||
      edge.source;

    let rawVal: unknown;
    if (state.outputsByNode && Object.prototype.hasOwnProperty.call(state.outputsByNode, edge.source)) {
      rawVal = state.outputsByNode[edge.source];
    } else {
      const upstreamOutput = state.outputs?.find((output) => output.nodeId === edge.source);
      if (upstreamOutput) {
        rawVal = upstreamOutput.value;
      }
    }
    if (rawVal !== undefined) {
      resolved[key] = unwrapNodeValueForDisplay(rawVal);
    }
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

function buildExecutionNodes(state: WorkflowRunState): ExecutionNodeView[] {
  const nodeMap = new Map((state.graph?.nodes ?? []).map((node) => [node.id, node]));
  const stepMap = new Map(state.steps.map((step) => [step.id, step]));
  const graphOrder = getDeterministicNodeOrder(state);
  const supplementalIds = state.steps
    .map((step) => step.id)
    .filter((stepId) => !graphOrder.includes(stepId));
  const orderedIds = [...graphOrder, ...supplementalIds];

  return orderedIds.map((nodeId) => {
    const graphNode = nodeMap.get(nodeId);
    const specId = graphNode?.data?.specId || "default";
    const step = stepMap.get(nodeId);
    const logs = (state.logs ?? []).filter((log) => log.nodeId === nodeId);
    const detail = step?.detail || logs.find((log) => log.level === "error")?.text;

    return {
      id: nodeId,
      title:
        graphNode?.data?.title ||
        graphNode?.data?.config?.name ||
        step?.title ||
        humanReadableStep(specId),
      specId,
      status: getNodeStatusForExecution(state, nodeId, specId),
      detail,
      config: graphNode?.data?.config,
      output: getNodeOutputValue(state, nodeId),
      input: getNodeResolvedInput(state, nodeId, specId),
      attempts: state.session?.attemptsByNodeId?.[nodeId] ?? [],
      dependencyState: state.session?.dependencyStateByNodeId?.[nodeId] ?? [],
      logs,
      step,
    };
  });
}

function buildTimelineEntries(
  state: WorkflowRunState,
  nodes: ExecutionNodeView[],
): ExecutionTimelineEntry[] {
  const items: ExecutionTimelineEntry[] = [];

  for (const node of nodes) {
    if (!node.step?.timestamp) continue;
    const text =
      node.status === "running"
        ? `${node.title} started`
        : node.status === "done"
          ? `${node.title} completed`
          : node.status === "error"
            ? `${node.title} failed`
            : node.status === "cancelled"
              ? `${node.title} cancelled`
            : node.status === "skipped"
              ? `${node.title} skipped`
              : `${node.title} queued`;

    items.push({
      id: `step-${node.id}-${node.status}`,
      t: node.step.timestamp,
      text,
      level: node.status === "error" ? "error" : "info",
      nodeId: node.id,
    });
  }

  for (const [index, log] of (state.logs ?? []).entries()) {
    items.push({
      id: `log-${index}-${log.nodeId ?? "global"}`,
      t: log.t ?? state.startedAt ?? Date.now(),
      text: log.text,
      level: log.level,
      nodeId: log.nodeId,
    });
  }

  return items.sort((a, b) => b.t - a.t);
}

function getStatusBadge(status: RunStepStatus, statusLabel?: string) {
  if (status === "running") {
    return {
      label: statusLabel || "Running",
      className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    };
  }
  if (status === "done") {
    return {
      label: statusLabel || "Completed",
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    };
  }
  if (status === "error") {
    return {
      label: statusLabel || "Failed",
      className: "border-red-400/30 bg-red-400/10 text-red-200",
    };
  }
  if (status === "skipped") {
    return {
      label: statusLabel || "Skipped",
      className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    };
  }
  if (status === "cancelled") {
    return {
      label: statusLabel || "Cancelled",
      className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    };
  }
  return {
    label: statusLabel || "Queued",
    className: "border-white/10 bg-white/5 text-white/65",
  };
}

function JsonValueCard({
  title,
  value,
  emptyLabel = "Not available for this run.",
}: {
  title: string;
  value: unknown;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {title}
      </div>
      <div className="mt-3">
        {value === undefined ? (
          <div className="text-sm text-white/40">{emptyLabel}</div>
        ) : (
          <PremiumOutputDisplay value={value} isOpenAI={false} />
        )}
      </div>
    </div>
  );
}

function LiveExecutionViewer({
  state,
  isStopping,
}: {
  state: WorkflowRunState;
  isStopping: boolean;
}) {
  const nodes = useMemo(() => buildExecutionNodes(state), [state]);
  const timeline = useMemo(() => buildTimelineEntries(state, nodes), [state, nodes]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedFallbackNodeId = useMemo(() => {
    return (
      state.currentStepId ||
      nodes.find((node) => node.status === "error")?.id ||
      nodes.find((node) => node.status === "running")?.id ||
      nodes[0]?.id ||
      null
    );
  }, [nodes, state.currentStepId]);

  useEffect(() => {
    if (!selectedNodeId || !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(selectedFallbackNodeId);
      return;
    }

    if (state.currentStepId && state.currentStepId !== selectedNodeId) {
      const currentNode = nodes.find((node) => node.id === state.currentStepId);
      if (currentNode?.status === "running") {
        setSelectedNodeId(state.currentStepId);
      }
    }
  }, [nodes, selectedFallbackNodeId, selectedNodeId, state.currentStepId]);

  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null;
  const completedCount = nodes.filter((node) => node.status === "done").length;
  const failedCount = nodes.filter((node) => node.status === "error").length;
  const runningNode = nodes.find((node) => node.status === "running");
  const durationMs = state.startedAt
    ? (state.finishedAt ?? Date.now()) - state.startedAt
    : 0;
  const runError = sanitizeErrorForDisplay(state.error);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Status
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {isStopping
                ? "Stopping after current step"
                : state.status === "running"
                  ? "Live execution"
                  : state.status === "success"
                    ? "Run completed"
                    : "Run failed"}
            </div>
            <div className="mt-1 text-sm text-white/55">
              {runningNode
                ? `Currently executing ${runningNode.title}`
                : state.status === "success"
                  ? "All terminal nodes finished."
                  : state.status === "error"
                    ? runError
                    : "Waiting for workflow activity."}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Progress
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {completedCount} / {nodes.length} nodes completed
            </div>
            <div className="mt-1 text-sm text-white/55">
              {failedCount > 0
                ? `${failedCount} node${failedCount === 1 ? "" : "s"} failed`
                : `${nodes.filter((node) => node.status === "queued").length} queued`}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Runtime
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {formatDurationMs(durationMs)}
            </div>
            <div className="mt-1 text-sm text-white/55">
              Started {formatRelativeClock(state.startedAt)}
            </div>
          </div>
        </div>

        {state.status === "error" && (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {runError}
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="min-h-0 overflow-auto px-6 py-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold text-white">Execution graph</div>
              <div className="text-xs text-white/45">
                Every node is shown in deterministic order.
              </div>
            </div>
            <div className="divide-y divide-white/8">
              {nodes.map((node, index) => {
                const badge = getStatusBadge(node.status, node.step?.statusLabel);
                const isSelected = node.id === selectedNode?.id;
                const outputPreview =
                  typeof node.output === "string" && node.output.trim()
                    ? node.output.trim().slice(0, 96)
                    : null;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={cx(
                      "w-full px-4 py-4 text-left transition-colors",
                      isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-xs font-semibold text-white/70">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-white">
                            {node.title}
                          </div>
                          <span
                            className={cx(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              badge.className,
                            )}
                          >
                            {node.status === "running" && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            {badge.label}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-white/45">
                          {node.specId} · {formatRelativeClock(node.step?.timestamp)}
                        </div>

                        {node.detail && (
                          <div className="mt-2 text-sm text-white/65 line-clamp-2">{node.detail}</div>
                        )}

                        {!node.detail && outputPreview && (
                          <div className="mt-2 text-sm text-white/55 line-clamp-2">
                            {outputPreview}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold text-white">Activity timeline</div>
              <div className="text-xs text-white/45">Newest event first.</div>
            </div>
            <div className="max-h-[360px] overflow-auto px-4 py-3">
              {timeline.length === 0 ? (
                <div className="text-sm text-white/40">No activity has been recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {timeline.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-white/8 bg-black/20 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className={cx(
                            "text-sm",
                            entry.level === "error"
                              ? "text-red-200"
                              : entry.level === "warn"
                                ? "text-amber-100"
                                : "text-white/80",
                          )}
                        >
                          {entry.text}
                        </div>
                        <div className="shrink-0 text-[11px] text-white/35">
                          {formatRelativeClock(entry.t)}
                        </div>
                      </div>
                      {entry.nodeId && (
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/30">
                          {entry.nodeId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 border-t border-white/10 lg:border-l lg:border-t-0">
          <div className="h-full overflow-auto px-6 py-5">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Node detail
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="text-xl font-semibold text-white">{selectedNode.title}</div>
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        getStatusBadge(selectedNode.status, selectedNode.step?.statusLabel).className,
                      )}
                    >
                      {selectedNode.status === "running" && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {getStatusBadge(selectedNode.status, selectedNode.step?.statusLabel).label}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-white/45">
                    {selectedNode.specId} · {selectedNode.id}
                  </div>
                </div>

                <JsonValueCard title="Resolved input" value={selectedNode.input} />
                <JsonValueCard title="Node config" value={selectedNode.config} />
                <JsonValueCard title="Node output" value={selectedNode.output} />
                <JsonValueCard
                  title="Dependency satisfaction"
                  value={
                    selectedNode.dependencyState && selectedNode.dependencyState.length > 0
                      ? selectedNode.dependencyState
                      : undefined
                  }
                  emptyLabel="No upstream dependencies."
                />

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Attempts and timing
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-white/65">
                    <div>Last state change: {formatRelativeClock(selectedNode.step?.timestamp)}</div>
                    <div>
                      Retries:
                      {" "}
                      {Math.max((selectedNode.attempts?.length ?? 1) - 1, 0)}
                    </div>
                    <div>
                      Error:
                      {" "}
                      {selectedNode.detail ? sanitizeErrorForDisplay(selectedNode.detail) : "None"}
                    </div>
                    {selectedNode.attempts && selectedNode.attempts.length > 0 ? (
                      <div>Attempts recorded: {selectedNode.attempts.length}</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Node activity
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedNode.logs.length === 0 ? (
                      <div className="text-sm text-white/40">No node-specific logs recorded.</div>
                    ) : (
                      selectedNode.logs.map((log, index) => (
                        <div
                          key={`${selectedNode.id}-log-${index}`}
                          className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
                        >
                          <div
                            className={cx(
                              "text-sm",
                              log.level === "error"
                                ? "text-red-200"
                                : log.level === "warn"
                                  ? "text-amber-100"
                                  : "text-white/80",
                            )}
                          >
                            {log.text}
                          </div>
                          <div className="mt-1 text-[11px] text-white/35">
                            {formatRelativeClock(log.t)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/40">Select a node to inspect its execution data.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  allowProjectionToggle,
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
  allowProjectionToggle?: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [copiedOutput, setCopiedOutput] = useState<string | null>(null);
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [showVaultKeysDialog, setShowVaultKeysDialog] = useState(false);
  const [vaultKeysConfigured, setVaultKeysConfigured] = useState({
    openai: false,
    anthropic: false,
    gemini: false,
  });
  const { getAccessToken } = useAuth();
  const [projectionMode, setProjectionMode] = useState<"builder" | "customer">("builder");
  const [isStopping, setIsStopping] = useState(false);

  const canClose = useMemo(() => {
    if (!state) return true;
    return state.status !== "running" && state.status !== "cancelling";
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
  }, [
    open,
    onClose,
    canClose,
    state?.workflowId,
    state?.workflowName,
    state?.status,
    state?.phase,
  ]);

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

  useEffect(() => {
    queueMicrotask(() => setIsStopping(state?.status === "cancelling"));
  }, [state?.status]);

  // Show loading state immediately even if state is null
  const isLoading = open && !state;
  // Builder/edit mode only: optional Builder vs Customer projection toggle.
  // Preview, purchased runs, and product-page demos use customer surface only (no toggle).
  const showCustomerProjection =
    allowProjectionToggle === true ? projectionMode === "customer" : true;

  const statusPill =
    state?.status === "running"
      ? {
          label: "Running",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: "text-cyan-400",
        }
      : state?.status === "cancelling"
        ? {
            label: "Cancelling",
            icon: <Loader2 className="h-4 w-4 animate-spin" />,
            color: "text-amber-300",
          }
      : state?.status === "success"
        ? {
            label: "Completed",
            icon: <CheckCircle2 className="h-4 w-4" />,
            color: "text-green-400",
          }
        : state?.status === "cancelled"
          ? {
              label: "Cancelled",
              icon: <AlertTriangle className="h-4 w-4" />,
              color: "text-amber-300",
            }
        : state?.status === "error"
          ? { label: "Failed", icon: <AlertTriangle className="h-4 w-4" />, color: "text-red-400" }
          : { label: "Ready", icon: <Sparkles className="h-4 w-4" />, color: "text-purple-400" };

  const handleInputSubmit = () => {
    if (!onSubmitInputs) return;
    const payload = { ...inputValues };
    if (openaiApiKey.trim() && (isBuilderTest || requiresApiKeys?.length)) {
      payload.__openaiApiKey = openaiApiKey.trim();
    }
    if (anthropicApiKey.trim() && (isBuilderTest || requiresApiKeys?.length)) {
      payload.__anthropicApiKey = anthropicApiKey.trim();
    }
    if (geminiApiKey.trim() && (isBuilderTest || requiresApiKeys?.length)) {
      payload.__geminiApiKey = geminiApiKey.trim();
    }
    onSubmitInputs(payload);
  };

  const needsApiKey =
    (isBuilderTest && (builderRunLimit?.used ?? 0) >= (builderRunLimit?.limit ?? 10)) ||
    (requiresApiKeys && requiresApiKeys.length > 0);

  const providersRequired = useMemo(() => {
    const set = new Set<"openai" | "anthropic" | "google">();
    const nodes = state?.graph?.nodes ?? [];
    if (requiresApiKeys?.length) {
      for (const id of requiresApiKeys) {
        const n = nodes.find((x) => x.id === id);
        const sid = n?.data?.specId ?? "";
        if (isPremiumAiSpec(sid)) set.add(providerForAiSpec(sid, n?.data?.config));
      }
    } else if (isBuilderTest && (builderRunLimit?.used ?? 0) >= (builderRunLimit?.limit ?? 10)) {
      for (const n of nodes) {
        const sid = n.data?.specId ?? "";
        if (isPremiumAiSpec(sid)) set.add(providerForAiSpec(sid, n?.data?.config));
      }
    }
    return set;
  }, [state?.graph, requiresApiKeys, isBuilderTest, builderRunLimit]);

  const effectiveKeyProviders = useMemo(() => {
    if (needsApiKey && providersRequired.size === 0) {
      return new Set<"openai" | "anthropic" | "google">(["openai"]);
    }
    return providersRequired;
  }, [needsApiKey, providersRequired]);

  useEffect(() => {
    if (!open) {
      setVaultKeysConfigured({ openai: false, anthropic: false, gemini: false });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !needsApiKey) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/user/api-keys", {
        credentials: "include",
        headers: await bearerAuthHeaders(getAccessToken),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      const next = { openai: false, anthropic: false, gemini: false };
      if (res.ok && data.ok && Array.isArray(data.keys)) {
        for (const k of data.keys) {
          if (k.provider === "openai" && k.configured) next.openai = true;
          else if (k.provider === "anthropic" && k.configured) next.anthropic = true;
          else if (k.provider === "gemini" && k.configured) next.gemini = true;
        }
      }
      setVaultKeysConfigured(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, needsApiKey, getAccessToken]);

  const keysOk =
    (!effectiveKeyProviders.has("openai") ||
      openaiApiKey.trim().length > 0 ||
      vaultKeysConfigured.openai) &&
    (!effectiveKeyProviders.has("anthropic") ||
      anthropicApiKey.trim().length > 0 ||
      vaultKeysConfigured.anthropic) &&
    (!effectiveKeyProviders.has("google") ||
      geminiApiKey.trim().length > 0 ||
      vaultKeysConfigured.gemini);
  const canSubmitBuilder = !needsApiKey || (needsApiKey && keysOk);

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
    <div className="fixed inset-0 z-[9999] bg-black/70" data-workflow-run-modal>
      {/* Static gradient background (no blur animations - reduces GPU load on low-end devices) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56,189,248,0.08) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)",
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
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
      `,
        }}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div
          className={cx(
            "w-[min(1220px,96vw)] h-[min(840px,92vh)] rounded-2xl overflow-hidden flex flex-col",
            "border border-white/15 bg-[#0c0c0c] shadow-[0_24px_80px_rgba(0,0,0,0.4)]",
          )}
        >
          {/* Instant Loading Screen - Shows immediately */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/95 z-50 rounded-2xl">
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
                  <div
                    className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-pink-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-white max-sm:line-clamp-2 sm:truncate">
                  {state?.workflowName || "Workflow"}
                </div>
                {state && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <span
                      className={cx(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                        state.status === "running"
                          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                          : state.status === "cancelling"
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                          : state.status === "success"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                            : state.status === "cancelled"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                            : state.status === "error"
                              ? "border-red-400/30 bg-red-400/10 text-red-200"
                              : "border-white/10 bg-white/5 text-white/60",
                      )}
                    >
                      {statusPill.icon}
                      {statusPill.label}
                    </span>
                    <span>
                      {(state.steps?.filter((step) => step.status === "done").length ?? 0)} /
                      {" "}
                      {state.graph?.nodes?.length ?? state.steps?.length ?? 0}
                      {" "}
                      nodes complete
                    </span>
                    {state.currentStepId && !showCustomerProjection && <span>Live step: {state.currentStepId}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {allowProjectionToggle === true && (
                  <div className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1">
                    <button
                      type="button"
                      onClick={() => setProjectionMode("builder")}
                      className={cx(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition",
                        projectionMode === "builder"
                          ? "bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.18)]"
                          : "text-white/60 hover:text-white/85",
                      )}
                    >
                      Builder view
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectionMode("customer")}
                      className={cx(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition",
                        projectionMode === "customer"
                          ? "bg-[linear-gradient(135deg,rgba(88,214,255,0.9),rgba(151,112,255,0.92))] text-white shadow-[0_12px_34px_rgba(68,120,255,0.34)]"
                          : "text-white/60 hover:text-white/85",
                      )}
                    >
                      Customer view
                    </button>
                  </div>
                )}
                {(state?.status === "running" || state?.status === "cancelling") &&
                  state?.phase === "executing" && (
                  <button
                    onClick={() => {
                      if (isStopping || state?.status === "cancelling") return;
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
                    className="rounded-lg border border-transparent bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 text-sm font-medium text-white/50 hover:text-white/70 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isStopping || state?.status === "cancelling"}
                  >
                    {isStopping || state?.status === "cancelling" ? "Cancelling…" : "Cancel"}
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
                    "h-9 w-9 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] grid place-items-center transition-all duration-200 text-white/50 hover:text-white/70",
                    !canClose && "opacity-50 cursor-not-allowed",
                  )}
                  title={canClose ? "Close" : "Running…"}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Body - Phase-based content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {!isLoading && showCustomerProjection && (
              <div className="h-full overflow-auto px-5 py-5 md:px-6 md:py-6">
                <CustomerWorkflowRuntimeSurface
                  state={state}
                  onCancel={onCancel}
                  onClose={canClose ? onClose : undefined}
                  onRerun={onRerun}
                  onSubmitInputs={onSubmitInputs}
                  embedded
                  hideHeader
                  hideActionZone
                  isBuilderTest={isBuilderTest}
                  builderRunLimit={builderRunLimit}
                  requiresApiKeys={requiresApiKeys}
                  onBuyWorkflow={onBuyWorkflow}
                />
              </div>
            )}
            {!showCustomerProjection &&
              !isLoading &&
              state?.phase === "input" &&
              (state?.inputs?.length ? true : requiresApiKeys?.length) && (
                <div className="h-full overflow-auto px-6 py-8">
                  <div className="max-w-2xl mx-auto space-y-7">
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-white/15 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 mb-5">
                        <ArrowRight className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">Workflow Inputs</h3>
                      <p className="text-sm text-white/60 leading-relaxed">
                        Provide the required information to run this workflow
                      </p>
                    </div>

                    {((isBuilderTest && builderRunLimit != null) || requiresApiKeys?.length) &&
                      needsApiKey && (
                        <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-5 space-y-5">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <label className="block text-sm font-semibold text-white/90">
                              API keys
                              <span className="text-red-400 ml-1.5">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowVaultKeysDialog(true)}
                              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                            >
                              Saved keys…
                            </button>
                            {builderRunLimit?.isAdmin ? (
                              <span className="text-xs text-amber-300 font-medium">Admin</span>
                            ) : builderRunLimit ? (
                              <span className="text-xs text-white/50">
                                Runs {builderRunLimit.used}/{builderRunLimit.limit}
                              </span>
                            ) : (
                              <span className="text-xs text-white/50">Free runs used</span>
                            )}
                          </div>
                          <p className="text-xs text-white/50 leading-relaxed">
                            {requiresApiKeys?.length
                              ? "You've used your free runs for this workflow. Paste keys below or open Saved keys to use encrypted keys from your account (Settings → API keys)."
                              : "Free tier uses lower-cost defaults. With your keys, inspector models apply. You can paste once here or save encrypted keys under Saved keys."}
                          </p>
                          {effectiveKeyProviders.has("openai") && (
                            <div>
                              <label className="block text-xs font-medium text-white/70 mb-2">
                                OpenAI (LLM Chat / Image / Embeddings)
                              </label>
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
                          {effectiveKeyProviders.has("anthropic") && (
                            <div>
                              <label className="block text-xs font-medium text-white/70 mb-2">
                                Anthropic (Claude Chat)
                              </label>
                              <input
                                type="password"
                                value={anthropicApiKey}
                                onChange={(e) => setAnthropicApiKey(e.target.value)}
                                placeholder="sk-ant-..."
                                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                                autoComplete="off"
                              />
                            </div>
                          )}
                          {effectiveKeyProviders.has("google") && (
                            <div>
                              <label className="block text-xs font-medium text-white/70 mb-2">
                                Google AI Studio (Gemini)
                              </label>
                              <input
                                type="password"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                placeholder="AIza..."
                                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                                autoComplete="off"
                              />
                            </div>
                          )}
                        </div>
                      )}

                    {isBuilderTest &&
                      builderRunLimit != null &&
                      !needsApiKey &&
                      !requiresApiKeys?.length && (
                        <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white/90">
                              Free Runs Remaining
                            </span>
                            <div className="flex items-center gap-3">
                              {builderRunLimit.isAdmin ? (
                                <span className="text-xs text-amber-300 font-medium">
                                  Admin (Unlimited)
                                </span>
                              ) : (
                                <>
                                  <span className="text-xs text-white/70 font-medium">
                                    {builderRunLimit.limit - builderRunLimit.used} /{" "}
                                    {builderRunLimit.limit} remaining
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
                        <div
                          key={input.nodeId}
                          className="rounded-xl border border-white/10 bg-[#0c0c0c] p-5"
                        >
                          <label className="block text-sm font-semibold text-white/90 mb-2">
                            {input.name}
                            {input.required && <span className="text-red-400 ml-1.5">*</span>}
                          </label>
                          {input.description && (
                            <p className="text-xs text-white/50 mb-4 leading-relaxed">
                              {input.description}
                            </p>
                          )}

                          <WorkflowInputField
                            input={input}
                            value={inputValues[input.nodeId]}
                            onChange={(value) =>
                              setInputValues((prev) => ({ ...prev, [input.nodeId]: value }))
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-center pt-10 pb-2">
                      <button
                        onClick={handleInputSubmit}
                        disabled={
                          (state.inputs ?? []).some(
                            (i) => i.required && !inputValues[i.nodeId] && !i.defaultValue,
                          ) ||
                          !onSubmitInputs ||
                          !canSubmitBuilder
                        }
                        className={cx(
                          "inline-flex items-center gap-2 rounded-xl border border-white/15 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(34,211,238,0.25)] transition-all duration-200",
                          ((state.inputs ?? []).some(
                            (i) => i.required && !inputValues[i.nodeId] && !i.defaultValue,
                          ) ||
                            !onSubmitInputs ||
                            (isBuilderTest && !canSubmitBuilder)) &&
                            "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <Play className="h-4 w-4" />
                        Start Execution
                      </button>
                    </div>
                  </div>
                </div>
              )}

            {!showCustomerProjection && !isLoading && isRunExperience && state && (
              <>
                <div
                  className="flex-1 overflow-hidden bg-transparent"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56,189,248,0.06) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)",
                  }}
                >
                  <LiveExecutionViewer state={state} isStopping={isStopping} />
                </div>

                {(state.phase !== "executing" || state.status === "error") && (
                  <div className="shrink-0 border-t border-white/10 px-6 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      {state.outputs && state.outputs.length > 0 && (
                        <>
                          <button
                            onClick={() => {
                              const firstOutput = state.outputs?.[0];
                              if (firstOutput) handleCopyOutput(firstOutput.value, 0);
                            }}
                            className="h-10 min-h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                          >
                            {copiedOutput === "output-0" ? (
                              <>
                                <Check className="h-4 w-4 shrink-0" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 shrink-0" />
                                Copy output
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
                              const text =
                                typeof value === "string" ? value : JSON.stringify(value, null, 2);
                              const blob = new Blob([text], { type: "text/plain" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `workflow-output-${Date.now()}.txt`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="h-10 min-h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                          >
                            <Download className="h-4 w-4 shrink-0" />
                            Download
                          </button>
                        </>
                      )}

                      {onRerun && (
                        <button
                          onClick={() => {
                            safeTrack("Workflow Run Again Clicked", {
                              surface: "workflow_modal",
                              workflow_id: state?.workflowId,
                            });
                            onRerun();
                          }}
                          className="h-10 min-h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                          <Play className="h-4 w-4 shrink-0" />
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
                        className="h-10 min-h-10 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/90 transition-colors inline-flex items-center justify-center whitespace-nowrap"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </>
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

      <UserApiKeysDialog
        open={showVaultKeysDialog}
        onClose={() => {
          setShowVaultKeysDialog(false);
          if (needsApiKey) {
            void (async () => {
              const res = await fetch("/api/user/api-keys", {
                credentials: "include",
                headers: await bearerAuthHeaders(getAccessToken),
              });
              return res.json();
            })()
              .then((data) => {
                const next = { openai: false, anthropic: false, gemini: false };
                if (data?.ok && Array.isArray(data.keys)) {
                  for (const k of data.keys) {
                    if (k.provider === "openai" && k.configured) next.openai = true;
                    else if (k.provider === "anthropic" && k.configured) next.anthropic = true;
                    else if (k.provider === "gemini" && k.configured) next.gemini = true;
                  }
                }
                setVaultKeysConfigured(next);
              })
              .catch(() => {});
          }
        }}
      />
    </div>
  );
}
