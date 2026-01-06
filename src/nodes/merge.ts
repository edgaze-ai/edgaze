// src/nodes/merge.ts
import type { NodeSpec } from "./types";

const mergeSpec: NodeSpec = {
  id: "merge",
  label: "Merge",
  summary: "Combines multiple data streams into one unified output.",
  category: "Core",
  version: "1.0.0",
  nodeType: "edgCard",

  ports: [
    { id: "in-left", kind: "input" },
    { id: "in-top", kind: "input" },
    { id: "in-bottom", kind: "input" },
    { id: "out-right", kind: "output" },
  ],

  defaultConfig: {
    strategy: "concat",
    dedupe: false,
    maxItems: 1000,

    // keep these if your runtime uses them; harmless as config
    tag: "",
    emitNulls: false,
    timeoutMs: 0,
    buffer: 0,
    flushOnEnd: false,
    trace: false,
    notes: "",
  },
};

export default mergeSpec;
