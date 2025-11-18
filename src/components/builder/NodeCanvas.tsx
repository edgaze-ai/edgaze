"use client";

import { useEffect, useRef, useState } from "react";
import { GripHorizontal, Trash, Copy, Maximize2, Minimize2 } from "lucide-react";
import { cx } from "@lib/cx";

type NodeData = { id: string; x: number; y: number; label: string };

const GRID_SIZE = 24;
const initialNodes: NodeData[] = [
  { id: "n1", x: 60, y: 60, label: "Input" },
  { id: "n2", x: 320, y: 140, label: "LLM" },
  { id: "n3", x: 560, y: 240, label: "Output" },
];

export default function NodeCanvas() {
  const [nodes, setNodes] = useState<NodeData[]>(initialNodes);
  const [toolbarPos, setToolbarPos] = useState({ x: 90, y: 24 });
  const [fullscreen, setFullscreen] = useState(false);

  // pan/zoom state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Keep canvas always filling its column
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // nothing to compute; but ensures layout stays responsive
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pan with Space+drag (mouse)
  function onMouseDown(e: React.MouseEvent) {
    if (!(e.button === 0 && (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey || e.nativeEvent instanceof MouseEvent && (e.nativeEvent as any).buttons === 1 && e.nativeEvent?.getModifierState(" ")))) {
      // not using modifier; allow node drags to handle
      return;
    }
  }

  // Simpler: hold Space to pan
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    function handleDown(ev: MouseEvent) {
      if (!ev.getModifierState(" ")) return;
      isPanning.current = true;
      start.x = ev.clientX - offset.x;
      start.y = ev.clientY - offset.y;
      ev.preventDefault();
    }
    function handleMove(ev: MouseEvent) {
      if (!isPanning.current) return;
      setOffset({ x: ev.clientX - start.x, y: ev.clientY - start.y });
    }
    function handleUp() {
      isPanning.current = false;
    }
    const start = { x: 0, y: 0 };
    vp.addEventListener("mousedown", handleDown);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      vp.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [offset.x, offset.y]);

  // Zoom with wheel (Ctrl/Cmd+scroll OR trackpad pinch)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015); // smooth exp zoom
      const rect = vp.getBoundingClientRect();
      const px = (e.clientX - rect.left - offset.x) / zoom;
      const py = (e.clientY - rect.top - offset.y) / zoom;

      const newZoom = Math.min(2.5, Math.max(0.4, zoom * factor));
      const nx = e.clientX - rect.left - px * newZoom;
      const ny = e.clientY - rect.top - py * newZoom;

      setZoom(newZoom);
      setOffset({ x: nx, y: ny });
    }

    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoom, offset]);

  // Drag nodes (with snapping)
  function dragNode(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const n = nodes.find((x) => x.id === id)!;
    const origin = { x: n.x, y: n.y };

    function onMove(ev: MouseEvent) {
      const dx = (ev.clientX - start.x) / zoom;
      const dy = (ev.clientY - start.y) / zoom;
      const rawX = origin.x + dx;
      const rawY = origin.y + dy;
      const snapX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
      const snapY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
      setNodes((list) => list.map((nd) => (nd.id === id ? { ...nd, x: snapX, y: snapY } : nd)));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div ref={containerRef} className="h-full w-full rounded-2xl edge-glass edge-border overflow-hidden relative">
      {/* Floating toolbar with handle */}
      <div
        style={{ left: toolbarPos.x, top: toolbarPos.y }}
        className="absolute z-30 flex items-center gap-2 rounded-full text-sm px-2 py-1 edge-glass border border-white/12"
      >
        <button
          className="rounded-full px-2 py-1 cursor-grab active:cursor-grabbing hover:bg-white/10"
          onMouseDown={(e) => {
            e.preventDefault();
            const start = { x: e.clientX - toolbarPos.x, y: e.clientY - toolbarPos.y };
            function onMove(ev: MouseEvent) {
              setToolbarPos({ x: ev.clientX - start.x, y: ev.clientY - start.y });
            }
            function onUp() {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            }
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          title="Drag toolbar"
          aria-label="Drag toolbar"
        >
          <GripHorizontal size={16} />
        </button>
        <button
          className="rounded-full px-2 py-1 hover:bg-white/10"
          onClick={() =>
            setNodes((n) => [...n, { id: Math.random().toString(36).slice(2), x: 120, y: 40, label: "Node" }])
          }
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
        <button className="rounded-full px-2 py-1 hover:bg-white/10" onClick={() => setNodes((n) => n.slice(0, -1))}>
          <Trash size={14} />
        </button>
        <button className="rounded-full px-2 py-1 hover:bg-white/10" onClick={() => setFullscreen((v) => !v)}>
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Fullscreen container */}
      <div
        className={cx(
          "absolute inset-0",
          fullscreen ? "fixed inset-2 z-50 rounded-2xl edge-glass edge-border" : ""
        )}
      />

      {/* Viewport (captures pan/zoom, fills column) */}
      <div ref={viewportRef} className="absolute inset-0 cursor-default select-none">
        {/* Grid (snaps with transform) */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px, ${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        />

        {/* Nodes layer (same transform) */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {nodes.map((n) => (
            <div
              key={n.id}
              style={{ left: n.x, top: n.y }}
              onMouseDown={(e) => dragNode(e, n.id)}
              className="absolute select-none rounded-2xl border border-white/12 bg-white/5 h-24 w-44 flex items-center justify-center text-sm cursor-grab active:cursor-grabbing"
            >
              {n.label}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions (subtle, bottom-left) */}
      <div className="absolute left-3 bottom-3 text-[11px] text-white/60 edge-glass border border-white/10 rounded-full px-2 py-1">
        Hold <kbd className="px-1 edge-glass border border-white/10 rounded">Space</kbd> and drag to pan ·
        <span className="ml-1">Pinch / Ctrl+Scroll to zoom</span>
      </div>
    </div>
  );
}
