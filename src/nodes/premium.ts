// src/nodes/premium.ts
// Premium node specifications with comprehensive UI metadata
import type { NodeSpec } from "./types";

const makePort = (id: string, kind: "input" | "output", label?: string, type?: string) => ({
  id,
  kind,
  label,
  type,
});

export const PREMIUM_NODES: NodeSpec[] = [
  // OpenAI Chat
  {
    id: "openai-chat",
    label: "OpenAI Chat",
    version: "1.0.0",
    category: "ai",
    summary: "Generate text completions using OpenAI's GPT models with streaming support.",
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
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 2000,
      stream: false,
      safeMode: true,
      timeout: 30000,
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
        label: "Model (Premium)",
        type: "select",
        options: [
          { label: "GPT-4o mini — fast, cheap", value: "gpt-4o-mini" },
          { label: "GPT-4o — flagship", value: "gpt-4o" },
          { label: "GPT-4o (2024-08-06)", value: "gpt-4o-2024-08-06" },
          { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
          { label: "GPT-4 Turbo (preview)", value: "gpt-4-turbo-preview" },
          { label: "GPT-4", value: "gpt-4" },
          { label: "o1 — reasoning", value: "o1" },
          { label: "o1-mini — reasoning lite", value: "o1-mini" },
          { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
        ],
        helpText: "With your API key in the run modal, this model is used. Free runs use gpt-4o-mini.",
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
  // OpenAI Embeddings
  {
    id: "openai-embeddings",
    label: "OpenAI Embeddings",
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
        options: [
          { label: "text-embedding-3-small", value: "text-embedding-3-small" },
          { label: "text-embedding-3-large", value: "text-embedding-3-large" },
          { label: "text-embedding-ada-002", value: "text-embedding-ada-002" },
        ],
        helpText: "Embedding model to use",
      },
    ],
  },
  // OpenAI Image Generation
  {
    id: "openai-image",
    label: "OpenAI Image",
    version: "1.0.0",
    category: "ai",
    summary: "Generate images using DALL-E with size and quality controls.",
    nodeType: "edgCard",
    icon: "Image",
    requiresUserKeys: true,
    ports: [
      makePort("in", "input", "Prompt", "string"),
      makePort("out", "output", "Image URL", "string"),
    ],
    defaultConfig: {
      prompt: "",
      model: "dall-e-2", // Cheapest DALL-E model by default
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
          { label: "DALL-E 3", value: "dall-e-3" },
          { label: "DALL-E 2", value: "dall-e-2" },
        ],
      },
      {
        key: "size",
        label: "Size",
        type: "select",
        options: [
          { label: "1024x1024", value: "1024x1024" },
          { label: "1792x1024", value: "1792x1024" },
          { label: "1024x1792", value: "1024x1792" },
          { label: "512x512", value: "512x512" },
          { label: "256x256", value: "256x256" },
        ],
      },
      {
        key: "quality",
        label: "Quality",
        type: "select",
        options: [
          { label: "Standard", value: "standard" },
          { label: "HD", value: "hd" },
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
    summary: "Make HTTP requests with full control over method, headers, and body. Safe by default with host restrictions.",
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
      retries: 1,
      allowOnly: [],
      denyHosts: ["127.0.0.1", "localhost", "0.0.0.0"],
      followRedirects: true,
    },
    inlineToggles: [
      { key: "followRedirects", label: "Follow Redirects", icon: "ArrowRight" },
    ],
    inspector: [
      {
        key: "url",
        label: "URL",
        type: "text",
        placeholder: "https://api.example.com/endpoint",
        helpText: "Used when input is not connected. Keep it https.",
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
        helpText: "Describe the condition in plain English (e.g., 'The user's age is greater than 18'). AI will evaluate this. Leave empty to use operator-based evaluation.",
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
        helpText: "Used if human-readable condition is not provided. How should the condition be evaluated?",
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
