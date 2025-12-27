"use client";

import { useEffect, useRef, useState } from "react";
import {
  GripHorizontal,
  Trash2,
  Copy,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from "lucide-react";
import { cx } from "@lib/cx";

type NodeData = { id: string; x: number; y: number; label: string };

const GRID_SIZE = 24;
const INITIAL_NODES: NodeData[] = [
  { id: "n1", x: 80, y: 80, label: "Input" },
  { id: "n2", x: 320, y: 180, label: "LLM" },
  { id: "n3", x: 580, y: 260, label: "Output" },
];

export default function NodeCanvas() {
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // pan / zoom refs so event handlers don’t capture stale values
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  const isPanningRef = useRef(false);
  const panAnchorRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  /* -----------------------------
   * Keyboard: track Space
   * --------------------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
        isPanningRef.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  /* -----------------------------
   * Mouse: pan with Space + drag
   * --------------------------- */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !spaceHeldRef.current) return;
      isPanningRef.current = true;
      panAnchorRef.current = {
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      };
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const nx = e.clientX - panAnchorRef.current.x;
      const ny = e.clientY - panAnchorRef.current.y;
      setOffset({ x: nx, y: ny });
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
    };

    vp.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      vp.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  /* -----------------------------
   * Zoom: Ctrl/Cmd + wheel
   * --------------------------- */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const currentZoom = zoomRef.current;
      const currentOffset = offsetRef.current;

      const rect = vp.getBoundingClientRect();
      const px = (e.clientX - rect.left - currentOffset.x) / currentZoom;
      const py = (e.clientY - rect.top - currentOffset.y) / currentZoom;

      const factor = Math.exp(-e.deltaY * 0.0015);
      const nextZoom = Math.min(2.5, Math.max(0.4, currentZoom * factor));

      const nx = e.clientX - rect.left - px * nextZoom;
      const ny = e.clientY - rect.top - py * nextZoom;

      setZoom(nextZoom);
      setOffset({ x: nx, y: ny });
    };

    vp.addEventListener("wheel", handleWheel, { passive: false });
    return () => vp.removeEventListener("wheel", handleWheel);
  }, []);

  /* -----------------------------
   * Node drag with snapping
   * --------------------------- */
  const beginNodeDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();

    const start = { x: e.clientX, y: e.clientY };
    const current = nodes.find((n) => n.id === id);
    if (!current) return;

    const origin = { x: current.x, y: current.y };
    setSelectedId(id);

    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - start.x) / zoomRef.current;
      const dy = (ev.clientY - start.y) / zoomRef.current;

      const rawX = origin.x + dx;
      const rawY = origin.y + dy;
      const snapX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
      const snapY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;

      setNodes((list) =>
        list.map((n) => (n.id === id ? { ...n, x: snapX, y: snapY } : n))
      );
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  /* -----------------------------
   * Toolbar actions
   * --------------------------- */
  const addNode = () => {
    const id = Math.random().toString(36).slice(2);
    const baseX = 120 + nodes.length * 40;
    const baseY = 80 + nodes.length * 20;
    setNodes((list) => [
      ...list,
      { id, x: baseX, y: baseY, label: "Node" },
    ]);
    setSelectedId(id);
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const n = nodes.find((nd) => nd.id === selectedId);
    if (!n) return;
    const id = Math.random().toString(36).slice(2);
    setNodes((list) => [
      ...list,
      { ...n, id, x: n.x + GRID_SIZE, y: n.y + GRID_SIZE },
    ]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((list) => list.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomStep = (dir: "in" | "out") => {
    const factor = dir === "in" ? 1.15 : 1 / 1.15;
    setZoom((z) => Math.min(2.5, Math.max(0.4, z * factor)));
  };

  /* -----------------------------
   * RENDER
   * --------------------------- */

  return (
    <div
      ref={canvasRef}
      className={cx(
        "relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-[#05060A] shadow-[0_24px_80px_rgba(0,0,0,0.85)]",
        "edge-glass edge-border"
      )}
    >
      {/* HUD – top centre */}
      <div className="pointer-events-auto absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/14 bg-black/70 px-3 py-1 text-[11px] shadow-lg backdrop-blur-xl">
        <button
          className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 hover:bg-white/10"
          onClick={addNode}
        >
          <Copy size={13} className="opacity-80" />
          <span>New node</span>
        </button>

        <span className="mx-1 h-4 w-px bg-white/15" />

        <button
          className="rounded-full p-1 hover:bg-white/10"
          onClick={() => zoomStep("out")}
        >
          <ZoomOut size={14} />
        </button>
        <span className="px-1 text-xs tabular-nums text-white/70">
          {(zoom * 100).toFixed(0)}%
        </span>
        <button
          className="rounded-full p-1 hover:bg-white/10"
          onClick={() => zoomStep("in")}
        >
          <ZoomIn size={14} />
        </button>

        <button
          className="ml-1 flex items-center rounded-full bg-white/5 px-2 py-1 text-[10px] hover:bg-white/10"
          onClick={resetView}
        >
          <RefreshCw size={12} className="mr-1" />
          Reset view
        </button>
      </div>

      {/* Node toolbar – top left */}
      <div className="pointer-events-auto absolute left-4 top-4 z-30 flex items-center gap-1 rounded-full border border-white/14 bg-black/70 px-2 py-1 text-[11px] backdrop-blur-xl">
        <button
          className="rounded-full p-1 hover:bg-white/10 cursor-grab active:cursor-grabbing"
          title="Canvas frame (non-draggable)"
        >
          <GripHorizontal size={14} />
        </button>
        <button
          className={cx(
            "rounded-full p-1 hover:bg-white/10",
            !selectedId && "cursor-not-allowed opacity-40"
          )}
          onClick={duplicateSelected}
        >
          <Copy size={13} />
        </button>
        <button
          className={cx(
            "rounded-full p-1 hover:bg-white/10 text-red-300",
            !selectedId && "cursor-not-allowed opacity-40"
          )}
          onClick={deleteSelected}
        >
          <Trash2 size={13} />
        </button>
        <button
          className="ml-1 rounded-full p-1 hover:bg-white/10"
          onClick={() => setFullscreen((f) => !f)}
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        className={cx(
          "absolute inset-0 cursor-default select-none",
          fullscreen && "fixed inset-6 z-40 rounded-3xl border border-white/15 bg-[#05060A]"
        )}
      >
        {/* Grid */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            opacity: 0.35,
          }}
        />

        {/* Nodes layer */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {nodes.map((n) => (
            <button
              key={n.id}
              type="button"
              style={{ left: n.x, top: n.y }}
              onMouseDown={(e) => beginNodeDrag(e, n.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(n.id);
              }}
              className={cx(
                "absolute flex h-24 w-48 select-none items-center justify-center rounded-2xl border text-sm shadow-sm",
                "backdrop-blur-xl transition-colors",
                n.id === selectedId
                  ? "border-cyan-400/70 bg-white/10"
                  : "border-white/12 bg-white/5 hover:border-white/30"
              )}
            >
              <span className="px-4 text-[13px] font-medium text-white/90">
                {n.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Helper hint */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/12 bg-black/70 px-3 py-1 text-[11px] text-white/65 backdrop-blur">
        Hold{" "}
        <span className="rounded border border-white/25 bg-white/5 px-1">
          Space
        </span>{" "}
        and drag to pan · Pinch / Ctrl+Scroll to zoom · Drag nodes to snap to
        grid
      </div>
    </div>
  );
}
