// src/nodes/NODE_REGISTRY.ts
// Node metadata for UI: label, category, icon, accentColor, description, tags, defaultConfig
// Used by BaseNode and related components. Ports/inspector come from registry.ts.

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowLeft,
  Merge,
  GitBranch,
  Clock,
  Repeat,
  Sparkles,
  Layers,
  Image,
  Globe,
  Code,
  FileText,
  List,
  Box,
} from "lucide-react";

export type NodeRegistryEntry = {
  label: string;
  category: "io" | "logic" | "ai" | "utility";
  icon: LucideIcon;
  accentColor: string; // hex for borders/shadows
  description: string;
  defaultConfig: Record<string, unknown>;
  /** Tags shown as pills (e.g. "Stream", "Safe Mode") — key in config to check */
  tags?: { key: string; label: string }[];
};

const IO_COLOR = "#3b82f6";
const AI_COLOR = "#8b5cf6";
const LOGIC_COLOR = "#f59e0b";
const UTILITY_COLOR = "#14b8a6";

export const NODE_REGISTRY: Record<string, NodeRegistryEntry> = {
  input: {
    label: "Workflow Input",
    category: "io",
    icon: ArrowRight,
    accentColor: IO_COLOR,
    description: "Reads from ctx.inputs or config default",
    defaultConfig: {
      name: "Input",
      question: "",
      inputType: "text",
      description: "",
      required: true,
      maxFileSize: 5,
    },
  },
  output: {
    label: "Workflow Output",
    category: "io",
    icon: ArrowLeft,
    accentColor: IO_COLOR,
    description: "Formats upstream data as JSON/text",
    defaultConfig: {
      name: "Output",
      format: "json",
    },
  },
  merge: {
    label: "Merge",
    category: "logic",
    icon: Merge,
    accentColor: LOGIC_COLOR,
    description: "Combines multiple inputs into one string",
    defaultConfig: {},
  },
  "merge-json": {
    label: "Merge JSON",
    category: "utility",
    icon: Merge,
    accentColor: UTILITY_COLOR,
    description: "Merge multiple JSON objects into one",
    defaultConfig: {},
  },
  condition: {
    label: "Condition",
    category: "logic",
    icon: GitBranch,
    accentColor: LOGIC_COLOR,
    description: "Evaluates truthy/falsy/AI conditions",
    defaultConfig: {
      operator: "truthy",
      compareValue: "",
      humanCondition: "",
    },
  },
  delay: {
    label: "Delay",
    category: "logic",
    icon: Clock,
    accentColor: LOGIC_COLOR,
    description: "Waits a set duration",
    defaultConfig: {
      duration: 1000,
    },
  },
  loop: {
    label: "Loop",
    category: "logic",
    icon: Repeat,
    accentColor: LOGIC_COLOR,
    description: "Passes arrays through iteration",
    defaultConfig: {
      maxIterations: 1000,
    },
  },
  "openai-chat": {
    label: "OpenAI Chat",
    category: "ai",
    icon: Sparkles,
    accentColor: AI_COLOR,
    description: "Sends prompt to OpenAI Chat API",
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
    tags: [
      { key: "stream", label: "Stream" },
      { key: "safeMode", label: "Safe Mode" },
    ],
  },
  "openai-embeddings": {
    label: "OpenAI Embeddings",
    category: "ai",
    icon: Layers,
    accentColor: AI_COLOR,
    description: "Gets vector embeddings from OpenAI",
    defaultConfig: {
      text: "",
      model: "text-embedding-3-small",
      timeout: 15000,
      retries: 2,
    },
  },
  "openai-image": {
    label: "OpenAI Image",
    category: "ai",
    icon: Image,
    accentColor: AI_COLOR,
    description: "Generates images via DALL-E",
    defaultConfig: {
      prompt: "",
      model: "dall-e-2",
      size: "1024x1024",
      quality: "standard",
      n: 1,
      timeout: 60000,
      retries: 2,
    },
  },
  "http-request": {
    label: "HTTP Request",
    category: "utility",
    icon: Globe,
    accentColor: UTILITY_COLOR,
    description: "External HTTP calls with SSRF checks",
    defaultConfig: {
      url: "",
      method: "GET",
      timeout: 30000,
      retries: 1,
      allowOnly: [],
      denyHosts: ["127.0.0.1", "localhost", "0.0.0.0"],
      followRedirects: true,
      hasSideEffects: false,
      idempotencyKey: "",
    },
    tags: [{ key: "followRedirects", label: "Follow Redirects" }],
  },
  "json-parse": {
    label: "JSON Parse",
    category: "utility",
    icon: Code,
    accentColor: UTILITY_COLOR,
    description: "Parses and validates JSON strings",
    defaultConfig: {},
  },
  template: {
    label: "Template",
    category: "utility",
    icon: FileText,
    accentColor: UTILITY_COLOR,
    description: "Format string with {{placeholders}}",
    defaultConfig: {
      template: "Hello {{name}}!",
    },
  },
  map: {
    label: "Map",
    category: "utility",
    icon: List,
    accentColor: UTILITY_COLOR,
    description: "Transform each item in an array",
    defaultConfig: {
      template: "{{value}}",
    },
  },
};

export function getNodeRegistryEntry(specId: string): NodeRegistryEntry | undefined {
  return NODE_REGISTRY[specId];
}
