export type Port = {
    id: string;
    kind: "input" | "output";
    label?: string;
    type?: string;
  };
  
  export type InspectorField =
    | { key: string; label: string; type: "text"; placeholder?: string; helpText?: string }
    | { key: string; label: string; type: "textarea"; rows?: number; helpText?: string }
    | { key: string; label: string; type: "switch"; helpText?: string }
    | { key: string; label: string; type: "select"; options: { label: string; value: string }[]; helpText?: string }
    | { key: string; label: string; type: "number"; min?: number; max?: number; step?: number; helpText?: string }
    | { key: string; label: string; type: "slider"; min: number; max: number; step?: number; helpText?: string };
  
  export type NodeInlineToggle = {
    key: string;
    label: string;
    icon?: string;
  };
  
  export type NodeSpec = {
    id: string;
    label: string;
    version?: string;
    summary?: string;
    category: string; // e.g. "core", "ai", "http", "utility"
    // NEW: which ReactFlow node component to use; defaults to "edgCard"
    nodeType?: "edgCard" | "edgMerge" | "edgCondition";
    // ReactFlow ports (used by previews + "connected to")
    ports: Port[];
    // default config (sent into node data.config)
    defaultConfig?: Record<string, any>;
    // Inspector fields shown when selected
    inspector?: InspectorField[];
    // Inline toggles that appear on the node card itself (for premium feel)
    inlineToggles?: NodeInlineToggle[];
    // Whether this node requires user-provided API keys (for BYO enforcement)
    requiresUserKeys?: boolean;
    // Icon for the node (lucide-react icon name)
    icon?: string;
  // Optional: render a few creator-friendly controls directly on the node (canvas)
  canvasFields?: InspectorField[];
  };
  