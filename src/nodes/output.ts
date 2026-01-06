// src/nodes/output.ts
import type { NodeSpec } from "./types";

export const OutputNode: NodeSpec = {
  id: "output",
  label: "Output",
  summary: "Displays or returns data to the frontend.",
  category: "Core",
  version: "1.0.0",
  nodeType: "edgCard",

  // Output nodes only ACCEPT data (no outbound edges)
  ports: [
    {
      id: "data",
      kind: "input",
    },
  ],

  // Stored configuration only — UI/runtime can interpret freely
  defaultConfig: {
    nickname: "",
    format: "text", // text | html | json
    theme: "auto", // light | dark | auto
    showTitle: true,
    title: "",
    animation: false,
    delay: 0,
    maxLines: 5,
    truncate: false,
    visible: true,
  },
};

export default OutputNode;
