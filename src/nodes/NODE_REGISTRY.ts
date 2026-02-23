// src/nodes/NODE_REGISTRY.ts
// Node metadata for UI: label, category, color, icon
// Used by BaseNode and NodeHandle. Ports/inspector come from registry.ts + premium.ts.

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
  "openai-chat": {
    label: "OpenAI Chat",
    category: "ai",
    color: "#8b5cf6",
    icon: "MessageSquare",
    iconImage: "/misc/chatgpt-white.png",
  },
  "openai-embeddings": {
    label: "OpenAI Embeddings",
    category: "ai",
    color: "#8b5cf6",
    icon: "Braces",
    iconImage: "/misc/chatgpt-white.png",
  },
  "openai-image": {
    label: "OpenAI Image",
    category: "ai",
    color: "#8b5cf6",
    icon: "Image",
    iconImage: "/misc/chatgpt-white.png",
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
  return NODE_REGISTRY[specId];
}
