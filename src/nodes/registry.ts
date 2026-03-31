// src/nodes/registry.ts
// Simple in-memory node registry used by BlockLibrary + Canvas
import type { NodeSpec, Port } from "./types";
import { PREMIUM_NODES } from "./premium";
import { canonicalSpecId } from "@lib/workflow/spec-id-aliases";

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
      question: "",
      description: "",
      inputType: "text",
      options: [],
    },
    inspector: [
      {
        key: "question",
        label: "Question",
        type: "textarea",
        rows: 2,
        helpText:
          "What should the user answer? Write a clear question (e.g., “What message should I send?”).",
      },
      {
        key: "inputType",
        label: "Input Type",
        type: "select",
        options: [
          { label: "Text", value: "text" },
          { label: "Long Paragraph", value: "textarea" },
          { label: "Number", value: "number" },
          { label: "URL", value: "url" },
          { label: "Dropdown", value: "dropdown" },
          { label: "File Upload (up to 5MB)", value: "file" },
          { label: "JSON", value: "json" },
        ],
        helpText: "How the input should be collected from the user.",
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        rows: 2,
        helpText:
          "Optional context shown under the question (constraints, format, examples, what you’ll do with the answer).",
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
    nodeType: "edgMerge",
    icon: "Merge",
    ports: [
      makePort("in-1", "input", "in 1"),
      makePort("in-2", "input", "in 2"),
      makePort("in-3", "input", "in 3"),
      makePort("out", "output", "Data"),
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
  const canonical = canonicalSpecId(id);
  return ALL_SPECS.find((s) => s.id === id) ?? ALL_SPECS.find((s) => s.id === canonical);
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
