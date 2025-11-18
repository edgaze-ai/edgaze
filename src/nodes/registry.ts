// Simple in-memory node registry used by BlockLibrary + Canvas
import type { NodeSpec, Port } from "./types";

const makePort = (id: string, kind: "input" | "output"): Port => ({ id, kind });

const SPECS: NodeSpec[] = [
  {
    id: "input",
    label: "Input",
    version: "1.0.0",
    summary: "Accepts user input or frontend data into the flow.",
    nodeType: "edgCard",
    ports: [makePort("out", "output")],
    defaultConfig: {},
  },
  {
    id: "output",
    label: "Output",
    version: "1.0.0",
    summary: "Displays or returns data to the frontend.",
    nodeType: "edgCard",
    ports: [makePort("in", "input")],
    defaultConfig: {},
  },
  {
    id: "merge",
    label: "Merge",
    version: "1.0.0",
    summary: "Combines multiple data streams into one unified output.",
    // Use the dedicated Merge node with four fixed handles (one per side)
    nodeType: "edgMerge",
    ports: [
      makePort("in-left", "input"),
      makePort("in-top", "input"),
      makePort("in-bottom", "input"),
      makePort("out-right", "output"),
    ],
    defaultConfig: {},
  },
];

export function listNodeSpecs(): NodeSpec[] {
  return SPECS;
}

export function getNodeSpec(id: string): NodeSpec | undefined {
  return SPECS.find((s) => s.id === id);
}
