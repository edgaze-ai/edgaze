/**
 * Workflow infrastructure cost estimation at publish time.
 * Estimates per-run cost based on node configs, models, and token usage.
 * Includes internal 20% markup (not displayed to user).
 * Uses inline token counting to avoid pulling server-only deps into client bundle.
 */

import { canonicalSpecId } from "./spec-id-aliases";
import {
  DEFAULT_LLM_CHAT_MODEL,
  DEFAULT_LLM_IMAGE_MODEL,
  openaiGptImageQualityParam,
  resolveAnthropicApiModel,
  resolveLlmChatProvider,
} from "./llm-model-catalog";

/** Approximate token count for text (~4 chars per token). */
function estimateTokens(text: string): number {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

function countChatTokens(config: { prompt?: string; system?: string; maxTokens?: number }): {
  input: number;
  output: number;
} {
  let input = 0;
  if (config.system) input += estimateTokens(config.system);
  if (config.prompt) input += estimateTokens(config.prompt);
  const output = config.maxTokens ?? 2000;
  return { input, output };
}

function countEmbeddingTokens(text: string): number {
  return estimateTokens(text);
}

export type GraphNode = {
  id: string;
  data?: {
    specId?: string;
    config?: Record<string, unknown>;
    title?: string;
  };
  /** Legacy / alternate: specId sometimes at node root when serialized */
  specId?: string;
};

export type GraphEdge = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type WorkflowGraph = {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
};

/** Per 1M tokens (input/output) or per image. Prices from OpenAI (approx). */
const CHAT_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4-turbo": { inputPer1M: 10, outputPer1M: 30 },
  "gpt-4": { inputPer1M: 30, outputPer1M: 60 },
  "gpt-3.5-turbo": { inputPer1M: 0.5, outputPer1M: 1.5 },
  "claude-3-5-haiku-20241022": { inputPer1M: 0.25, outputPer1M: 1.25 },
  "claude-3-5-sonnet-20241022": { inputPer1M: 3, outputPer1M: 15 },
  "claude-3-opus-20240229": { inputPer1M: 15, outputPer1M: 75 },
  "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5 },
  "gemini-2.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  // Legacy ID stored in older workflows (maps to gemini-2.5-pro at runtime).
  "gemini-2.5-pro-preview-05-06": { inputPer1M: 1.25, outputPer1M: 5 },
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 5 },
  "gpt-5.4": { inputPer1M: 5, outputPer1M: 15 },
  "gpt-5.4-mini": { inputPer1M: 0.2, outputPer1M: 0.8 },
  "gpt-5.4-nano": { inputPer1M: 0.05, outputPer1M: 0.2 },
  o3: { inputPer1M: 10, outputPer1M: 40 },
  "claude-3-7-sonnet-20250219": { inputPer1M: 3, outputPer1M: 15 },
  "claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15 },
};

const EMBEDDING_PRICING: Record<string, number> = {
  "text-embedding-3-small": 0.02,
  "text-embedding-3-large": 0.13,
  "text-embedding-ada-002": 0.1,
};

/** Per image by model/size (USD approx; GPT Image varies by quality). */
const IMAGE_PRICING: Record<string, Record<string, number>> = {
  "gpt-image-1-mini": {
    "1024x1024": 0.02,
    "1536x1024": 0.03,
    "1024x1536": 0.03,
    low: 0.015,
    medium: 0.02,
    high: 0.04,
  },
  "gpt-image-1.5": {
    "1024x1024": 0.08,
    "1536x1024": 0.12,
    "1024x1536": 0.12,
    low: 0.05,
    medium: 0.08,
    high: 0.15,
  },
  "gemini-2.5-flash-image": { "1024x1024": 0.02 },
  "gemini-3.1-flash-image-preview": { "1024x1024": 0.02 },
  "gemini-3-pro-image-preview": { "1024x1024": 0.12 },
};

const DEFAULT_SAMPLE_TEXT =
  "Sample input text for cost estimation. This provides a reasonable baseline for token counting when no default value is set.";

const SERVER_SYSTEM_PROMPT =
  "You are a helpful AI assistant running in Edgaze workflows. Be concise, accurate, and follow user instructions carefully.";

/** Internal markup (not displayed). */
const MARKUP_MULTIPLIER = 1.2;

