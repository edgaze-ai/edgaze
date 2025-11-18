import { NodeSpec } from "./types";

export const InputNode: NodeSpec = {
  id: "input",
  name: "Input",
  description: "Accepts user / frontend data into the workflow.",
  category: "Core",
  icon: "input",
  color: "#22d3ee",
  inputs: [],
  outputs: ["data"],
  properties: [
    { key: "nickname", label: "Nickname", type: "text", description: "Frontend alias for this input." },
    { key: "type", label: "Input Type", type: "select", options: ["text", "file", "json"], default: "text" },
    { key: "placeholder", label: "Placeholder", type: "text" },
    { key: "required", label: "Required", type: "boolean", default: true },
    { key: "maxLength", label: "Max Length", type: "number" },
    { key: "defaultValue", label: "Default Value", type: "text" },
    { key: "helpText", label: "Help Text", type: "text" },
    { key: "validationRegex", label: "Validation Regex", type: "text" },
    { key: "visibility", label: "Visible", type: "boolean", default: true },
    { key: "theme", label: "Theme Style", type: "select", options: ["default", "accent"], default: "default" },
  ],
};
