// src/nodes/NODE_REGISTRY.ts
// Node metadata for UI: label, category, color, icon
// Used by BaseNode and NodeHandle. Ports/inspector come from registry.ts + premium.ts.

import { canonicalSpecId } from "@lib/workflow/spec-id-aliases";

export const NODE_REGISTRY: Record<
  string,
  { label: string; category: string; color: string; icon: string; iconImage?: string }
> = {
  input: {
    label: "Workflow Input",
    category: "io",
    color: "#3b82f6",
    icon: "ArrowRight",
  },
  output: {
    label: "Workflow Output",
    category: "io",
    color: "#3b82f6",
    icon: "ArrowLeft",
  },
  merge: {
    label: "Merge",
    category: "logic",
    color: "#f59e0b",
    icon: "GitMerge",
  },
  condition: {
    label: "Condition",
    category: "logic",
    color: "#f59e0b",
    icon: "GitBranch",
  },
  delay: {
    label: "Delay",
    category: "logic",
    color: "#f59e0b",
    icon: "Timer",
  },
  loop: {
    label: "Loop",
    category: "logic",
    color: "#f59e0b",
    icon: "Repeat",
  },
  "llm-chat": {
    label: "LLM Chat",
    category: "ai",
    color: "#8b5cf6",
    icon: "MessageSquare",
  },
  "llm-embeddings": {
    label: "LLM Embeddings",
    category: "ai",
    color: "#8b5cf6",
    icon: "Braces",
  },
  "llm-image": {
    label: "LLM Image",
    category: "ai",
    color: "#8b5cf6",
    icon: "Image",
  },
  "http-request": {
    label: "HTTP Request",
    category: "utility",
    color: "#14b8a6",
    icon: "Globe",
  },
  "json-parse": {
    label: "JSON Parse",
    category: "utility",
    color: "#14b8a6",
    icon: "Braces",
  },
  template: {
    label: "Template",
    category: "utility",
    color: "#14b8a6",
    icon: "FileText",
  },
};

export function getNodeRegistryEntry(specId: string) {
  const canonical = canonicalSpecId(specId);
  return NODE_REGISTRY[specId] ?? NODE_REGISTRY[canonical];
}