/** Extract string content from inbound value (mirrors handler logic). */
function oneInboundToInputSegment(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    if ("__conditionResult" in obj && "__passthrough" in obj) {
      return oneInboundToInputSegment(obj.__passthrough);
    }
    if (typeof obj.question === "string" && "value" in obj) {
      const v = obj.value;
      return v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
    }
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.prompt === "string") return obj.prompt;
    if (typeof obj.value === "string") return obj.value;
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }
  if (Array.isArray(val)) {
    return val.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ");
  }
  return String(val);
}

function topoSort(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  edges.forEach((e) => {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      adj.get(e.source)?.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
  });

  const q: string[] = [];
  indeg.forEach((d, id) => d === 0 && q.push(id));
  const order: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    order.push(u);
    for (const v of adj.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if ((indeg.get(v) ?? 0) === 0) q.push(v);
    }
  }
  return order.length === nodes.length ? order : nodes.map((n) => n.id);
}

/**
 * Estimate the cost to run a workflow once (in USD).
 * Includes internal 20% markup.
 * Safe to run client-side (e.g. in publish modal).
 */
/** Normalize graph so nodes/edges are arrays and we can read specId from node.data or node.specId. */
function normalizeGraphForCost(
  graph: WorkflowGraph | null,
): { nodes: GraphNode[]; edges: GraphEdge[] } | null {
  if (!graph) return null;
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  if (nodes.length === 0) return null;
  return { nodes, edges };
}

