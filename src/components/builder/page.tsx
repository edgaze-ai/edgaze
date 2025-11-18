"use client";

import { useEffect, useState } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import BlockLibrary from "@components/builder/BlockLibrary";
import ReactFlowCanvas from "@components/builder/ReactFlowCanvas";
import { cx } from "@lib/cx";

const BUILDER_HEIGHT = "calc(100vh - 120px)";

export default function BuilderPage() {
  const [mode, setMode] = useState<"frontend" | "backend">("frontend");

  useEffect(() => {
    // Disable page scroll only while on builder
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

  return (
    <div className="h-full w-full">
      {/* Header (unchanged) */}
      <div className="px-6 pt-4">
        <div className="edge-glass edge-border rounded-2xl px-4 py-3 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Builder</h3>
          <div className="relative -top-[4px] rounded-full p-[1.5px] edge-grad">
            <div className="rounded-full edge-glass edge-border px-1 py-[6px] text-xs leading-none">
              <button
                onClick={() => setMode("frontend")}
                className={cx("rounded-full px-3 py-1", mode === "frontend" && "bg-white/10")}
              >
                Frontend
              </button>
              <button
                onClick={() => setMode("backend")}
                className={cx("rounded-full px-3 py-1", mode === "backend" && "bg-white/10")}
              >
                Backend
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === FULL-WIDTH PANEL GROUP === */}
      {/* The visible separation: real margin-top of 7px */}
      <div className="px-6 mt-[7px] pb-4">
        <PanelGroup
          direction="horizontal"
          className="rounded-2xl overflow-hidden edge-border w-full"
          style={{ height: BUILDER_HEIGHT }}
        >
          {/* Library */}
          <Panel defaultSize={22} minSize={16} maxSize={36}>
            <div className="h-full pr-2">
              <div className="h-full ml-2 edge-glass edge-border rounded-2xl overflow-hidden bg-white/5">
                <div className="h-full overflow-auto p-5">
                  <BlockLibrary />
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
                <ReactFlowCanvas />
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
                  <label className="block text-sm text-white/70">Name</label>
                  <input
                    className="mt-1 w-full rounded-xl px-3 py-2 text-sm bg-transparent edge-border"
                    placeholder="My node"
                  />
                  <label className="mt-4 block text-sm text-white/70">Description</label>
                  <textarea
                    className="mt-1 w-full rounded-xl px-3 py-2 text-sm bg-transparent edge-border"
                    rows={8}
                    placeholder="What does this block do?"
                  />
                  <div className="mt-4 flex items-center justify-between">
                    <button className="rounded-xl px-3 py-2 text-sm edge-glass edge-border">Copy JSON</button>
                    <span className="inline-flex rounded-full p-[1.5px] edge-grad">
                      <button className="rounded-full px-4 py-2 text-sm font-medium edge-glass edge-border">
                        Save
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
