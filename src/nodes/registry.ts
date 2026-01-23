// src/nodes/registry.ts
// Simple in-memory node registry used by BlockLibrary + Canvas
import type { NodeSpec, Port } from "./types";
import { PREMIUM_NODES } from "./premium";

const makePort = (id: string, kind: "input" | "output", label?: string, type?: string): Port => ({
  id,
  kind,
  label,
  type,
});

const CORE_SPECS: NodeSpec[] = [
  {
    id: "input",
    label: "Workflow Input",
    version: "1.0.0",
    category: "core",
    summary: "Entry point for workflow data. Define what data your workflow accepts.",
    nodeType: "edgCard",
    icon: "ArrowRight",
    ports: [
      makePort("out-right", "output", "Data", "any"), // Right side for horizontal flow
    ],
    defaultConfig: {
      name: "Input",
      description: "Workflow entry point",
      required: true,
    },
    inspector: [
      {
        key: "name",
        label: "Input Name",
        type: "text",
        placeholder: "e.g., User Message, Image URL",
        helpText: "What data does this workflow accept?",
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        rows: 2,
        helpText: "Describe what this input is for",
      },
    ],
  },
  {
    id: "output",
    label: "Workflow Output",
    version: "1.0.0",
    category: "core",
    summary: "Final result of your workflow. Shows what will be returned.",
    nodeType: "edgCard",
    icon: "ArrowLeft",
    ports: [
      makePort("in-left", "input", "Result", "any"), // Left side for horizontal flow
    ],
    defaultConfig: {
      name: "Output",
      format: "json",
    },
    inspector: [
      {
        key: "name",
        label: "Output Name",
        type: "text",
        placeholder: "e.g., Generated Content, Processed Data",
      },
      {
        key: "format",
        label: "Output Format",
        type: "select",
        options: [
          { label: "JSON", value: "json" },
          { label: "Text", value: "text" },
          { label: "HTML", value: "html" },
        ],
      },
    ],
  },
  {
    id: "merge",
    label: "Merge",
    version: "1.0.0",
    category: "core",
    summary: "Combines multiple data streams into one unified output.",
    // Use the dedicated Merge node with four fixed handles (one per side)
    nodeType: "edgMerge",
    icon: "Merge",
    ports: [
      makePort("in-left", "input"),
      makePort("in-top", "input"),
      makePort("in-bottom", "input"),
      makePort("out-right", "output"),
    ],
    defaultConfig: {},
    inspector: [],
  },
];

const ALL_SPECS: NodeSpec[] = [...CORE_SPECS, ...PREMIUM_NODES];

export function listNodeSpecs(): NodeSpec[] {
  return ALL_SPECS;
}

export function getNodeSpec(id: string): NodeSpec | undefined {
  return ALL_SPECS.find((s) => s.id === id);
}

export function listNodeSpecsByCategory(): Record<string, NodeSpec[]> {
  const byCategory: Record<string, NodeSpec[]> = {};
  for (const spec of ALL_SPECS) {
    if (!byCategory[spec.category]) {
      byCategory[spec.category] = [];
    }
    const categoryArray = byCategory[spec.category]!;
    categoryArray.push(spec);
  }
  return byCategory;
}