export function estimateWorkflowRunCost(graph: WorkflowGraph | null): number {
  const normalized = normalizeGraphForCost(graph);
  if (!normalized) return 0;

  const { nodes, edges } = normalized;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const inboundByNode = new Map<string, string[]>();
  nodes.forEach((n) => inboundByNode.set(n.id, []));
  edges.forEach((e) => {
    const arr = inboundByNode.get(e.target);
    if (arr) arr.push(e.source);
  });

  const order = topoSort(nodes, edges);
  const outputsByNode = new Map<string, unknown>();

  let totalUsd = 0;

  for (const nodeId of order) {
    const node = nodeById.get(nodeId);
    if (!node) continue;

    const specId = (node.data?.specId ?? (node as GraphNode).specId ?? "").trim();
    const canon = canonicalSpecId(specId);
    const config = (node.data?.config ?? {}) as Record<string, unknown>;
    const inboundIds = inboundByNode.get(nodeId) ?? [];
    const inboundValues = inboundIds.map((id) => outputsByNode.get(id));

    if (specId === "input") {
      const def = (config.defaultValue ??
        config.value ??
        config.text ??
        DEFAULT_SAMPLE_TEXT) as string;
      const val = typeof def === "string" ? def : String(def ?? "");
      const question = config.question as string | undefined;
      if (question && typeof question === "string" && question.trim()) {
        outputsByNode.set(nodeId, { value: val, question });
      } else {
        outputsByNode.set(nodeId, val);
      }
    } else if (specId === "merge") {
      const valid = inboundValues.filter((v) => v !== null && v !== undefined);
      const merged =
        valid.length === 1
          ? oneInboundToInputSegment(valid[0])
          : valid.map(oneInboundToInputSegment).join("\n\n");
      outputsByNode.set(nodeId, merged);
    } else if (specId === "condition") {
      const passthrough = inboundValues[0];
      outputsByNode.set(nodeId, passthrough);
      // Condition always calls gpt-4o-mini once.
      const systemParts = [
        typeof config.humanCondition === "string" ? config.humanCondition : "",
        String(config.operator ?? "truthy"),
        String(config.compareValue ?? ""),
      ].filter((s) => s.trim().length > 0);
      const tc = countChatTokens({
        prompt: String(passthrough ?? ""),
        system: systemParts.join(" | ") || "truthy",
        maxTokens: 50,
      });
      const chatPricing = CHAT_PRICING["gpt-4o-mini"] ?? { inputPer1M: 0.15, outputPer1M: 0.6 };
      totalUsd +=
        (tc.input / 1_000_000) * chatPricing.inputPer1M +
        (tc.output / 1_000_000) * chatPricing.outputPer1M;
    } else if (canon === "llm-chat") {
      const configPrompt = (config.prompt ?? "") as string;
      const userSystem = (config.system ?? "") as string;
      const system = userSystem
        ? `${SERVER_SYSTEM_PROMPT}\n\nUser context: ${userSystem}`
        : SERVER_SYSTEM_PROMPT;

      let prompt: string;
      if (inboundValues.length > 0) {
        const segments = inboundValues
          .filter((v) => v !== null && v !== undefined)
          .map(oneInboundToInputSegment)
          .filter((s) => s.length > 0);
        const inputsSection = segments.join("\n\n");
        prompt = configPrompt
          ? `## Inputs\n\n${inputsSection}\n\n## Prompt\n\n${configPrompt}`
          : `## Inputs\n\n${inputsSection}`;
      } else {
        prompt = configPrompt || "";
      }

      const maxTokens = (config.maxTokens ?? 2000) as number;
      const tokenCount = countChatTokens({
        prompt,
        system,
        maxTokens,
      });

      const model = (config.model ?? DEFAULT_LLM_CHAT_MODEL) as string;
      const defaultChatPricing = { inputPer1M: 0.15, outputPer1M: 0.6 };
      const pricingKey =
        resolveLlmChatProvider(model) === "anthropic"
          ? resolveAnthropicApiModel(model)
          : model;
      const pricing = CHAT_PRICING[model] ?? CHAT_PRICING[pricingKey] ?? defaultChatPricing;
      totalUsd +=
        (tokenCount.input / 1_000_000) * pricing.inputPer1M +
        (tokenCount.output / 1_000_000) * pricing.outputPer1M;

      outputsByNode.set(nodeId, { content: "", model });
    } else if (canon === "llm-embeddings") {
      const raw = inboundValues[0];
      const text =
        (typeof raw === "string" ? raw : undefined) ?? ((config.text ?? "") as string) ?? "";
      const effectiveText = text || " ";
      const tokenCount = countEmbeddingTokens(effectiveText);

      const model = (config.model ?? "text-embedding-3-small") as string;
      const per1M = EMBEDDING_PRICING[model] ?? 0.02;
      totalUsd += (tokenCount / 1_000_000) * per1M;

      outputsByNode.set(nodeId, []);
    } else if (canon === "llm-image") {
      const raw = inboundValues[0];
      const prompt =
        (typeof raw === "string" ? raw : undefined) ?? ((config.prompt ?? "") as string) ?? "";
      const effectivePrompt = prompt || "Generate an image";

      const model = (config.model ?? DEFAULT_LLM_IMAGE_MODEL) as string;
      const size = ((config.size ?? "1024x1024") as string) || "1024x1024";
      const quality = ((config.quality ?? "standard") as string) || "standard";

      let cost = 0.04;
      if (model.startsWith("gemini-") && model.includes("image")) {
        const gp = IMAGE_PRICING[model];
        cost = gp?.["1024x1024"] ?? 0.02;
      } else {
        const gptQuality = openaiGptImageQualityParam(quality);
        const modelPrices =
          IMAGE_PRICING[model] ?? IMAGE_PRICING["gpt-image-1-mini"] ?? { "1024x1024": 0.02 };
        cost =
          (modelPrices as Record<string, number>)[gptQuality] ??
          modelPrices[size] ??
          modelPrices["1024x1024"] ??
          0.02;
      }
      totalUsd += cost;

      outputsByNode.set(nodeId, "https://example.com/image.png");
    } else if (
      specId === "output" ||
      specId === "transform" ||
      specId === "json-parse" ||
      specId === "delay" ||
      specId === "loop" ||
      specId === "template" ||
      specId === "merge-json"
    ) {
      outputsByNode.set(nodeId, inboundValues[0] ?? null);
    } else if (specId === "http-request") {
      outputsByNode.set(nodeId, "");
    } else {
      outputsByNode.set(nodeId, inboundValues[0] ?? null);
    }
  }

  return Math.max(0, totalUsd * MARKUP_MULTIPLIER);
}

/** Cost for N runs. */
export function estimateWorkflowCostForRuns(graph: WorkflowGraph | null, runs: number): number {
  const perRun = estimateWorkflowRunCost(graph);
  return perRun * runs;
}

/** Get minimum price ($5 + cost for 10 runs). */
export function getMinimumWorkflowPrice(graph: WorkflowGraph | null): number {
  const cost10 = estimateWorkflowCostForRuns(graph, 10);
  return 5 + cost10;
}

/** Get recommended price (2.5x minimum, rounded to .99). */
export function getRecommendedWorkflowPrice(graph: WorkflowGraph | null): number {
  const min = getMinimumWorkflowPrice(graph);
  const rec = min * 2.5;
  const dollars = Math.floor(rec);
  return Math.max(min, dollars + 0.99);
}
