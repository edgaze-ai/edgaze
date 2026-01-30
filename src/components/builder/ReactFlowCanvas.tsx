// src/components/builder/ReactFlowCanvas.tsx
"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeChange,
  NodeProps,
  OnConnect,
  Position,
  ReactFlowInstance,
  Viewport,
  useEdgesState,
  useNodesState,
  EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { getNodeSpec } from "src/nodes/registry";
import type { NodeSpec, Port } from "src/nodes/types";
import MergeNode from "./nodes/MergeNode";
import ConditionNode from "./nodes/ConditionNode";
import NodeFrame from "./nodes/NodeFrame";
import { emit, on } from "../../lib/bus";
import { track } from "../../lib/mixpanel";
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Grid3X3,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Trash2,
} from "lucide-react";

type EdgazeNodeData = {
  specId: string;
  title: string;
  version: string;
  summary: string;
  config: any;
  icon?: string;
  connectedNames: string[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeTrack(event: string, props?: Record<string, any>) {
  try {
    track(event, props);
  } catch {
    // never block builder UX on analytics
  }
}

/* ---------- Selection ring (for edgCard nodes) ---------- */
function SelectionRing() {
  return (
    <div
      className="pointer-events-none absolute -inset-[7px] rounded-[18px]"
      style={
        {
          background:
            "linear-gradient(120deg, rgba(94,240,255,0.9), rgba(168,85,247,0.95), rgba(255,111,216,0.9))",
          padding: 2.5,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          boxShadow:
            "0 0 24px rgba(94,240,255,0.35), 0 0 36px rgba(168,85,247,0.45)",
        } as any
      }
    />
  );
}

/* ---------- Default node card ---------- */
function NodeCard(props: NodeProps<EdgazeNodeData>) {
  return <NodeFrame {...(props as any)} />;
}

/* ---------- Node types ---------- */
// Define nodeTypes outside component to ensure stable reference
// This prevents React Flow warnings about recreating nodeTypes objects
const nodeTypes = Object.freeze({
  edgCard: NodeFrame,
  edgMerge: MergeNode,
  edgCondition: ConditionNode,
});

/* ---------- Public ref API ---------- */
export type CanvasRef = {
  addNodeAtCenter: (specId: string) => void;
  updateNodeConfig: (nodeId: string, patch: any) => void;
  getGraph: () => { nodes: Node<EdgazeNodeData>[]; edges: Edge[] };
  loadGraph: (graph: { nodes: Node<EdgazeNodeData>[]; edges: Edge[] } | any) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleGrid: () => void;
  toggleLock: () => void;
  fullscreen: () => void;
  getShowGrid: () => boolean;
  getLocked: () => boolean;
  getIsFullscreen: () => boolean;
};

type BuilderMode = "edit" | "preview";

type Props = {
  mode?: BuilderMode; // "preview" enables read-only mode
  onSelectionChange?: (s: {
    nodeId: string | null;
    specId?: string;
    config?: any;
  }) => void;
  onGraphChange?: (graph: { nodes: Node<EdgazeNodeData>[]; edges: Edge[] }) => void;
};

function safeParseGraph(input: any): any {
  if (input == null) return null;
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
  return input;
}

function normalizeGraph(
  graphLike: any
): { nodes: Node<EdgazeNodeData>[]; edges: Edge[] } {
  const g0 = safeParseGraph(graphLike);
  const g =
    g0?.graph && (Array.isArray(g0.graph.nodes) || Array.isArray(g0.graph.edges))
      ? g0.graph
      : g0;

  const nodes = Array.isArray(g?.nodes) ? (g.nodes as Node<EdgazeNodeData>[]) : [];
  const edges = Array.isArray(g?.edges) ? (g.edges as Edge[]) : [];

  return { nodes, edges };
}

const EDGE_TYPE = "simplebezier" as const;

type BubbleState =
  | { kind: "node"; id: string; x: number; y: number }
  | { kind: "edge"; id: string; x: number; y: number };

const ReactFlowCanvas = forwardRef<CanvasRef, Props>(function ReactFlowCanvas(
  { mode = "edit", onSelectionChange, onGraphChange },
  ref
) {
  const isPreview = mode === "preview";

  // nodeTypes is defined outside component and frozen, so it's stable
  // Using it directly should work, but React Flow may still warn in dev mode
  // Using useMemo ensures the reference is stable across renders
  const stableNodeTypes = useMemo(() => nodeTypes, []);

  const [nodes, setNodes, baseOnNodesChange] = useNodesState<EdgazeNodeData>([]);

  const [edges, setEdges, baseOnEdgesChange] = useEdgesState<Edge>([]);

  const [locked, setLocked] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rfRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const connectionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCopiedNodeRef = useRef<Node<EdgazeNodeData> | null>(null);

  // Prevent selection-change -> state -> selection-change loops
  const lastSelectionKeyRef = useRef<string>("none");
  const paneClickJustHappenedRef = useRef(false);

  const nodesRef = useRef<Node<EdgazeNodeData, string | undefined>[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Dynamic zoom limits: allow more zoom out for bigger workflows
  const minZoom = useMemo(() => {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const workflowSize = nodeCount + edgeCount;
    // For small workflows (< 10 nodes), cap at 0.1
    // For larger workflows, allow more zoom out (0.05 for very large, 0.08 for medium)
    if (workflowSize < 10) return 0.1;
    if (workflowSize < 30) return 0.08;
    return 0.05; // Very large workflows can zoom out more
  }, [nodes.length, edges.length]);

  // Allow node cards to toggle settings without storing functions in graph
  useEffect(() => {
    const off = on<{ nodeId: string; patch: any }>("builder:updateNodeConfig", (payload) => {
      if (!payload?.nodeId || !payload?.patch) return;
      if (isPreview) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === payload.nodeId
            ? { ...n, data: { ...n.data, config: { ...(n.data?.config ?? {}), ...payload.patch } } }
            : n
        )
      );
    });
    return () => {
      try {
        off();
      } catch {}
    };
  }, [setNodes, isPreview]);

  // Emit graph changes (parent should debounce persistence)
  useEffect(() => {
    onGraphChange?.({ nodes, edges });
  }, [nodes, edges, onGraphChange]);

  const onInit = (inst: ReactFlowInstance) => {
    rfRef.current = inst;
    try {
      const vp = (inst as any)?.toObject?.().viewport as Viewport | undefined;
      if (vp) setViewport(vp);
    } catch {
      /* no-op */
    }
  };

  // Connection validation - simplified to trust ReactFlow's handle system
  const isValidConnection = useCallback(
    (connection: Connection | Edge): boolean => {
      if (!connection.source || !connection.target) {
        console.log("[Connection] Rejected: Missing source or target", connection);
        return false;
      }

      const sourceNode = nodesRef.current.find((n) => n.id === connection.source);
      const targetNode = nodesRef.current.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) {
        console.log("[Connection] Rejected: Nodes not found", { sourceNode, targetNode });
        return false;
      }

      const sourceSpec = getNodeSpec(sourceNode.data?.specId);
      const targetSpec = getNodeSpec(targetNode.data?.specId);

      // If specs not found, allow connection (fallback)
      if (!sourceSpec || !targetSpec) {
        console.log("[Connection] Allowed: Specs not found (fallback)", { sourceSpec, targetSpec });
        return true;
      }

      console.log("[Connection] Validating", {
        source: sourceSpec.id,
        target: targetSpec.id,
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
      });

      // Rule 1: Input nodes cannot receive connections (they only output)
      if (targetSpec.id === "input") {
        console.log("[Connection] Rejected: Rule 1 - Input nodes cannot receive connections");
        return false;
      }

      // Rule 2: Output nodes cannot send connections (they only receive)
      if (sourceSpec.id === "output") {
        console.log("[Connection] Rejected: Rule 2 - Output nodes cannot send connections");
        return false;
      }

      // Rule 3: Prevent self-connections
      if (sourceNode.id === targetNode.id) {
        console.log("[Connection] Rejected: Rule 3 - Self-connection");
        return false;
      }

      // Rule 4: Condition nodes can only have 1 input connection
      if (targetSpec.id === "condition") {
        const existingInputs = edgesRef.current.filter((e) => e.target === connection.target);
        if (existingInputs.length >= 1) {
          console.log("[Connection] Rejected: Rule 4 - Condition node already has input");
          return false;
        }
      }

      // Rule 5: Output nodes can only have 1 input connection
      // Allow replacing existing connection (remove old one when connecting new one)
      if (targetSpec.id === "output") {
        const existingInputs = edgesRef.current.filter((e) => e.target === connection.target);
        console.log("[Connection] Checking Rule 5 - Output node", {
          targetNodeId: connection.target,
          sourceNodeId: connection.source,
          existingInputs: existingInputs.length,
          existingEdges: existingInputs.map((e) => ({ source: e.source, target: e.target })),
        });
        // Always allow - we'll replace the old connection in onConnect
        if (existingInputs.length >= 1) {
          console.log("[Connection] Allowed: Rule 5 - Will replace existing connection");
        }
      }

      // Rule 6: Input nodes can only have 1 output connection
      if (sourceSpec.id === "input") {
        const existingOutputs = edgesRef.current.filter((e) => e.source === connection.source);
        if (existingOutputs.length >= 1) {
          console.log("[Connection] Rejected: Rule 6 - Input node already has output");
          return false;
        }
      }

      // Rule 7: No ambiguous connections - same target handle cannot receive multiple edges
      const targetHandleKey = (connection as any).targetHandle ?? null;
      const existingToSameHandle = edgesRef.current.filter(
        (e) => e.target === connection.target && ((e as any).targetHandle ?? null) === targetHandleKey
      );
      if (existingToSameHandle.length >= 1) {
        console.log("[Connection] Rejected: Rule 7 - This input already has a connection (ambiguous)");
        return false;
      }

      // Trust ReactFlow's handle system - if it allows the connection, we allow it
      console.log("[Connection] Allowed: All checks passed");
      return true;
    },
    []
  );

  const getConnectionError = useCallback(
    (connection: Connection | Edge): string | null => {
      if (!connection.source || !connection.target) return "Invalid connection";

      const sourceNode = nodesRef.current.find((n) => n.id === connection.source);
      const targetNode = nodesRef.current.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return "Nodes not found";

      const sourceSpec = getNodeSpec(sourceNode.data?.specId);
      const targetSpec = getNodeSpec(targetNode.data?.specId);

      if (!sourceSpec || !targetSpec) return null;

      // Rule 1: Input nodes cannot have inputs
      if (targetSpec.id === "input") {
        return "Input nodes cannot receive connections. They only output data.";
      }

      // Rule 2: Output nodes cannot have outputs
      if (sourceSpec.id === "output") {
        return "Output nodes cannot send connections. They only receive data.";
      }

      // Rule 3: Condition nodes can only have 1 input connection
      if (targetSpec.id === "condition") {
        const existingInputs = edgesRef.current.filter((e) => e.target === connection.target);
        if (existingInputs.length >= 1) {
          return "Condition nodes can only have one input connection.";
        }
      }

      // Rule 6: Output nodes can only have 1 input connection
      if (targetSpec.id === "output") {
        const existingInputs = edgesRef.current.filter((e) => e.target === connection.target);
        if (existingInputs.length >= 1) {
          return "Output nodes can only have one input connection.";
        }
      }

      // Rule 7: Input nodes can only have 1 output connection
      if (sourceSpec.id === "input") {
        const existingOutputs = edgesRef.current.filter((e) => e.source === connection.source);
        if (existingOutputs.length >= 1) {
          return "Input nodes can only have one output connection.";
        }
      }

      // Rule 8: No ambiguous connections - same target handle cannot receive multiple edges
      const targetHandleKey = (connection as any).targetHandle ?? null;
      const existingToSameHandle = edgesRef.current.filter(
        (e) => e.target === connection.target && ((e as any).targetHandle ?? null) === targetHandleKey
      );
      if (existingToSameHandle.length >= 1) {
        return "This input already has a connection. Remove it first to connect another.";
      }

      // Rule 4: Prevent cycles
      if (sourceNode.id === targetNode.id) {
        return "Cannot connect a node to itself.";
      }

      // Trust ReactFlow's handle system for port validation
      return null;
    },
    []
  );

  const onConnect: OnConnect = useCallback(
    (params: Edge | Connection) => {
      if (locked || isPreview) return;

      const sourceId = (params as any)?.source as string | undefined;
      const targetId = (params as any)?.target as string | undefined;

      // Clear any previous connection error when user attempts a new connection
      if (connectionErrorTimerRef.current) {
        clearTimeout(connectionErrorTimerRef.current);
        connectionErrorTimerRef.current = null;
      }

      // Validate connection
      const isValid = isValidConnection(params);
      if (!isValid) {
        const error = getConnectionError(params);
        if (error) {
          setConnectionError(error);
          connectionErrorTimerRef.current = setTimeout(() => {
            setConnectionError(null);
            connectionErrorTimerRef.current = null;
          }, 5000);
        }
        return;
      }

      setConnectionError(null);

      const sourceSpecId = sourceId
        ? nodesRef.current.find((n) => n.id === sourceId)?.data?.specId
        : undefined;
      const targetSpecId = targetId
        ? nodesRef.current.find((n) => n.id === targetId)?.data?.specId
        : undefined;

      // For output nodes, remove any existing input connection before adding new one
      const targetNode = nodesRef.current.find((n) => n.id === targetId);
      const targetSpec = targetNode ? getNodeSpec(targetNode.data?.specId) : null;
      if (targetSpec?.id === "output") {
        setEdges((eds) => {
          // Remove existing edges to this output node
          const filtered = eds.filter((e) => e.target !== targetId);
          // Add the new edge
          return addEdge({ ...params, type: EDGE_TYPE }, filtered);
        });
      } else {
        setEdges((eds) => addEdge({ ...params, type: EDGE_TYPE }, eds));
      }

      safeTrack("Builder Edge Created", {
        surface: "canvas",
        source_node_id: sourceId,
        target_node_id: targetId,
        source_spec_id: sourceSpecId,
        target_spec_id: targetSpecId,
      });
    },
    [setEdges, locked, isPreview, isValidConnection, getConnectionError]
  );

  /* Maintain "Connected to" names (GUARDED: only updates if names actually change) */
  useEffect(() => {
    setNodes((nds) => {
      let changed = false;

      const next = nds.map((n) => {
        const outs = edges.filter((e) => e.source === n.id);
        const names = outs
          .map((e) => nds.find((x) => x.id === e.target))
          .filter(Boolean)
          .map((x) => x!.data?.title || x!.id);

        const prevNames = n.data?.connectedNames;
        const prevKey = Array.isArray(prevNames) ? prevNames.join("|") : "";
        const nextKey = names.join("|");

        if (prevKey === nextKey) return n;

        changed = true;
        return { ...n, data: { ...n.data, connectedNames: names } };
      });

      return changed ? next : nds;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, setNodes]);

  const createNodeFromSpec = useCallback(
    (spec: NodeSpec, position: { x: number; y: number }) => {
      const id = `${spec.id}-${Math.random().toString(36).slice(2, 8)}`;

      safeTrack("Builder Node Added", {
        surface: "canvas",
        spec_id: spec.id,
        spec_label: spec.label,
        node_id: id,
        x: Math.round(position.x),
        y: Math.round(position.y),
      });

      setNodes((nds) =>
        nds.concat({
          id,
          type: (spec as any).nodeType ?? "edgCard",
          position,
          data: {
            specId: spec.id,
            title: spec.label,
            version: spec.version ?? "1.0.0",
            summary: spec.summary ?? "",
            config: (spec as any).defaultConfig ?? {},
            icon: (spec as any).icon ?? spec.label?.charAt(0) ?? "N",
            connectedNames: [],
          },
        })
      );
    },
    [setNodes]
  );

  const addNodeAtCenter = useCallback(
    (specId: string) => {
      if (isPreview) return;
      const spec = getNodeSpec(specId);
      if (!spec || !rfRef.current || !wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const center = rfRef.current.project({
        x: rect.width / 2,
        y: rect.height / 2,
      });
      createNodeFromSpec(spec, center);
    },
    [createNodeFromSpec, isPreview]
  );

  // Listen for add node events from block library
  useEffect(() => {
    const handler = (payload: any) => {
      const specId = payload?.specId;
      if (!specId || isPreview) return;
      addNodeAtCenter(specId);
    };
    
    const busOff = on("builder:addNode", handler);
    const domHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      handler(detail);
    };
    window.addEventListener("edgaze:add-node", domHandler);
    
    return () => {
      try {
        busOff?.();
      } catch {}
      window.removeEventListener("edgaze:add-node", domHandler);
    };
  }, [addNodeAtCenter, isPreview]);

  const onDrop = useCallback(
    (evt: React.DragEvent) => {
      evt.preventDefault();
      if (locked || isPreview) return;

      const payload = evt.dataTransfer.getData("application/edgaze-node");
      if (!payload || !rfRef.current || !wrapperRef.current) return;

      let parsed: any = null;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }

      const { specId } = parsed || {};
      if (!specId) return;

      const spec = getNodeSpec(specId);
      if (!spec) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const pos = rfRef.current.project({
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
      });

      createNodeFromSpec(spec, pos);
    },
    [createNodeFromSpec, locked, isPreview]
  );

  const onDragOver = (evt: React.DragEvent) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = locked || isPreview ? "none" : "move";
  };

  const toWrapperXY = useCallback((nx: number, ny: number, vp: Viewport) => {
    return {
      wx: nx * vp.zoom + vp.x,
      wy: ny * vp.zoom + vp.y,
    };
  }, []);

  const placeBubbleForNode = useCallback(
    (node: Node<EdgazeNodeData>) => {
      const inst = rfRef.current;
      if (!inst) return;

      const rn = inst.getNode(node.id) as any;
      const abs = rn?.positionAbsolute ?? node.position;

      const measuredW = rn?.measured?.width ?? 360;
      const { wx, wy } = toWrapperXY(abs.x, abs.y, viewport);

      const toolbarW = 288;
      const nodeW = measuredW * viewport.zoom;
      const nextX = wx + nodeW / 2 - toolbarW / 2;
      const nextY = wy - 52;

      const next: BubbleState = { kind: "node", id: node.id, x: nextX, y: nextY };

      setBubble((prev) => {
        if (!prev) return next;
        if (prev.kind !== "node" || prev.id !== next.id) return next;

        const dx = Math.abs(prev.x - next.x);
        const dy = Math.abs(prev.y - next.y);
        if (dx < 0.5 && dy < 0.5) return prev;

        return next;
      });
    },
    [toWrapperXY, viewport]
  );

  const placeBubbleForEdge = useCallback(
    (edgeId: string) => {
      const inst = rfRef.current;
      if (!inst) return;

      const e = edgesRef.current.find((x) => x.id === edgeId);
      if (!e) return;

      const s = inst.getNode(e.source) as any;
      const t = inst.getNode(e.target) as any;
      if (!s || !t) return;

      const sp = s.positionAbsolute ?? s.position;
      const tp = t.positionAbsolute ?? t.position;

      const sw = s.measured?.width ?? 360;
      const sh = s.measured?.height ?? 140;
      const tw = t.measured?.width ?? 360;
      const th = t.measured?.height ?? 140;

      const mx = sp.x + sw / 2 + (tp.x + tw / 2 - (sp.x + sw / 2)) / 2;
      const my = sp.y + sh / 2 + (tp.y + th / 2 - (sp.y + sh / 2)) / 2;

      const { wx, wy } = toWrapperXY(mx, my, viewport);

      const toolbarW = 120;
      const next: BubbleState = {
        kind: "edge",
        id: edgeId,
        x: wx - toolbarW / 2,
        y: wy - 52,
      };

      setBubble((prev) => {
        if (!prev) return next;
        if (prev.kind !== "edge" || prev.id !== next.id) return next;

        const dx = Math.abs(prev.x - next.x);
        const dy = Math.abs(prev.y - next.y);
        if (dx < 0.5 && dy < 0.5) return prev;

        return next;
      });
    },
    [toWrapperXY, viewport]
  );

  const showSelectionFor = useCallback(
    (node?: Node<EdgazeNodeData>) => {
      if (!onSelectionChange) return;

      if (!node) {
        lastSelectionKeyRef.current = "none";
        setBubble(null);
        onSelectionChange({ nodeId: null });
        return;
      }

      lastSelectionKeyRef.current = `n:${node.id}`;

      if (!isPreview) {
        placeBubbleForNode(node);
      } else {
        setBubble(null);
      }

      onSelectionChange({
        nodeId: node.id,
        specId: node.data?.specId,
        config: node.data?.config,
      });
    },
    [onSelectionChange, placeBubbleForNode, isPreview]
  );

  // Reposition bubble when viewport changes (GUARDED)
  const bubbleKey = bubble ? `${bubble.kind}:${bubble.id}` : null;
  useEffect(() => {
    if (!bubbleKey) return;

    if (bubble?.kind === "node") {
      const n = rfRef.current?.getNode(bubble.id) as Node<EdgazeNodeData> | undefined;
      if (n) placeBubbleForNode(n);
      return;
    }

    if (bubble?.kind === "edge") {
      placeBubbleForEdge(bubble.id);
    }
  }, [bubbleKey, viewport, placeBubbleForNode, placeBubbleForEdge]);

  const fitSafely = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rfRef.current?.fitView?.({ padding: 0.22, duration: 260 });
      });
    });
  }, []);

  useImperativeHandle(ref, () => ({
    addNodeAtCenter,
    updateNodeConfig: (nodeId: string, patch: any) => {
      if (isPreview) return;
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  config: { ...(n.data?.config ?? {}), ...patch },
                },
              }
            : n
        );
        
        // Sync selection state if this node is currently selected - defer to avoid setState in render
        const updatedNode = updated.find((n) => n.id === nodeId);
        if (updatedNode && lastSelectionKeyRef.current === `n:${nodeId}`) {
          // Use setTimeout to defer the state update until after render
          setTimeout(() => {
            onSelectionChange?.({
              nodeId: updatedNode.id,
              specId: updatedNode.data?.specId,
              config: updatedNode.data?.config,
            });
          }, 0);
        }
        
        return updated;
      });
    },
    getGraph: () => ({ nodes: nodesRef.current, edges: edgesRef.current }),
    loadGraph: (graph: any) => {
      const { nodes: nextNodes, edges: nextEdges } = normalizeGraph(graph);

      lastSelectionKeyRef.current = "none";
      setBubble(null);
      onSelectionChange?.({ nodeId: null });

      setNodes(nextNodes);
      setEdges(nextEdges);

      fitSafely();
    },
    zoomIn,
    zoomOut,
    toggleGrid,
    toggleLock,
    fullscreen,
    getShowGrid: () => showGrid,
    getLocked: () => locked,
    getIsFullscreen: () => isFullscreen,
  }));

  /* Controls */
  const zoomIn = useCallback(() => {
    rfRef.current?.zoomIn?.();
  }, []);
  const zoomOut = useCallback(() => {
    rfRef.current?.zoomOut?.();
  }, []);
  const fit = useCallback(() => {
    rfRef.current?.fitView?.({ padding: 0.22, duration: 300 });
  }, []);
  const toggleLock = useCallback(() => {
    setLocked((v) => !v);
  }, []);
  const toggleGrid = useCallback(() => {
    setShowGrid((v) => !v);
  }, []);
  const fullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      (el as any).requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handler();
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* Keybinds */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (isEditable) return;

      // Preview: block ALL destructive/edit shortcuts
      if (isPreview) {
        const k = e.key.toLowerCase();
        const meta = e.metaKey || e.ctrlKey;

        const shouldBlock =
          k === "delete" ||
          k === "backspace" ||
          (meta && (k === "c" || k === "v" || k === "x" || k === "d")) ||
          (meta && k === "z") ||
          (meta && k === "y");

        if (shouldBlock) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (locked || isPreview) return;

        const selectedEdgeIds = edgesRef.current
          .filter((ed) => ed.selected === true)
          .map((ed) => ed.id);

        if (selectedEdgeIds.length > 0) {
          safeTrack("Builder Edge Deleted", {
            surface: "canvas",
            count: selectedEdgeIds.length,
            via: "keyboard",
          });
          setEdges((eds) => eds.filter((ed) => !selectedEdgeIds.includes(ed.id)));
          lastSelectionKeyRef.current = "none";
          setBubble(null);
          return;
        }

        const selectedNodeIds = nodesRef.current
          .filter((n) => n.selected === true)
          .map((n) => n.id);

        if (selectedNodeIds.length > 0) {
          const specIds = selectedNodeIds
            .map((id) => nodesRef.current.find((n) => n.id === id)?.data?.specId)
            .filter(Boolean);
          safeTrack("Builder Node Deleted", {
            surface: "canvas",
            count: selectedNodeIds.length,
            spec_ids: specIds.length > 0 ? specIds : undefined,
            via: "keyboard",
          });
        }

        setNodes((nds) => nds.filter((n) => n.selected !== true));
        setEdges((eds) => eds.filter((ed) => ed.selected !== true));
        lastSelectionKeyRef.current = "none";
        setBubble(null);
        onSelectionChange?.({ nodeId: null });
        return;
      }

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        fit();
        return;
      }

      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleLock();
        return;
      }
      if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        toggleGrid();
        return;
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        fullscreen();
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    locked,
    isPreview,
    fit,
    fullscreen,
    onSelectionChange,
    toggleGrid,
    toggleLock,
    zoomIn,
    zoomOut,
    setEdges,
  ]);

  /* Selection bubble actions */
  const onCopy = () => {
    if (isPreview) return;
    if (!bubble || bubble.kind !== "node") return;
    const src = rfRef.current?.getNode(bubble.id) as Node<EdgazeNodeData> | undefined;
    if (!src) return;
    lastCopiedNodeRef.current = src;
    navigator.clipboard.writeText(
      JSON.stringify(
        { type: src.type, data: src.data?.config ?? {} },
        null,
        2
      )
    );
  };

  const onPaste = () => {
    if (isPreview) return;
    if (!bubble || bubble.kind !== "node" || locked) return;
    const src = lastCopiedNodeRef.current;
    if (!src) return;

    const id = `${src.data?.specId}-${Math.random().toString(36).slice(2, 8)}`;

    safeTrack("Builder Node Pasted", {
      surface: "canvas",
      spec_id: src.data?.specId,
      node_id: id,
    });

    setNodes((nds) =>
      nds.concat({
        ...(src as Node<EdgazeNodeData>),
        id,
        position: {
          x: (src.position?.x ?? 0) + 40,
          y: (src.position?.y ?? 0) + 24,
        },
        selected: false,
      })
    );
  };

  const onDup = () => {
    if (isPreview) return;
    if (!bubble || bubble.kind !== "node" || locked) return;
    const src = rfRef.current?.getNode(bubble.id) as Node<EdgazeNodeData> | undefined;
    if (!src) return;

    const id = `${src.data?.specId}-${Math.random().toString(36).slice(2, 8)}`;

    safeTrack("Builder Node Duplicated", {
      surface: "canvas",
      spec_id: src.data?.specId,
      source_node_id: src.id,
      node_id: id,
    });

    setNodes((nds) =>
      nds.concat({
        ...(src as Node<EdgazeNodeData>),
        id,
        position: {
          x: (src.position?.x ?? 0) + 32,
          y: (src.position?.y ?? 0) + 18,
        },
        selected: false,
      })
    );
  };

  const onDeleteNode = () => {
    if (isPreview) return;
    if (!bubble || bubble.kind !== "node" || locked) return;
    const specId = rfRef.current?.getNode(bubble.id)?.data?.specId;
    safeTrack("Builder Node Deleted", {
      surface: "canvas",
      count: 1,
      spec_ids: specId ? [specId] : undefined,
      via: "ui",
    });
    setNodes((nds) => nds.filter((n) => n.id !== bubble.id));
    lastSelectionKeyRef.current = "none";
    setBubble(null);
    onSelectionChange?.({ nodeId: null });
  };

  const onDeleteEdge = () => {
    if (isPreview) return;
    if (!bubble || bubble.kind !== "edge" || locked) return;
    safeTrack("Builder Edge Deleted", {
      surface: "canvas",
      count: 1,
      via: "ui",
    });
    setEdges((eds) => eds.filter((e) => e.id !== bubble.id));
    lastSelectionKeyRef.current = "none";
    setBubble(null);
  };


  const selectionShellClass =
    "rounded-full border border-white/10 bg-black/85 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.75)]";

  const selectionBtnClass =
    "inline-flex items-center gap-2 h-9 px-3 rounded-full text-[12px] font-medium text-white/85 hover:text-white hover:bg-white/10 active:scale-[0.98] transition";

  const selectionDangerClass =
    "inline-flex items-center gap-2 h-9 px-3 rounded-full text-[12px] font-medium text-white/85 hover:text-white hover:bg-white/10 active:scale-[0.98] transition";

  // Preview allows only position/selection/dimensions changes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!isPreview) {
        baseOnNodesChange(changes);
        return;
      }

      const allowed = changes.filter((c: any) => {
        const t = c?.type;
        return (
          t === "position" ||
          t === "select" ||
          t === "dimensions" ||
          t === "positionExtent"
        );
      });

      if (allowed.length > 0) baseOnNodesChange(allowed);
    },
    [baseOnNodesChange, isPreview]
  );

  // Preview blocks edge changes entirely (keep selection only)
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!isPreview) {
        baseOnEdgesChange(changes);
        return;
      }

      const allowed = changes.filter((c: any) => c?.type === "select");
      if (allowed.length > 0) baseOnEdgesChange(allowed);
    },
    [baseOnEdgesChange, isPreview]
  );

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full rounded-2xl bg-[#070810]"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Control panel removed - now integrated into top bar */}

      {/* Connection error — shown in editor when connection is invalid or ambiguous */}
      {!isPreview && connectionError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-rose-500/95 text-white text-sm font-medium shadow-lg border border-rose-400/50 max-w-[90vw] text-center">
          {connectionError}
        </div>
      )}

      {/* Selection toolbar — hidden in preview */}
      {!isPreview && bubble && (
        <div className="absolute z-40" style={{ left: bubble.x, top: bubble.y }}>
          <div className={selectionShellClass}>
            {bubble.kind === "node" ? (
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button onClick={onCopy} className={selectionBtnClass}>
                  <Copy size={14} className="text-white/80" />
                  <span>Copy</span>
                </button>

                <div className="mx-1 h-5 w-px bg-white/10" />

                <button
                  onClick={onPaste}
                  disabled={locked}
                  className={cx(
                    selectionBtnClass,
                    locked && "opacity-50 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  <ClipboardPaste size={14} className="text-white/80" />
                  <span>Paste</span>
                </button>

                <button
                  onClick={onDup}
                  disabled={locked}
                  className={cx(
                    selectionBtnClass,
                    locked && "opacity-50 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  <CopyPlus size={14} className="text-white/80" />
                  <span>Duplicate</span>
                </button>

                <div className="mx-1 h-5 w-px bg-white/10" />

                <button
                  onClick={onDeleteNode}
                  disabled={locked}
                  className={cx(
                    selectionDangerClass,
                    locked && "opacity-50 cursor-not-allowed hover:bg-transparent"
                  )}
                  title="Delete"
                >
                  <Trash2 size={14} className="text-white/80" />
                  <span>Delete</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button
                  onClick={onDeleteEdge}
                  disabled={locked}
                  className={cx(
                    selectionDangerClass,
                    "px-4",
                    locked && "opacity-50 cursor-not-allowed hover:bg-transparent"
                  )}
                  title="Delete connection"
                >
                  <Trash2 size={14} className="text-white/80" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={locked || isPreview ? undefined : onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={stableNodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        onInit={onInit}
        onNodeClick={isPreview ? undefined : ((_, n) => showSelectionFor(n as Node<EdgazeNodeData>))}
        onPaneClick={(e) => {
          // Clear selection immediately on canvas click
          paneClickJustHappenedRef.current = true;
          lastSelectionKeyRef.current = "none";
          setBubble(null);
          onSelectionChange?.({ nodeId: null });
          // Reset flag after a brief moment to allow normal selection to work
          setTimeout(() => {
            paneClickJustHappenedRef.current = false;
          }, 0);
        }}
        defaultEdgeOptions={{ type: EDGE_TYPE, animated: false }}
        className="!bg-[#070810]"
        proOptions={{ hideAttribution: true }}
        onMove={(_, vp) => setViewport(vp)}
        nodesDraggable={!locked && !isPreview}
        nodesConnectable={!locked && !isPreview}
        edgesUpdatable={!locked && !isPreview}
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        minZoom={minZoom}
        maxZoom={2}
        onSelectionChange={(sel) => {
          // In preview mode, disable all selection - only allow pan/zoom
          if (isPreview) {
            setBubble(null);
            onSelectionChange?.({ nodeId: null });
            return;
          }

          // If pane was just clicked, ignore this selection change to prevent bubble from reappearing
          if (paneClickJustHappenedRef.current) {
            // Ensure bubble stays cleared
            if (!sel?.nodes?.length && !sel?.edges?.length) {
              setBubble(null);
              lastSelectionKeyRef.current = "none";
            }
            return;
          }
          
          const selectedNode = sel?.nodes?.[0] as Node<EdgazeNodeData> | undefined;
          const selectedEdge = sel?.edges?.[0];

          const nextKey = selectedNode
            ? `n:${selectedNode.id}`
            : selectedEdge
            ? `e:${selectedEdge.id}`
            : "none";

          if (nextKey === lastSelectionKeyRef.current) return;
          lastSelectionKeyRef.current = nextKey;

          if (selectedNode) {
            showSelectionFor(selectedNode);
            return;
          }

          if (selectedEdge) {
            placeBubbleForEdge(selectedEdge.id);
            return;
          }

          setBubble(null);
          onSelectionChange?.({ nodeId: null });
        }}
      >
        {showGrid && (
          <Background
            id="workflow-grid"
            gap={26}
            size={1.4}
            color="rgba(148,163,184,0.55)"
            variant={BackgroundVariant.Dots}
          />
        )}

        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          style={{
            background: "#05060b",
            border: "1px solid rgba(148,163,184,0.6)",
            borderRadius: 12,
            boxShadow:
              "0 0 0 1px rgba(15,23,42,0.85) inset, 0 12px 40px rgba(0,0,0,0.7)",
            bottom: 12,
            right: 12,
            width: 180,
            height: 120,
          }}
          nodeColor={() => "#e5e7eb"}
          nodeStrokeColor={() => "rgba(249,250,251,0.8)"}
          maskColor="rgba(15,23,42,0.75)"
        />
      </ReactFlow>
    </div>
  );
});

export default ReactFlowCanvas;
