export type Port = {
    id: string;
    kind: "input" | "output";
  };
  
  export type InspectorField =
    | { key: string; label: string; type: "text"; placeholder?: string }
    | { key: string; label: string; type: "textarea"; rows?: number }
    | { key: string; label: string; type: "switch" }
    | { key: string; label: string; type: "select"; options: { label: string; value: string }[] };
  
  export type NodeSpec = {
    id: string;
    label: string;
    version?: string;
    summary?: string;
    category: string; // e.g. "core"
    // NEW: which ReactFlow node component to use; defaults to "edgCard"
    nodeType?: "edgCard" | "edgMerge";
    // ReactFlow ports (used by previews + “connected to”)
    ports: Port[];
    // default config (sent into node data.config)
    defaultConfig?: Record<string, any>;
    // Inspector fields shown when selected
    inspector?: InspectorField[];
  };
  