// src/nodes/input.ts
import type { NodeSpec } from "./types";

export const InputNode: NodeSpec = {
  id: "input",
  label: "Input",
  summary: "Accepts user / frontend data into the workflow.",
  category: "Core",
  version: "1.0.0",
  nodeType: "edgCard",

  ports: [
    {
      id: "data",
      kind: "output",
    },
  ],

  defaultConfig: {
    question: "",
    description: "",
    inputType: "text",
    options: [],
  },
};

export default InputNode;
