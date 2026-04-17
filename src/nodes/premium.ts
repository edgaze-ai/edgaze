// src/nodes/premium.ts
// Premium node specifications with comprehensive UI metadata
import type { NodeSpec } from "./types";
import {
  DEFAULT_LLM_CHAT_MODEL,
  DEFAULT_LLM_IMAGE_MODEL,
  LLM_CHAT_MODEL_OPTIONS,
  LLM_EMBEDDING_OPTIONS,
  LLM_IMAGE_ASPECT_OPTIONS,
  LLM_IMAGE_MODEL_OPTIONS,
} from "../lib/workflow/llm-model-catalog";

const makePort = (id: string, kind: "input" | "output", label?: string, type?: string) => ({
  id,
  kind,
  label,
  type,
});

export const PREMIUM_NODES: NodeSpec[] = [
  // LLM Chat (unified: OpenAI, Anthropic, Google — same node)
  {
    id: "llm-chat",
    label: "LLM Chat",
    version: "1.0.0",
    category: "ai",
    summary:
      "Generate text with GPT, Claude, or Gemini. Default is Claude Sonnet 4.6 for strong creator quality.",
    nodeType: "edgCard",
    icon: "Sparkles",
    requiresUserKeys: true,
    ports: [
      makePort("in", "input", "Input", "any"),
      makePort("out", "output", "Response", "string"),
    ],
    defaultConfig: {
      prompt: "",
      system: "",
      model: DEFAULT_LLM_CHAT_MODEL,
      temperature: 0.7,
      maxTokens: 2000,
      stream: true,
      safeMode: true,
      timeout: 120_000,
      retries: 2,
    },
    inlineToggles: [
      { key: "stream", label: "Stream", icon: "Zap" },
      { key: "safeMode", label: "Safe Mode", icon: "Shield" },
    ],
    inspector: [
      {
        key: "prompt",
        label: "Prompt (fallback)",
        type: "textarea",
        rows: 4,
        helpText: "Used when the node input is not connected. Keep it short and creator-friendly.",
      },
      {
        key: "system",
        label: "Style / System (optional)",
        type: "textarea",
        rows: 3,
        helpText: "Optional: sets tone and constraints.",
      },
      {
        key: "model",
        label: "Model",
        type: "select",
        options: LLM_CHAT_MODEL_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
        helpText:
          "Quality, cost ($ / $$ / $$$), and speed are shown per option. Pick the matching API key in the run modal (OpenAI, Claude, or Gemini).",
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "slider",
        min: 0,
        max: 2,
        step: 0.1,
        helpText: "Controls randomness (0 = deterministic, 2 = very creative)",
      },
      {
        key: "maxTokens",
        label: "Max Tokens",
        type: "number",
        min: 1,
        max: 16000,
        helpText: "Maximum tokens to generate",
      },
    ],
  },
  // LLM Embeddings (OpenAI)
  {
    id: "llm-embeddings",
    label: "LLM Embeddings",
    version: "1.0.0",
    category: "ai",
    summary: "Generate vector embeddings for text using OpenAI's embedding models.",
    nodeType: "edgCard",
    icon: "Layers",
    requiresUserKeys: true,
    ports: [
      makePort("in", "input", "Text", "string"),
      makePort("out", "output", "Embedding", "array"),
    ],
    defaultConfig: {
      text: "",
      model: "text-embedding-3-small",
      timeout: 15000,
      retries: 2,
    },
    inspector: [
      {
        key: "text",
        label: "Text (fallback)",
        type: "textarea",
        rows: 3,
        helpText: "Used when the node input is not connected.",
      },
      {
        key: "model",
        label: "Model",
        type: "select",
        options: LLM_EMBEDDING_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
        helpText:
          "Default is small (cheap, good for most RAG). Large is for premium memory workflows.",
      },
    ],
  },
  // LLM Image (Gemini + OpenAI image models; default Nano Banana 2)
  {
    id: "llm-image",
    label: "LLM Image",
    version: "1.0.0",
    category: "ai",
    summary:
      "Generate images with Gemini or OpenAI. Default is Nano Banana 2 (Gemini 3.1 Flash Image).",
    nodeType: "edgCard",
    icon: "Image",
    requiresUserKeys: true,
    ports: [
      makePort("in", "input", "Prompt", "string"),
      makePort("out", "output", "Image URL", "string"),
    ],
    defaultConfig: {
      prompt: "",
      model: DEFAULT_LLM_IMAGE_MODEL,
      aspectRatio: "1:1",
      quality: "medium",
      n: 1,
      timeout: 60000,
      retries: 2,
    },
    inspector: [
      {
        key: "prompt",
        label: "Prompt (fallback)",
        type: "textarea",
        rows: 3,
        helpText: "Used when the node input is not connected.",
      },
      {
        key: "model",
        label: "Model",
        type: "select",
        options: LLM_IMAGE_MODEL_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      },
      {
        key: "aspectRatio",
        label: "Aspect ratio",
        type: "select",
        options: LLM_IMAGE_ASPECT_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
        helpText:
          "Gemini uses this directly. OpenAI maps each ratio to the nearest supported output shape (square, landscape, or portrait).",
      },
      {
        key: "quality",
        label: "Quality",
        type: "select",
        options: [
          { label: "Low", value: "low" },
          { label: "Medium", value: "medium" },
          { label: "High", value: "high" },
        ],
        helpText: "OpenAI image models only (low / medium / high). Ignored for Gemini.",
      },
    ],
  },
  // HTTP Request
  {
    id: "http-request",
    label: "HTTP Request",
    version: "1.0.0",
    category: "http",
    summary:
      "Make HTTP requests with full control over method, headers, and body. Safe by default with host restrictions.",
    nodeType: "edgCard",
    icon: "Globe",
    requiresUserKeys: false,
    ports: [
      makePort("in", "input", "Request", "any"),
      makePort("out", "output", "Response", "object"),
    ],
    defaultConfig: {
      url: "",
      method: "GET",
      timeout: 30000,
      retries: 0,
      allowOnly: [],
      denyHosts: ["127.0.0.1", "localhost", "0.0.0.0"],
      followRedirects: true,
      hasSideEffects: false,
    },
    inlineToggles: [{ key: "followRedirects", label: "Follow Redirects", icon: "ArrowRight" }],
    inspector: [
      {
        key: "url",
        label: "URL",
        type: "text",
        placeholder: "https://api.example.com/endpoint",
        helpText:
          "Used when nothing is connected, or as fallback. You can connect Input (URL in the value field) or an object with url / headers / body. HTTPS URLs only for public APIs.",
      },
      {
        key: "method",
        label: "Method",
        type: "select",
        options: [
          { label: "GET", value: "GET" },
          { label: "POST", value: "POST" },
          { label: "PUT", value: "PUT" },
          { label: "PATCH", value: "PATCH" },
          { label: "DELETE", value: "DELETE" },
        ],
      },
      {
        key: "allowOnly",
        label: "Allowed Hosts (comma-separated)",
        type: "text",
        placeholder: "api.example.com,cdn.example.com",
        helpText: "If set, only these hosts are allowed. Empty = no restriction.",
      },
      {
        key: "denyHosts",
        label: "Denied Hosts (comma-separated)",
        type: "text",
        placeholder: "localhost,127.0.0.1",
        helpText: "These hosts will be blocked for security.",
      },
      {
        key: "hasSideEffects",
        label: "Require idempotency (POST/PUT/PATCH)",
        type: "switch",
        helpText:
          "Enable only when you need retry-safe writes. When on, set Idempotency key below or pass idempotencyKey on an inbound object.",
      },
      {
        key: "idempotencyKey",
        label: "Idempotency key",
        type: "text",
        placeholder: "stable-key-per-operation",
        helpText: "Required when the switch above is on for POST, PUT, or PATCH.",
      },
    ],
  },
  // JSON Parse
  {
    id: "json-parse",
    label: "JSON Parse",
    version: "1.0.0",
    category: "utility",
    summary: "Parse JSON strings into objects with error handling.",
    nodeType: "edgCard",
    icon: "Code",
    requiresUserKeys: false,
    ports: [
      makePort("input", "input", "JSON String", "string"),
      makePort("output", "output", "Parsed Object", "any"),
    ],
    defaultConfig: {},
    inspector: [],
  },
  // Condition/Switch (special diamond shape)
  {
    id: "condition",
    label: "Condition",
    version: "1.0.0",
    category: "utility",
    summary:
      "Branch true/false using a fast AI check (gpt-4o-mini). Operator and optional text define what to evaluate.",
    nodeType: "edgCondition", // Y-shaped condition node
    icon: "GitBranch",
    requiresUserKeys: true,
    ports: [
      makePort("input", "input", "Value", "any"),
      makePort("true", "output", "True Branch", "any"),
      makePort("false", "output", "False Branch", "any"),
    ],
    defaultConfig: {
      operator: "truthy",
      compareValue: "",
      humanCondition: "", // Human-readable condition for AI evaluation
    },
    inspector: [
      {
        key: "humanCondition",
        label: "Condition (Human Language)",
        type: "textarea",
        rows: 2,
        helpText:
          'Optional extra rule in plain English, combined with the condition type below. Example: "The user explicitly agreed".',
        placeholder: "e.g., The answer matches the question intent",
      },
      {
        key: "operator",
        label: "Condition Type",
        type: "select",
        options: [
          { label: "Truthy", value: "truthy" },
          { label: "Falsy", value: "falsy" },
          { label: "Equals", value: "equals" },
          { label: "Not Equals", value: "notEquals" },
          { label: "Greater Than", value: "gt" },
          { label: "Less Than", value: "lt" },
        ],
        helpText:
          "How the AI should decide true vs false (truthy, equals, etc.). Uses your OpenAI key or Edgaze free-run key.",
      },
      {
        key: "compareValue",
        label: "Compare Value",
        type: "text",
        placeholder: "Enter value to compare against",
        helpText: "Required for equals, not equals, greater than, and less than operators",
      },
    ],
  },
  // Delay/Wait
  {
    id: "delay",
    label: "Delay",
    version: "1.0.0",
    category: "utility",
    summary: "Wait for a specified duration before continuing execution.",
    nodeType: "edgCard",
    icon: "Clock",
    requiresUserKeys: false,
    ports: [
      makePort("input", "input", "Input", "any"),
      makePort("output", "output", "Output", "any"),
    ],
    defaultConfig: {
      duration: 1000,
    },
    inspector: [
      {
        key: "duration",
        label: "Duration (ms)",
        type: "number",
        min: 0,
        max: 600000,
        helpText: "Delay duration in milliseconds",
      },
    ],
  },
  // Loop (ForEach)
  {
    id: "loop",
    label: "Loop",
    version: "1.0.0",
    category: "utility",
    summary: "Iterate over an array and execute downstream nodes for each item.",
    nodeType: "edgCard",
    icon: "Repeat",
    requiresUserKeys: false,
    ports: [
      makePort("array", "input", "Array", "array"),
      makePort("item", "output", "Current Item", "any"),
      makePort("index", "output", "Current Index", "number"),
    ],
    defaultConfig: {
      maxIterations: 1000,
    },
    inspector: [
      {
        key: "maxIterations",
        label: "Max Iterations",
        type: "number",
        min: 1,
        max: 10000,
        helpText: "Maximum number of iterations to prevent infinite loops",
      },
    ],
  },
];
