"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  addEdge,
  Background,
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

/* ---------- Selection ring (for edgCard nodes) ---------- */
function SelectionRing() {
  return (
    <div
      className="pointer-events-none absolute -inset-[6px] rounded-[16px]"
      style={{
        background:
          "linear-gradient(90deg, rgba(34,211,238,.95), rgba(232,121,249,.95))",
        padding: 2.5,
        WebkitMask:
          "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        boxShadow:
          "0 0 24px rgba(34,211,238,.25), 0 0 24px rgba(232,121,249,.25)",
      }}
    />
  );
}

/* ---------- Default node card (white) ---------- */
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

      <div className="edge-card min-w-[360px] rounded-2xl relative">
        <div className="edge-card-header">
          <span className="truncate">{title}</span>
          <span className="text-[10px] opacity-70">{version}</span>
        </div>
        <div className="edge-card-body">
          <div className="text-[12px] opacity-85">{summary}</div>
          <div className="mt-2 text-[11px] opacity-70">
            {data?.connectedNames?.length
              ? `Connected to: ${data.connectedNames.join(", ")}`
              : "No outgoing connections yet"}
          </div>
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
          style={{ top: 30 + i * 18 }}
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
          style={{ top: 30 + i * 18 }}
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
};

type Props = {
  onSelectionChange?: (s: {
    nodeId: string | null;
    specId?: string;
    config?: any;
  }) => void;
};

const ReactFlowCanvas = forwardRef<CanvasRef, Props>(function ReactFlowCanvas(
  { onSelectionChange },
  ref
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [locked, setLocked] = useState(false);

  const rfRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // viewport state (no ReactFlowProvider needed)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  const [bubble, setBubble] = useState<{ x: number; y: number; id: string } | null>(
    null
  );
  const lastCopiedNodeRef = useRef<Node | null>(null);

  const onInit = (inst: ReactFlowInstance) => {
    rfRef.current = inst;
    // grab initial viewport
    try {
      const vp = (inst as any)?.toObject?.().viewport as Viewport | undefined;
      if (vp) setViewport(vp);
    } catch {}
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
  }, [edges, setNodes]);

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
      const payload = evt.dataTransfer.getData("application/edgaze-node");
      if (!payload || !rfRef.current || !wrapperRef.current) return;
      const { specId } = JSON.parse(payload);
      const spec = getNodeSpec(specId);
      if (!spec) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const pos = rfRef.current.project({
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
      });
      createNodeFromSpec(spec, pos);
    },
    [createNodeFromSpec]
  );

  const onDragOver = (evt: React.DragEvent) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "move";
  };

  // RF coords -> wrapper coords considering viewport
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

  // Reposition bubble when viewport changes (pan/zoom)
  useEffect(() => {
    if (!bubble) return;
    const n = rfRef.current?.getNode(bubble.id);
    if (n) placeBubbleForNode(n);
  }, [viewport, bubble?.id, placeBubbleForNode]);

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
    getGraph: () => ({ nodes, edges }),
  }));

  /* Delete key handling */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete") {
        setNodes((nds) => nds.filter((n) => n.selected !== true));
        setEdges((eds) => eds.filter((e) => e.selected !== true));
        setBubble(null);
        onSelectionChange?.({ nodeId: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setNodes, setEdges, onSelectionChange]);

  /* Canvas controls */
  const zoomIn = () => rfRef.current?.zoomIn?.();
  const zoomOut = () => rfRef.current?.zoomOut?.();
  const fit = () => rfRef.current?.fitView?.({ padding: 0.2, duration: 300 });
  const toggleLock = () => setLocked((v) => !v);
  const fullscreen = () => {
    const el = (rfRef.current as any)?.domNode as HTMLElement | undefined;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  /* Selection bubble actions */
  const onCopy = () => {
    if (!bubble) return;
    const src = rfRef.current?.getNode(bubble.id);
    if (!src) return;
    lastCopiedNodeRef.current = src;
    navigator.clipboard.writeText(
      JSON.stringify({ type: src.type, data: (src.data as any)?.config ?? {} }, null, 2)
    );
  };
  const onPaste = () => {
    if (!bubble) return;
    const src = lastCopiedNodeRef.current;
    if (!src) return;
    const id = `${(src.data as any)?.specId}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
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
    if (!bubble) return;
    const src = rfRef.current?.getNode(bubble.id);
    if (!src) return;
    const id = `${(src.data as any)?.specId}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
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
    if (!bubble) return;
    setNodes((nds) => nds.filter((n) => n.id !== bubble.id));
    setBubble(null);
    onSelectionChange?.({ nodeId: null });
  };

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Floating toolbar */}
      <div className="absolute right-3 top-3 z-40">
        <div className="rounded-full p-[1.5px] edge-grad">
          <div className="edge-toolbar">
            <button onClick={zoomOut} title="Zoom out">–</button>
            <button onClick={zoomIn} title="Zoom in">+</button>
            <span className="sep" />
            <button onClick={fit} title="Fit">Grid</button>
            <span className="sep" />
            <button onClick={toggleLock} title="Lock pan/zoom">
              {locked ? "Unlock" : "Lock"}
            </button>
            <button onClick={fullscreen} title="Fullscreen">⤢</button>
          </div>
        </div>
      </div>

      {/* Selection bubble */}
      {bubble && (
        <div className="absolute z-40" style={{ left: bubble.x, top: bubble.y }}>
          <div className="rounded-full p-[1.5px] edge-grad">
            <div className="edge-toolbar">
              <button onClick={onCopy}>Copy</button>
              <button onClick={onPaste}>Paste</button>
              <button onClick={onDup}>Duplicate</button>
              <button onClick={onDelete} className="danger">Delete</button>
            </div>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        onInit={onInit}
        panOnScroll={!locked}
        zoomOnScroll={!locked}
        zoomOnPinch={!locked}
        zoomOnDoubleClick={!locked}
        onNodeClick={(_, n) => showSelectionFor(n)}
        onPaneClick={() => showSelectionFor(undefined)}
        defaultEdgeOptions={{ type: "bezier", animated: false }}
        className="!bg-[#0b0b0b]"
        proOptions={{ hideAttribution: true }}
        // keep viewport state in sync (fixes toolbar drift)
        onMove={(_, vp) => setViewport(vp)}
      >
        <Background gap={24} size={1} color="rgba(255,255,255,0.10)" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          style={{
            background: "#0e0e0e",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 12,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,.08) inset, 0 10px 30px rgba(0,0,0,.45)",
            bottom: 12,
            right: 12,
            width: 180,
            height: 120,
          }}
          nodeColor={() => "#ffffff"}
          nodeStrokeColor={() => "rgba(255,255,255,0.6)"}
          maskColor="rgba(255,255,255,0.08)"
        />
      </ReactFlow>
    </div>
  );
});

export default ReactFlowCanvas;
