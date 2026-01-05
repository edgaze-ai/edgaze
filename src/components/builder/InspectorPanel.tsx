// src/components/builder/InspectorPanel.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Eye, TrendingUp, Users, Settings, Sliders, Code2 } from "lucide-react";
import { getNodeSpec } from "src/nodes/registry";

/* -------------------- Types -------------------- */
type Selection = {
  nodeId: string | null;
  specId?: string;
  config?: any;
};

type Analytics = {
  totalRuns: number;
  successRate: number;
  avgResponseMs: number;
};

type Community = {
  todayUsers: number;
  weeklyRemixes: number;
  featured?: boolean;
};

/* -------------------- Utility -------------------- */
async function safeJSON<T>(res: Response): Promise<T | null> {
  try {
    const txt = await res.text();
    if (!txt) return null;
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

/* -------------------- External Fetch Hooks -------------------- */
function useAnalytics(workflowId?: string) {
  const [data, setData] = useState<Analytics | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "missing" | "error"
  >("idle");

  useEffect(() => {
    if (!workflowId) {
      setState("missing");
      setData(null);
      return;
    }

    let aborted = false;
    setState("loading");

    fetch(`/api/analytics/workflow?workflowId=${workflowId}`)
      .then(async (res) => {
        if (aborted) return;

        if (res.status === 404) {
          setState("missing");
          setData(null);
          return;
        }

        if (!res.ok) {
          setState("error");
          setData(null);
          return;
        }

        const json = await safeJSON<Analytics>(res);
        if (!json) {
          setState("missing");
          setData(null);
          return;
        }

        setData(json);
        setState("ready");
      })
      .catch(() => {
        if (!aborted) {
          setState("error");
          setData(null);
        }
      });

    return () => {
      aborted = true;
    };
  }, [workflowId]);

  return { data, state };
}

function useCommunity(workflowId?: string) {
  const [data, setData] = useState<Community | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "missing" | "error"
  >("idle");

  useEffect(() => {
    if (!workflowId) {
      setState("missing");
      setData(null);
      return;
    }

    let aborted = false;
    setState("loading");

    fetch(`/api/community/workflow?workflowId=${workflowId}`)
      .then(async (res) => {
        if (aborted) return;

        if (res.status === 404) {
          setState("missing");
          setData(null);
          return;
        }

        if (!res.ok) {
          setState("error");
          setData(null);
          return;
        }

        const json = await safeJSON<Community>(res);
        if (!json) {
          setState("missing");
          setData(null);
          return;
        }

        setData(json);
        setState("ready");
      })
      .catch(() => {
        if (!aborted) {
          setState("error");
          setData(null);
        }
      });

    return () => {
      aborted = true;
    };
  }, [workflowId]);

  return { data, state };
}

/* -------------------- UI Helpers -------------------- */
function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[#0f1115]/75 border border-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="mb-2.5 flex items-center gap-2 opacity-90">
        {icon}
        <div className="text-[13px] font-semibold tracking-[0.01em]">
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

const Input = (props: any) => (
  <input
    {...props}
    className={`w-full rounded-xl px-3 py-2 text-[13px] bg-[#0d0f12] border border-white/10 
    focus:outline-none focus:ring-2 focus:ring-white/10 ${props.className ?? ""}`}
  />
);

const TextArea = (props: any) => (
  <textarea
    {...props}
    className={`w-full rounded-xl px-3 py-2 text-[13px] bg-[#0d0f12] border border-white/10 
    focus:outline-none focus:ring-2 focus:ring-white/10 ${props.className ?? ""}`}
  />
);

/* ============================================================
   PANEL IMPLEMENTATIONS
============================================================ */

/* -------- General Panel -------- */
function GeneralPanel({
  selection,
  spec,
  onUpdate,
}: {
  selection: Selection;
  spec: any;
  onUpdate: (p: any) => void;
}) {
  const cfg = selection.config ?? {};

  return (
    <div className="space-y-4 pt-3">
      <Card title="Basic Info" icon={<Settings size={16} />}>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-white/60">Display Name</label>
            <Input
              defaultValue={cfg.name ?? spec.label}
              onBlur={(e) => onUpdate({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[11px] text-white/60">Description</label>
            <TextArea
              rows={3}
              defaultValue={cfg.description ?? spec.summary}
              onBlur={(e) => onUpdate({ description: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card title="Execution" icon={<Sliders size={16} />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-white/60">Timeout (ms)</label>
            <Input
              type="number"
              defaultValue={cfg.timeout ?? 8000}
              onBlur={(e) => onUpdate({ timeout: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="text-[11px] text-white/60">Retry Attempts</label>
            <Input
              type="number"
              defaultValue={cfg.retries ?? 0}
              onBlur={(e) => onUpdate({ retries: Number(e.target.value) })}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* -------- Inputs Panel -------- */
function InputsPanel({
  spec,
  selection,
  onUpdate,
}: {
  spec: any;
  selection: Selection;
  onUpdate: (p: any) => void;
}) {
  const cfg = selection.config ?? {};

  return (
    <div className="space-y-4 pt-3">
      <Card title="Input Parameters">
        {spec.ports
          ?.filter((p: any) => p.kind === "input")
          ?.map((port: any) => (
            <div
              key={port.id}
              className="border-b border-white/5 pb-4 mb-4 last:mb-0 last:pb-0 last:border-b-0"
            >
              <div className="font-medium text-white/90 text-[13px]">
                {port.id}
              </div>
              <div className="text-[11px] text-white/60 mt-0.5">
                {port.label ?? ""}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-white/60">Default</label>
                  <Input
                    defaultValue={cfg?.inputs?.[port.id] ?? ""}
                    onBlur={(e) =>
                      onUpdate({
                        inputs: { ...(cfg.inputs ?? {}), [port.id]: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/60">Type</label>
                  <Input value={port.type ?? "any"} readOnly />
                </div>
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
}

/* -------- Code Panel -------- */
function CodePanel({ selection, spec }: { selection: Selection; spec: any }) {
  const cfg = selection.config ?? {};
  const code = cfg.code ?? spec?.code ?? "";

  return (
    <div className="space-y-4 pt-3">
      <Card title="Node Config" icon={<Code2 size={16} />}>
        <pre className="text-[12px] text-white/70 bg-[#0b0d10] border border-white/10 rounded-xl p-3 overflow-auto">
          {JSON.stringify(cfg, null, 2)}
        </pre>
      </Card>

      <Card title="Implementation (read-only)" icon={<Code2 size={16} />}>
        <pre className="text-[12px] text-white/70 bg-[#0b0d10] border border-white/10 rounded-xl p-3 overflow-auto">
          {String(code)}
        </pre>
      </Card>
    </div>
  );
}

/* ======================= MAIN COMPONENT ======================= */

type TabKey = "general" | "inputs" | "code";

export default function InspectorPanel({
  selection,
  workflowId,
  onUpdate,
}: {
  selection?: Selection; // <-- keep optional + foolproof
  workflowId?: string;
  onUpdate?: (nodeId: string, patch: any) => void;
}) {
  // FOOLPROOF: never crash if selection is undefined
  const safeSelection: Selection = useMemo(
    () => ({
      nodeId: selection?.nodeId ?? null,
      specId: selection?.specId,
      config: selection?.config,
    }),
    [selection?.nodeId, selection?.specId, selection?.config]
  );

  const selected = Boolean(safeSelection.nodeId);
  const [tab, setTab] = useState<TabKey>("general");

  // When selection changes, keep UX predictable
  useEffect(() => {
    setTab("general");
  }, [safeSelection.nodeId, safeSelection.specId]);

  const spec = useMemo(() => {
    if (!safeSelection.specId) return null;
    try {
      return getNodeSpec(safeSelection.specId);
    } catch {
      return null;
    }
  }, [safeSelection.specId]);

  // Only fetch when a node is selected (avoids noise + wasted calls)
  const { data: analytics, state: aState } = useAnalytics(
    selected ? workflowId : undefined
  );
  const { data: community, state: cState } = useCommunity(
    selected ? workflowId : undefined
  );

  const patchNode = (patch: any) => {
    if (!onUpdate) return;
    if (!safeSelection.nodeId) return;
    onUpdate(safeSelection.nodeId, patch);
  };

  const TabPill = ({
    active,
    children,
    onClick,
  }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full border text-[12px]",
        active
          ? "bg-white/10 border-white/12 text-white"
          : "bg-transparent border-white/10 text-white/70 hover:bg-white/5",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );

  return (
    // IMPORTANT: make the panel actually scroll inside the floating window
    <div className="h-full w-full text-white flex flex-col min-h-0">
      {/* Header (fixed) */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-2 opacity-90">
          <Eye size={18} />
          <div className="text-[16px] font-semibold tracking-[0.01em]">
            Inspector
          </div>
        </div>

        {selected && (
          <div className="mt-2 text-[11px] text-white/55 truncate">
            {spec?.label ?? "Block"} · {safeSelection.specId ?? "unknown"}
          </div>
        )}

        {selected && (
          <div className="mt-3 flex gap-2">
            <TabPill active={tab === "general"} onClick={() => setTab("general")}>
              General
            </TabPill>
            <TabPill active={tab === "inputs"} onClick={() => setTab("inputs")}>
              Inputs
            </TabPill>
            <TabPill active={tab === "code"} onClick={() => setTab("code")}>
              Code
            </TabPill>
          </div>
        )}
      </div>

      {/* Scroll area (this fixes the “scrolling not working inside inspector” bug) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 overscroll-contain">
        {!selected && (
          <div className="pt-8 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-white/5 border border-white/10 grid place-items-center">
              <Eye className="opacity-70" />
            </div>
            <div className="mt-4 text-white/85 text-[13px]">
              Select a block to edit its properties
            </div>
            <div className="mt-2 text-[11px] text-white/50">
              Drag blocks from the left, then click them to edit.
            </div>

            <div className="mt-6 space-y-3 text-left">
              <div className="rounded-2xl bg-[#0f1115]/75 border border-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="opacity-80" />
                  <div className="font-semibold text-[13px]">
                    Workflow Analytics
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-white/55">
                  Analytics not available
                </div>
              </div>

              <div className="rounded-2xl bg-[#0f1115]/75 border border-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Users size={16} className="opacity-80" />
                  <div className="font-semibold text-[13px]">Community</div>
                </div>
                <div className="mt-2 text-[11px] text-white/55">
                  Community stats unavailable
                </div>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <>
            {/* Main tab content */}
            {spec ? (
              <>
                {tab === "general" && (
                  <GeneralPanel
                    selection={safeSelection}
                    spec={spec}
                    onUpdate={patchNode}
                  />
                )}
                {tab === "inputs" && (
                  <InputsPanel
                    selection={safeSelection}
                    spec={spec}
                    onUpdate={patchNode}
                  />
                )}
                {tab === "code" && <CodePanel selection={safeSelection} spec={spec} />}
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] text-white/70">
                Spec not found for this node. (The canvas sent an unknown specId.)
              </div>
            )}

            {/* Optional cards */}
            <div className="mt-5 grid grid-cols-1 gap-3">
              <Card title="Workflow Analytics" icon={<TrendingUp size={16} />}>
                {aState !== "ready" || !analytics ? (
                  <div className="text-[11px] text-white/55">
                    Analytics not available
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                      <div className="text-[11px] text-white/50">Runs</div>
                      <div className="mt-1 text-[16px] font-semibold">
                        {analytics.totalRuns}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                      <div className="text-[11px] text-white/50">Success</div>
                      <div className="mt-1 text-[16px] font-semibold">
                        {analytics.successRate}%
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                      <div className="text-[11px] text-white/50">Avg</div>
                      <div className="mt-1 text-[16px] font-semibold">
                        {analytics.avgResponseMs}ms
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Community" icon={<Users size={16} />}>
                {cState !== "ready" || !community ? (
                  <div className="text-[11px] text-white/55">
                    Community stats unavailable
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                      <div className="text-[11px] text-white/50">Today</div>
                      <div className="mt-1 text-[16px] font-semibold">
                        {community.todayUsers}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                      <div className="text-[11px] text-white/50">
                        Weekly remixes
                      </div>
                      <div className="mt-1 text-[16px] font-semibold">
                        {community.weeklyRemixes}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
