"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import BlockLibrary from "@components/builder/BlockLibrary";
import ReactFlowCanvas, { CanvasRef as BECanvasRef } from "@components/builder/ReactFlowCanvas";
import { cx } from "@lib/cx";
import { emit, on } from "@lib/bus";
import { BarChart3, Globe2, Code2, Play, Rocket } from "lucide-react";

import FEBlockLibrary from "@components/frontend/FEBlockLibrary";
import FECanvas, { FECanvasRef, FESelection } from "@components/frontend/FECanvas";
import FEInspector from "@components/frontend/FEInspector";

const BUILDER_HEIGHT = "calc(100vh - 120px)";

type Selection = {
  nodeId: string | null;
  specId?: string;
  config?: any;
};

export default function BuilderPage() {
  const [mode, setMode] = useState<"frontend" | "backend">("backend");

  // Backend state
  const [beSelection, setBeSelection] = useState<Selection>({ nodeId: null });
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const beRef = useRef<BECanvasRef>(null);

  // Frontend state
  const feRef = useRef<FECanvasRef>(null);
  const [feSel, setFeSel] = useState<FESelection | null>(null);
  const [feBlock, setFeBlock] = useState<any | null>(null);

  useEffect(() => {
    const scroller = document.querySelector("div.overflow-y-auto") as HTMLElement | null;
    const prev = scroller?.style.overflowY;
    if (scroller) {
      scroller.style.overflowY = "hidden";
      scroller.scrollTop = 0;
    }
    return () => {
      if (scroller) scroller.style.overflowY = prev || "auto";
    };
  }, []);

  // Block library “Add” -> backend canvas
  useEffect(
    () =>
      on("canvas:add-node", ({ specId }: { specId: string }) =>
        beRef.current?.addNodeAtCenter?.(specId)
      ),
    []
  );

  // Backend live stats
  useEffect(() => {
    const id = setInterval(() => {
      const g =
        beRef.current?.getGraph?.() ||
        beRef.current?.getElements?.() ||
        null;
      if (g) {
        const nodes = Array.isArray((g as any).nodes)
          ? (g as any).nodes.length
          : Array.isArray(g) && g[0]
          ? g[0].length
          : 0;
        const edges = Array.isArray((g as any).edges)
          ? (g as any).edges.length
          : Array.isArray(g) && g[1]
          ? g[1].length
          : 0;
        setStats({ nodes, edges });
      }
    }, 700);
    return () => clearInterval(id);
  }, []);

  // Run (backend)
  const runWorkflow = async () => {
    emit("workflow:status", { phase: "starting" });
    try {
      const graph =
        beRef.current?.getGraph?.() ||
        beRef.current?.exportJSON?.() ||
        { nodes: [], edges: [] };
      const res = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graph),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      emit("workflow:status", { phase: "finished", data });
    } catch (e: any) {
      emit("workflow:status", {
        phase: "error",
        message:
          e?.message ||
          "We couldn't start the run. Check the server or try again.",
      });
    }
  };

  const ModeToggle = () => (
    <div className="edge-toggle-wrap">
      <div className="edge-toggle-inner">
        <button
          onClick={() => setMode("frontend")}
          className={cx("edge-toggle-btn", mode === "frontend" && "is-active")}
        >
          <Globe2 size={14} />
          Frontend
        </button>
        <button
          onClick={() => setMode("backend")}
          className={cx("edge-toggle-btn", mode === "backend" && "is-active")}
        >
          <Code2 size={14} />
          Backend
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full">
      {/* Header */}
      <div className="px-6 pt-4 relative z-[20]">
        <div className="edge-glass edge-border rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold">Builder</h3>
            <ModeToggle />
          </div>

          <div className="relative flex items-center gap-2">
            <div className="rounded-full px-3 py-1.5 text-sm edge-glass edge-border flex items-center gap-2">
              <BarChart3 size={16} />
              <span className="opacity-80">Statistics</span>
              <span className="opacity-70 ml-2">{stats.nodes}n</span>
              <span className="opacity-50">/</span>
              <span className="opacity-70">{stats.edges}e</span>
            </div>

            {mode === "backend" && (
              <>
                <button
                  className="rounded-full px-4 py-2 text-sm font-medium edge-glass edge-border flex items-center gap-2 hover:bg-white/10"
                  onClick={runWorkflow}
                >
                  <Play size={16} /> Run
                </button>
                <button
                  className="rounded-full px-4 py-2 text-sm font-medium edge-glass edge-border flex items-center gap-2 hover:bg-white/10"
                  onClick={() => emit("workflow:publish")}
                >
                  <Rocket size={16} /> Publish
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GAP under topbar */}
      <div className="h-2" />

      {/* Panels */}
      <div className="px-6 pb-4">
        <PanelGroup
          direction="horizontal"
          className="rounded-2xl overflow-hidden edge-border w-full"
          style={{ height: BUILDER_HEIGHT }}
        >
          {/* Library */}
          <Panel defaultSize={22} minSize={16} maxSize={36}>
            <div className="h-full pr-2">
              <div className="h-full ml-2 edge-glass edge-border rounded-2xl overflow-hidden">
                <div className="h-full overflow-auto p-5">
                  {mode === "backend" ? <BlockLibrary /> : <FEBlockLibrary onAdd={(t)=>feRef.current?.addBlock(t)} />}
                </div>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 relative group">
            <span className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-[2px] rounded-full edge-grad opacity-60 group-hover:opacity-100" />
          </PanelResizeHandle>

          {/* Canvas */}
          <Panel defaultSize={56} minSize={36} maxSize={68}>
            <div className="h-full px-2">
              <div className="h-full edge-glass edge-border rounded-2xl overflow-hidden">
                {mode === "backend" ? (
                  <ReactFlowCanvas
                    ref={beRef}
                    onSelectionChange={(s) => setBeSelection(s)}
                  />
                ) : (
                  <FECanvas
                    ref={feRef}
                    onSelectionChange={(sel, block) => {
                      // this handler is memoized in FECanvas to avoid loops
                      setFeSel(sel);
                      setFeBlock(block || null);
                    }}
                  />
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 relative group">
            <span className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-[2px] rounded-full edge-grad opacity-60 group-hover:opacity-100" />
          </PanelResizeHandle>

          {/* Inspector */}
          <Panel defaultSize={22} minSize={16} maxSize={36}>
            <div className="h-full pl-2">
              <div className="h-full mr-2 edge-glass edge-border rounded-2xl overflow-hidden">
                <div className="h-full overflow-auto p-5">
                  <h4 className="text-lg font-semibold mb-3">Inspector</h4>

                  {mode === "backend" ? (
                    !beSelection.nodeId ? (
                      <p className="text-sm text-white/60">
                        Select a node to edit its properties.
                      </p>
                    ) : (
                      <>
                        <div className="text-xs text-white/60 mb-2">
                          Node ID:{" "}
                          <span className="text-white/90">
                            {beSelection.nodeId}
                          </span>
                        </div>
                        {/* simple name/description editors unchanged */}
                      </>
                    )
                  ) : (
                    <FEInspector
                      selection={feSel}
                      block={feBlock}
                      onChange={(patch) => feRef.current?.updateBlock(patch)}
                    />
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

/* ---- toggle styling (gradient ring, grey fill, active pill) ---- */
declare global { interface Window { } }
