import { NodeSpec } from "./types";

export const OutputNode: NodeSpec = {
  id: "output",
  name: "Output",
  description: "Displays or returns data to the frontend.",
  category: "Core",
  icon: "output",
  color: "#ec4899",
  inputs: ["data"],
  outputs: [],
  properties: [
    { key: "nickname", label: "Nickname", type: "text", description: "Frontend alias for this output." },
    { key: "format", label: "Display Format", type: "select", options: ["text", "html", "json"], default: "text" },
    { key: "theme", label: "Theme", type: "select", options: ["light", "dark", "auto"], default: "auto" },
    { key: "showTitle", label: "Show Title", type: "boolean", default: true },
    { key: "title", label: "Title", type: "text" },
    { key: "animation", label: "Animate Output", type: "boolean", default: false },
    { key: "delay", label: "Delay (ms)", type: "number", default: 0 },
    { key: "maxLines", label: "Max Lines", type: "number", default: 5 },
    { key: "truncate", label: "Truncate Output", type: "boolean", default: false },
    { key: "visible", label: "Visible", type: "boolean", default: true },
  ],
};
