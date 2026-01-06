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
    nickname: "",
    inputType: "text",
    placeholder: "",
    required: true,
    maxLength: null,
    defaultValue: "",
    helpText: "",
    validationRegex: "",
    visibility: true,
    theme: "default",
  },
};

export default InputNode;
