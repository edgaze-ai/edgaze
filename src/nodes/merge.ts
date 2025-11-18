import type { NodeSpec } from "src/nodes/types";

const mergeSpec: NodeSpec = {
  id: "merge",
  label: "Merge",
  version: "1.0.0",
  category: "core",
  summary: "Combines multiple data streams into one unified output.",
  defaultConfig: {
    strategy: "concat",
    dedupe: false,
    maxItems: 1000,
  },
  ports: [
    { id: "in-left",   kind: "input",  label: "In L",  placement: "left-middle" },
    { id: "in-top",    kind: "input",  label: "In T",  placement: "top-center" },
    { id: "in-bottom", kind: "input",  label: "In B",  placement: "bottom-center" },
    { id: "out-right", kind: "output", label: "Out",   placement: "right-middle", highlight: "edgaze" },
  ],
  inspector: [
    { key: "strategy", label: "Merge strategy", type: "select", options: ["concat","zip","latest-wins"] },
    { key: "dedupe", label: "Remove duplicates", type: "boolean" },
    { key: "maxItems", label: "Max items", type: "number", min: 1, max: 100000 },
    { key: "tag", label: "Tag (optional)", type: "text", placeholder: "analytics" },
    { key: "emitNulls", label: "Emit nulls", type: "boolean" },
    { key: "timeoutMs", label: "Timeout (ms)", type: "number", min: 0, max: 600000 },
    { key: "buffer", label: "Buffer size", type: "number", min: 0, max: 10000 },
    { key: "flushOnEnd", label: "Flush on end", type: "boolean" },
    { key: "trace", label: "Enable tracing", type: "boolean" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
};

export default mergeSpec;
