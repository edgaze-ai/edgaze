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
  connectedNames: string[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
  const { data, isConnectable, selected, id } = props;
  const spec: NodeSpec | undefined = getNodeSpec(data?.specId);
  const title = spec?.label ?? "Node";
  const summary = spec?.summary ?? "";
  const version = spec?.version ?? "1.0.0";

  const inputs = (spec?.ports ?? []).filter((p) => p.kind === "input");
  const outputs = (spec?.ports ?? []).filter((p) => p.kind === "output");

  return (
    <div className="relative" data-nodeid={id}>
      {selected && <SelectionRing />}

      <div className="relative min-w-[360px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/90">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 px-4 py-2.5">
          <span className="truncate text-[13px] font-semibold text-slate-900">
            {title}
          </span>
          <span className="shrink-0 text-[11px] font-mono text-slate-500">
            v{version}
          </span>
        </div>

        <div className="px-4 pb-3 pt-2.5">
          <p className="text-[12px] leading-relaxed text-slate-700">
            {summary}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            {data?.connectedNames?.length
              ? `Connected to: ${data.connectedNames.join(", ")}`
              : "No outgoing connections yet."}
          </p>
        </div>
      </div>

      {inputs.map((p: Port, i: number) => (
        <Handle
          key={p.id}
          id={p.id}
          type="target"
          position={Position.Left}
          className="edge-port"
          isConnectable={isConnectable}
          style={{ top: 32 + i * 18 }}
        />
      ))}
      {outputs.map((p: Port, i: number) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={Position.Right}
          className="edge-port edge-port--edg"
          isConnectable={isConnectable}
          style={{ top: 32 + i * 18 }}
        />
      ))}
    </div>
  );
}

/* ---------- Node types ---------- */
const nodeTypes = {
  edgCard: NodeCard,
  edgMerge: MergeNode,
};

/* ---------- Public ref API ---------- */
export type CanvasRef = {
  addNodeAtCenter: (specId: string) => void;
  updateNodeConfig: (nodeId: string, patch: any) => void;
  getGraph: () => { nodes: Node<EdgazeNodeData>[]; edges: Edge[] };
  loadGraph: (graph: { nodes: Node<EdgazeNodeData>[]; edges: Edge[] } | any) => void;
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

  const [nodes, setNodes, baseOnNodesChange] = useNodesState<EdgazeNodeData>([]);

  const [edges, setEdges, baseOnEdgesChange] = useEdgesState<Edge>([]);

  const [locked, setLocked] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rfRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const lastCopiedNodeRef = useRef<Node<EdgazeNodeData> | null>(null);

  // Prevent selection-change -> state -> selection-change loops
  const lastSelectionKeyRef = useRef<string>("none");

  const nodesRef = useRef<Node<EdgazeNodeData, string | undefined>[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

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

  const onConnect: OnConnect = useCallback(
    (params: Edge | Connection) =>
      setEdges((eds) => addEdge({ ...params, type: EDGE_TYPE }, eds)),
    [setEdges]
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
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  config: { ...(n.data?.config ?? {}), ...patch },
                },
              }
            : n
        )
      );
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
          setEdges((eds) => eds.filter((ed) => !selectedEdgeIds.includes(ed.id)));
          lastSelectionKeyRef.current = "none";
          setBubble(null);
          return;
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
    setNodes((nds) => nds.filter((n) => n.id !== bubble.id));
    lastSelectionKeyRef.current = "none";
    setBubble(null);
    onSelectionChange?.({ nodeId: null });
  };

  const onDeleteEdge = () => {
    if (isPreview) return;
    if (!bubble || bubble.kind !== "edge" || locked) return;
    setEdges((eds) => eds.filter((e) => e.id !== bubble.id));
    lastSelectionKeyRef.current = "none";
    setBubble(null);
  };

  const toolbarOuterStyle = useMemo<React.CSSProperties>(
    () => ({
      background:
        "linear-gradient(120deg, rgba(94,240,255,0.55), rgba(168,85,247,0.55), rgba(255,111,216,0.55))",
      boxShadow:
        "0 18px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06) inset",
    }),
    []
  );

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
      {/* Centered toolbar */}
      <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2">
        <div className="rounded-full p-[1px]" style={toolbarOuterStyle}>
          <div className="flex items-center gap-1 rounded-full border border-white/12 bg-black/80 px-1.5 py-1 shadow-[0_18px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            <button
              onClick={zoomOut}
              title="Zoom out (−)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
            >
              <ZoomOut size={16} />
              <span className="sr-only">Zoom out</span>
            </button>

            <button
              onClick={zoomIn}
              title="Zoom in (+)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
            >
              <ZoomIn size={16} />
              <span className="sr-only">Zoom in</span>
            </button>

            <div className="mx-1 h-5 w-px bg-white/12" />

            <button
              onClick={toggleGrid}
              title={`Toggle grid (G) – ${showGrid ? "On" : "Off"}`}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                showGrid
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/10"
              }`}
            >
              <Grid3X3 size={16} />
              <span className="sr-only">Toggle grid</span>
            </button>

            <button
              onClick={toggleLock}
              title={`Toggle lock (L) – ${locked ? "Locked" : "Free"}`}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                locked
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              {locked ? <Lock size={16} /> : <Unlock size={16} />}
              <span className="sr-only">Toggle lock</span>
            </button>

            <div className="mx-1 h-5 w-px bg-white/12" />

            <button
              onClick={fullscreen}
              title="Toggle fullscreen (F)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="sr-only">Toggle fullscreen</span>
            </button>
          </div>
        </div>
      </div>

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
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        onInit={onInit}
        onNodeClick={(_, n) => showSelectionFor(n as Node<EdgazeNodeData>)}
        onPaneClick={() => showSelectionFor(undefined)}
        defaultEdgeOptions={{ type: EDGE_TYPE, animated: false }}
        className="!bg-[#070810]"
        proOptions={{ hideAttribution: true }}
        onMove={(_, vp) => setViewport(vp)}
        nodesDraggable={!locked}
        nodesConnectable={!locked && !isPreview}
        edgesUpdatable={!locked && !isPreview}
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        onSelectionChange={(sel) => {
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
            if (!isPreview) {
              placeBubbleForEdge(selectedEdge.id);
            } else {
              setBubble(null);
            }
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
