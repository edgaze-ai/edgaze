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
  MiniMap,
  Node,
  OnConnect,
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
  NodeProps,
  Viewport,
} from "reactflow";
import "reactflow/dist/style.css";
import { getNodeSpec } from "src/nodes/registry";
import type { NodeSpec, Port } from "src/nodes/types";
import MergeNode from "@components/builder/nodes/MergeNode";
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Grid3X3,
} from "lucide-react";

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
          // some TS setups don't know this key; keep runtime correct without type errors
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          boxShadow:
            "0 0 24px rgba(94,240,255,0.35), 0 0 36px rgba(168,85,247,0.45)",
        } as any
      }
    />
  );
}

/* ---------- Default node card (white, clean) ---------- */
function NodeCard(props: NodeProps) {
  const { data, isConnectable, selected, id } = props as any;
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
  getGraph: () => { nodes: Node[]; edges: Edge[] };

  // ✅ single canonical hydrator used by modal open/create
  loadGraph: (graph: { nodes: Node[]; edges: Edge[] } | any) => void;
};

type Props = {
  onSelectionChange?: (s: {
    nodeId: string | null;
    specId?: string;
    config?: any;
  }) => void;
  onGraphChange?: (graph: { nodes: Node[]; edges: Edge[] }) => void;
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

function normalizeGraph(graphLike: any): { nodes: Node[]; edges: Edge[] } {
  const g0 = safeParseGraph(graphLike);
  const g =
    g0?.graph && (Array.isArray(g0.graph.nodes) || Array.isArray(g0.graph.edges))
      ? g0.graph
      : g0;

  const nodes = Array.isArray(g?.nodes) ? (g.nodes as Node[]) : [];
  const edges = Array.isArray(g?.edges) ? (g.edges as Edge[]) : [];

  return { nodes, edges };
}

const ReactFlowCanvas = forwardRef<CanvasRef, Props>(function ReactFlowCanvas(
  { onSelectionChange, onGraphChange },
  ref
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [locked, setLocked] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rfRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const [bubble, setBubble] = useState<{ x: number; y: number; id: string } | null>(
    null
  );
  const lastCopiedNodeRef = useRef<Node | null>(null);

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

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
      setEdges((eds) => addEdge({ ...params, type: "bezier" }, eds)),
    [setEdges]
  );

  /* Maintain "Connected to" names */
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const outs = edges.filter((e) => e.source === n.id);
        const names = outs
          .map((e) => nds.find((x) => x.id === e.target))
          .filter(Boolean)
          .map((x) => ((x!.data as any)?.title as string) || x!.id);
        return { ...n, data: { ...n.data, connectedNames: names } };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges]);

  const createNodeFromSpec = useCallback(
    (spec: NodeSpec, position: { x: number; y: number }) => {
      const id = `${spec.id}-${Math.random().toString(36).slice(2, 8)}`;
      setNodes((nds) =>
        nds.concat({
          id,
          type: spec.nodeType ?? "edgCard",
          position,
          data: {
            specId: spec.id,
            title: spec.label,
            version: spec.version ?? "1.0.0",
            summary: spec.summary ?? "",
            config: spec.defaultConfig ?? {},
            connectedNames: [],
          },
        })
      );
    },
    [setNodes]
  );

  const addNodeAtCenter = useCallback(
    (specId: string) => {
      const spec = getNodeSpec(specId);
      if (!spec || !rfRef.current || !wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const center = rfRef.current.project({
        x: rect.width / 2,
        y: rect.height / 2,
      });
      createNodeFromSpec(spec, center);
    },
    [createNodeFromSpec]
  );

  const onDrop = useCallback(
    (evt: React.DragEvent) => {
      evt.preventDefault();
      if (locked) return;

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
    [createNodeFromSpec, locked]
  );

  const onDragOver = (evt: React.DragEvent) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = locked ? "none" : "move";
  };

  const toWrapperXY = (nx: number, ny: number) => {
    return {
      wx: nx * viewport.zoom + viewport.x,
      wy: ny * viewport.zoom + viewport.y,
    };
  };

  const placeBubbleForNode = useCallback(
    (node: Node) => {
      const rn = rfRef.current?.getNode(node.id) as any;
      const abs = rn?.positionAbsolute ?? node.position;
      const width = (rn?.measured?.width ?? 340) * viewport.zoom;
      const { wx, wy } = toWrapperXY(abs.x, abs.y);
      setBubble({ id: node.id, x: wx + width + 12, y: wy - 6 });
    },
    [viewport]
  );

  const showSelectionFor = useCallback(
    (node?: Node) => {
      if (!onSelectionChange) return;

      if (!node) {
        setBubble(null);
        onSelectionChange({ nodeId: null });
        return;
      }

      placeBubbleForNode(node);
      onSelectionChange({
        nodeId: node.id,
        specId: (node.data as any)?.specId,
        config: (node.data as any)?.config,
      });
    },
    [onSelectionChange, placeBubbleForNode]
  );

  useEffect(() => {
    if (!bubble) return;
    const n = rfRef.current?.getNode(bubble.id);
    if (n) placeBubbleForNode(n);
  }, [viewport, bubble?.id, placeBubbleForNode, bubble]);

  const fitSafely = useCallback(() => {
    // fit after the DOM/layout settles (two RAFs = reliable)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rfRef.current?.fitView?.({ padding: 0.22, duration: 260 });
      });
    });
  }, []);

  useImperativeHandle(ref, () => ({
    addNodeAtCenter,
    updateNodeConfig: (nodeId: string, patch: any) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  config: { ...(n.data as any)?.config, ...patch },
                },
              }
            : n
        )
      );
    },
    getGraph: () => ({ nodes: nodesRef.current, edges: edgesRef.current }),

    // ✅ CANONICAL: page.tsx should call this always
    loadGraph: (graph: any) => {
      const { nodes: nextNodes, edges: nextEdges } = normalizeGraph(graph);

      setBubble(null);
      onSelectionChange?.({ nodeId: null });

      // replace graph atomically
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

    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
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

      if (e.key === "Delete" || e.key === "Backspace") {
        if (locked) return;
        setNodes((nds) => nds.filter((n) => n.selected !== true));
        setEdges((eds) => eds.filter((ed) => ed.selected !== true));
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
    fit,
    fullscreen,
    onSelectionChange,
    toggleGrid,
    toggleLock,
    zoomIn,
    zoomOut,
  ]);

  /* Selection bubble actions */
  const onCopy = () => {
    if (!bubble) return;
    const src = rfRef.current?.getNode(bubble.id);
    if (!src) return;
    lastCopiedNodeRef.current = src;
    navigator.clipboard.writeText(
      JSON.stringify(
        { type: src.type, data: (src.data as any)?.config ?? {} },
        null,
        2
      )
    );
  };

  const onPaste = () => {
    if (!bubble || locked) return;
    const src = lastCopiedNodeRef.current;
    if (!src) return;
    const id = `${(src.data as any)?.specId}-${Math.random().toString(36).slice(2, 8)}`;
    setNodes((nds) =>
      nds.concat({
        ...(src as Node),
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
    if (!bubble || locked) return;
    const src = rfRef.current?.getNode(bubble.id);
    if (!src) return;
    const id = `${(src.data as any)?.specId}-${Math.random().toString(36).slice(2, 8)}`;
    setNodes((nds) =>
      nds.concat({
        ...(src as Node),
        id,
        position: {
          x: (src.position?.x ?? 0) + 32,
          y: (src.position?.y ?? 0) + 18,
        },
        selected: false,
      })
    );
  };

  const onDelete = () => {
    if (!bubble || locked) return;
    setNodes((nds) => nds.filter((n) => n.id !== bubble.id));
    setBubble(null);
    onSelectionChange?.({ nodeId: null });
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

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full rounded-2xl bg-[#070810]"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Centered toolbar (icon-only) */}
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
              {isFullscreen ? (
                <Minimize2 size={16} />
              ) : (
                <Maximize2 size={16} />
              )}
              <span className="sr-only">Toggle fullscreen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selection bubble */}
      {bubble && (
        <div className="absolute z-40" style={{ left: bubble.x, top: bubble.y }}>
          <div className="rounded-full p-[1.5px] edge-grad">
            <div className="edge-toolbar">
              <button onClick={onCopy}>Copy</button>
              <button onClick={onPaste} disabled={locked}>
                Paste
              </button>
              <button onClick={onDup} disabled={locked}>
                Duplicate
              </button>
              <button onClick={onDelete} className="danger" disabled={locked}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={locked ? undefined : onConnect}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        onInit={onInit}
        onNodeClick={(_, n) => showSelectionFor(n)}
        onPaneClick={() => showSelectionFor(undefined)}
        defaultEdgeOptions={{ type: "bezier", animated: false }}
        className="!bg-[#070810]"
        proOptions={{ hideAttribution: true }}
        onMove={(_, vp) => setViewport(vp)}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        edgesUpdatable={!locked}
        // ✅ lock should NOT kill navigation; it should only prevent edits
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
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
