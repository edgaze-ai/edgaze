// src/nodes/premium.ts
// Premium node specifications with comprehensive UI metadata
import type { NodeSpec } from "./types";
import {
  DEFAULT_LLM_CHAT_MODEL,
  DEFAULT_LLM_IMAGE_MODEL,
  LLM_CHAT_MODEL_OPTIONS,
  LLM_EMBEDDING_OPTIONS,
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
      "Generate text with GPT, Claude, or Gemini. Default is Claude 3.7 Sonnet for strong creator quality.",
    nodeType: "edgCard",
    icon: "Sparkles",
    requiresUserKeys: true,
    ports: [
      makePort("in", "input", "Input", "any"),
      makePort("out", "output", "Response", "object"),
    ],
    defaultConfig: {
      prompt: "",
      system: "",
      model: DEFAULT_LLM_CHAT_MODEL,
      temperature: 0.7,
      maxTokens: 2000,
      stream: false,
      safeMode: true,
      timeout: 60000,
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
  // Claude Chat (Anthropic)
  {
    id: "claude-chat",
    label: "Claude Chat",
    version: "1.0.0",
    category: "ai",
    summary: "Generate text with Anthropic Claude. Defaults to Claude 3.7 Sonnet for quality.",
    nodeType: "edgCard",
    icon: "Sparkles",
    requiresUserKeys: true,
    ports: [
      makePort("in", "input", "Input", "any"),
      makePort("out", "output", "Response", "object"),
    ],
    defaultConfig: {
      prompt: "",
      system: "",
      model: "claude-3-7-sonnet-20250219",
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 60000,
      retries: 2,
    },
    inspector: [
      {
        key: "prompt",
        label: "Prompt (fallback)",
        type: "textarea",
        rows: 4,
        helpText: "Used when the node input is not connected.",
      },
      {
        key: "system",
        label: "Style / System (optional)",
        type: "textarea",
        rows: 3,
        helpText: "Optional tone and constraints.",
      },
      {
        key: "model",
        label: "Model",
        type: "select",
        options: [
          {
            label: "Claude 3.7 Sonnet — Recommended ⭐ · High quality",
            value: "claude-3-7-sonnet-20250219",
          },
          {
            label: "Claude 3.5 Haiku — Fast · $",
            value: "claude-3-5-haiku-20241022",
          },
          {
            label: "Claude 3.5 Sonnet — Balanced · $$",
            value: "claude-3-5-sonnet-20241022",
          },
          {
            label: "Claude 3 Opus — Premium · $$$",
            value: "claude-3-opus-20240229",
          },
        ],
        helpText: "Defaults favor output quality. Use Haiku for cheaper runs.",
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "slider",
        min: 0,
        max: 1,
        step: 0.1,
        helpText: "Randomness (0 = more deterministic)",
      },
      {
        key: "maxTokens",
        label: "Max output tokens",
        type: "number",
        min: 1,
        max: 8192,
        helpText: "Caps response length and cost.",
      },
    ],
  },
  // Gemini Chat (Google)
  {
    id: "gemini-chat",
    label: "Gemini Chat",
    version: "1.0.0",
    category: "ai",
    summary:
      "Generate text with Google Gemini. Defaults to 2.5 Flash for speed; Pro for harder tasks.",
    nodeType: "edgCard",
    icon: "Sparkles",
    requiresUserKeys: true,
    ports: [
      makePort("in", "input", "Input", "any"),
      makePort("out", "output", "Response", "object"),
    ],
    defaultConfig: {
      prompt: "",
      system: "",
      model: "gemini-2.5-flash",
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 60000,
      retries: 2,
    },
    inspector: [
      {
        key: "prompt",
        label: "Prompt (fallback)",
        type: "textarea",
        rows: 4,
        helpText: "Used when the node input is not connected.",
      },
      {
        key: "system",
        label: "Style / System (optional)",
        type: "textarea",
        rows: 3,
        helpText: "Optional tone and constraints.",
      },
      {
        key: "model",
        label: "Model",
        type: "select",
        options: [
          {
            label: "Gemini 2.5 Pro (latest) · High · $$$",
            value: "gemini-2.5-pro-preview-05-06",
          },
          { label: "Gemini 2.5 Flash · Fast · $", value: "gemini-2.5-flash" },
          { label: "Gemini 2.0 Flash — legacy", value: "gemini-2.0-flash" },
        ],
        helpText: "Flash models are cheaper; Pro is for harder tasks.",
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "slider",
        min: 0,
        max: 2,
        step: 0.1,
        helpText: "Controls randomness",
      },
      {
        key: "maxTokens",
        label: "Max output tokens",
        type: "number",
        min: 1,
        max: 8192,
        helpText: "Caps response length and cost.",
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
  // LLM Image (Gemini Nano Banana + OpenAI; default Nano Banana 2)
  {
    id: "llm-image",
    label: "LLM Image",
    version: "1.0.0",
    category: "ai",
    summary:
      "Generate images with Nano Banana (Gemini) or GPT-image / DALL·E. Default is Nano Banana 2 for fast, strong results.",
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
      size: "1024x1024",
      quality: "standard",
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
        options: [
          ...LLM_IMAGE_MODEL_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
          { label: "DALL-E 3", value: "dall-e-3" },
          { label: "DALL-E 2", value: "dall-e-2" },
        ],
      },
      {
        key: "size",
        label: "Size (OpenAI / DALL·E)",
        type: "select",
        options: [
          { label: "1024x1024", value: "1024x1024" },
          { label: "1792x1024", value: "1792x1024" },
          { label: "1024x1792", value: "1024x1792" },
          { label: "1536x1024 (GPT)", value: "1536x1024" },
          { label: "1024x1536 (GPT)", value: "1024x1536" },
          { label: "512x512", value: "512x512" },
          { label: "256x256", value: "256x256" },
        ],
      },
      {
        key: "quality",
        label: "Quality (DALL·E 3 / GPT-image)",
        type: "select",
        options: [
          { label: "Standard", value: "standard" },
          { label: "HD / high", value: "hd" },
        ],
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
    summary: "Conditional branching based on input values. Routes to true/false outputs.",
    nodeType: "edgCondition", // Y-shaped condition node
    icon: "GitBranch",
    requiresUserKeys: false,
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
          "Describe the condition in plain English (e.g., 'The user's age is greater than 18'). AI will evaluate this. Leave empty to use operator-based evaluation.",
        placeholder: "e.g., The input contains the word 'approved'",
      },
      {
        key: "operator",
        label: "Condition Type (Fallback)",
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
          "Used if human-readable condition is not provided. How should the condition be evaluated?",
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
