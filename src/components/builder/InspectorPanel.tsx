"use client";

import { useMemo, useState, useEffect } from "react";
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
    <div className="rounded-2xl bg-[#0f1115]/80 border border-white/10 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2 opacity-90">
        {icon}
        <div className="text-[16px] font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

const Input = (props: any) => (
  <input
    {...props}
    className={`w-full rounded-xl px-3 py-2 text-sm bg-[#0d0f12] border border-white/10 
    focus:outline-none focus:ring-2 focus:ring-white/10 ${props.className ?? ""}`}
  />
);

const TextArea = (props: any) => (
  <textarea
    {...props}
    className={`w-full rounded-xl px-3 py-2 text-sm bg-[#0d0f12] border border-white/10 
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
    <div className="space-y-6 pt-3">
      <Card title="Basic Info" icon={<Settings size={16} />}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/60">Display Name</label>
            <Input
              defaultValue={cfg.name ?? spec.label}
              onBlur={(e) => onUpdate({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Description</label>
            <TextArea
              rows={3}
              defaultValue={cfg.description ?? spec.summary}
              onBlur={(e) => onUpdate({ description: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card title="Execution" icon={<Sliders size={16} />}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/60">Timeout (ms)</label>
            <Input
              type="number"
              defaultValue={cfg.timeout ?? 8000}
              onBlur={(e) => onUpdate({ timeout: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Retry Attempts</label>
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
    <div className="space-y-6 pt-3">
      <Card title="Input Parameters">
        {spec.ports
          .filter((p: any) => p.kind === "input")
          .map((port: any) => (
            <div key={port.id} className="border-b border-white/5 pb-4 mb-4">
              <div className="font-medium text-white/90">{port.id}</div>
              <div className="text-xs text-white/60 mb-2">{port.label}</div>

              <label className="text-xs text-white/60">Default Value</label>
              <Input
                defaultValue={cfg[port.id] ?? ""}
                onBlur={(e) =>
                  onUpdate({
                    [port.id]: e.target.value,
                  })
                }
              />
            </div>
          ))}
      </Card>
    </div>
  );
}

/* -------- Outputs Panel -------- */
function OutputsPanel({ spec }: { spec: any }) {
  return (
    <div className="space-y-6 pt-3">
      <Card title="Output Variables">
        {spec.ports
          .filter((p: any) => p.kind === "output")
          .map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-white/5 py-3"
            >
              <div>
                <div className="font-medium">{p.id}</div>
                <div className="text-xs text-white/60">{p.label}</div>
              </div>
              <div className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10">
                {p.type ?? "any"}
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
}

/* -------- Logic Panel -------- */
function LogicPanel({
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
    <div className="space-y-6 pt-3">
      <Card title="Node Logic" icon={<Code2 size={16} />}>
        {spec.logicFields?.map((field: any) => (
          <div key={field.id} className="mb-4">
            <label className="text-xs text-white/60">{field.label}</label>

            {field.type === "string" && (
              <Input
                defaultValue={cfg[field.id] ?? ""}
                onBlur={(e) => onUpdate({ [field.id]: e.target.value })}
              />
            )}

            {field.type === "json" && (
              <TextArea
                rows={6}
                defaultValue={cfg[field.id] ?? ""}
                onBlur={(e) => onUpdate({ [field.id]: e.target.value })}
              />
            )}
          </div>
        ))}

        {!spec.logicFields && (
          <div className="text-sm text-white/60">
            This node has no additional logic settings.
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   MAIN INSPECTOR COMPONENT
============================================================ */
export default function InspectorPanel({
  selection,
  onUpdateNodeConfig,
  workflowId,
}: {
  selection: Selection;
  onUpdateNodeConfig?: (nodeId: string, patch: any) => void;
  workflowId?: string;
}) {
  const selected = Boolean(selection.nodeId);

  const { data: analytics, state: aState } = useAnalytics(
    selected ? undefined : workflowId
  );
  const { data: community, state: cState } = useCommunity(
    selected ? undefined : workflowId
  );

  const spec = useMemo(
    () => (selection.specId ? getNodeSpec(selection.specId) : null),
    [selection.specId]
  );

  const [tab, setTab] = useState<"general" | "inputs" | "outputs" | "logic">(
    "general"
  );

  const update = (patch: any) => {
    if (selection.nodeId) onUpdateNodeConfig?.(selection.nodeId, patch);
  };

  /* -------- Empty state (no node selected) -------- */
  if (!selection.nodeId) {
    return (
      <div className="h-full overflow-auto p-5">
        <div className="mb-4 flex items-center gap-2">
          <Eye size={18} />
          <h4 className="text-xl font-semibold">Inspector</h4>
        </div>

        <div className="my-10 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <Eye size={24} className="opacity-70" />
          </div>
          <div className="text-lg text-white/80">
            Select a block to edit its properties
          </div>
          <div className="text-sm text-white/55">
            Drag blocks from the left, then click them to edit.
          </div>
        </div>

        {/* Analytics */}
        <div className="space-y-4">
          <Card title="Workflow Analytics" icon={<TrendingUp size={16} />}>
            {aState !== "ready" || !analytics ? (
              <div className="text-sm text-white/60">Analytics not available</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-[15px]">
                <div>
                  <div className="text-white/65">Total Runs</div>
                  <div className="mt-1 font-semibold">
                    {analytics.totalRuns.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-white/65">Success Rate</div>
                  <div className="mt-1 font-semibold text-emerald-300">
                    {(analytics.successRate * 100).toFixed(1)}%
                  </div>
                </div>

                <div>
                  <div className="text-white/65">Avg Response</div>
                  <div className="mt-1 font-semibold">
                    {Math.round(analytics.avgResponseMs)}ms
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Community" icon={<Users size={16} />}>
            {cState !== "ready" || !community ? (
              <div className="text-sm text-white/60">
                Community stats unavailable
              </div>
            ) : (
              <ul className="list-disc pl-5 text-[15px] text-white/85">
                <li>
                  {community.todayUsers.toLocaleString()} people used this today
                </li>
                <li>
                  {community.weeklyRemixes.toLocaleString()} remixes this week
                </li>
                {community.featured && <li>Featured in trending workflows</li>}
              </ul>
            )}
          </Card>
        </div>
      </div>
    );
  }

  /* -------- Node selected: Render tab system -------- */

  return (
    <div className="h-full overflow-auto">
      {/* Tab Bar */}
      <div className="sticky top-0 z-20 bg-[#0d0f12]/80 backdrop-blur-md border-b border-white/10 px-5 py-3 flex gap-4">
        <button
          className={`text-sm ${
            tab === "general" ? "text-white font-semibold" : "text-white/50"
          }`}
          onClick={() => setTab("general")}
        >
          General
        </button>
        <button
          className={`text-sm ${
            tab === "inputs" ? "text-white font-semibold" : "text-white/50"
          }`}
          onClick={() => setTab("inputs")}
        >
          Inputs
        </button>
        <button
          className={`text-sm ${
            tab === "outputs" ? "text-white font-semibold" : "text-white/50"
          }`}
          onClick={() => setTab("outputs")}
        >
          Outputs
        </button>
        <button
          className={`text-sm ${
            tab === "logic" ? "text-white font-semibold" : "text-white/50"
          }`}
          onClick={() => setTab("logic")}
        >
          Logic
        </button>
      </div>

      {/* Active Panel */}
      <div className="p-5">
        {tab === "general" && spec && (
          <GeneralPanel selection={selection} spec={spec} onUpdate={update} />
        )}

        {tab === "inputs" && spec && (
          <InputsPanel selection={selection} spec={spec} onUpdate={update} />
        )}

        {tab === "outputs" && spec && <OutputsPanel spec={spec} />}

        {tab === "logic" && spec && (
          <LogicPanel selection={selection} spec={spec} onUpdate={update} />
        )}
      </div>
    </div>
  );
}
