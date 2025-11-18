export type GraphNode = {
    id: string;
    data: {
      specId: string;
      config?: any;
      title?: string;
    };
  };
  
  export type GraphEdge = {
    id?: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  };
  
  export type GraphPayload = {
    nodes: GraphNode[];
    edges: GraphEdge[];
    inputs?: Record<string, unknown>;
  };
  
  export type RuntimeContext = {
    getInboundValues: (nodeId: string) => unknown[];
    setNodeOutput: (nodeId: string, value: unknown) => void;
    inputs: Record<string, unknown>;
  };
  
  export type NodeRuntimeHandler = (
    node: GraphNode,
    ctx: RuntimeContext
  ) => Promise<unknown> | unknown;
  
  export type RunLogEntry = {
    type: "start" | "success" | "error";
    nodeId: string;
    specId: string;
    message: string;
    timestamp: number; // ms epoch
  };
  
  export type RuntimeResult = {
    outputsByNode: Record<string, unknown>;
    finalOutputs: { nodeId: string; value: unknown }[];
    logs: RunLogEntry[];
    nodeStatus: Record<string, "idle" | "running" | "success" | "error">;
  };
  