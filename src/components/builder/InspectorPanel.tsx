"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, TrendingUp, Users } from "lucide-react";

type Selection = {
  nodeId: string | null;
  specId?: string;
  config?: any;
};

type Analytics = {
  totalRuns: number;
  successRate: number;
  avgResponseMs: number;
  live?: boolean;           // optional: backend can set
  runsToday?: number;       // optional
};

type Community = {
  todayUsers: number;
  weeklyRemixes: number;
  featured?: boolean;
};

async function safeJSON<T>(res: Response): Promise<T | null> {
  try {
    const txt = await res.text();
    if (!txt) return null;
    return JSON.parse(txt) as T;
  } catch { return null; }
}

function useAnalytics(workflowId?: string) {
  const [data, setData] = useState<Analytics | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");

  useEffect(() => {
    if (!workflowId) { setState("missing"); setData(null); return; }
    let aborted = false;
    setState("loading");
    const ctl = new AbortController();
    fetch(`/api/analytics/workflow?workflowId=${encodeURIComponent(workflowId)}`, { signal: ctl.signal })
      .then(async (res) => {
        if (aborted) return;
        if (res.status === 404) { setState("missing"); setData(null); return; }
        if (!res.ok) { setState("error"); setData(null); return; }
        const json = await safeJSON<Analytics>(res);
        if (!json) { setState("missing"); setData(null); return; }
        setData(json); setState("ready");
      })
      .catch(() => { if (!aborted) { setState("error"); setData(null); } });
    return () => { aborted = true; ctl.abort(); };
  }, [workflowId]);

  return { data, state };
}

function useCommunity(workflowId?: string) {
  const [data, setData] = useState<Community | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");

  useEffect(() => {
    if (!workflowId) { setState("missing"); setData(null); return; }
    let aborted = false;
    setState("loading");
    const ctl = new AbortController();
    fetch(`/api/community/workflow?workflowId=${encodeURIComponent(workflowId)}`, { signal: ctl.signal })
      .then(async (res) => {
        if (aborted) return;
        if (res.status === 404) { setState("missing"); setData(null); return; }
        if (!res.ok) { setState("error"); setData(null); return; }
        const json = await safeJSON<Community>(res);
        if (!json) { setState("missing"); setData(null); return; }
        setData(json); setState("ready");
      })
      .catch(() => { if (!aborted) { setState("error"); setData(null); } });
    return () => { aborted = true; ctl.abort(); };
  }, [workflowId]);

  return { data, state };
}

/* ---------- UI bits ---------- */
function Card({
  title, icon, children,
}: { title: React.ReactNode; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1115] p-4">
      <div className="mb-3 flex items-center gap-2">{icon}<div className="text-[16px] font-semibold">{title}</div></div>
      {children}
    </div>
  );
}
const Muted = ({ children }: { children: React.ReactNode }) => <span className="text-white/65">{children}</span>;
const Pretty = ({ children }: { children: number | string }) => <span className="font-semibold tabular-nums">{children}</span>;

export default function InspectorPanel({
  selection, onUpdateNodeConfig, workflowId,
}: {
  selection: Selection;
  onUpdateNodeConfig?: (nodeId: string, patch: any) => void;
  workflowId?: string;
}) {
  const selected = Boolean(selection.nodeId);
  const { data: analytics, state: aState } = useAnalytics(selected ? undefined : workflowId);
  const { data: community, state: cState } = useCommunity(selected ? undefined : workflowId);

  const successRateText = useMemo(() => {
    if (!analytics) return null;
    const r = analytics.successRate > 1 ? analytics.successRate : analytics.successRate * 100;
    return `${r.toFixed(1)}%`;
  }, [analytics]);

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-4 flex items-center gap-2">
        <Eye size={18} className="opacity-80" />
        <h4 className="text-xl font-semibold">Inspector</h4>
      </div>

      {!selection.nodeId ? (
        <>
          {/* Empty state visual */}
          <div className="my-10 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <Eye size={24} className="opacity-70" />
            </div>
            <div className="text-lg text-white/80">Select a block to edit its properties</div>
            <div className="text-sm text-white/55">Tip: drag blocks from the left, then click them to edit.</div>
          </div>

          {/* Analytics Card (no debug text; clear empty states) */}
          <div className="space-y-4">
            <Card title="Workflow Analytics" icon={<TrendingUp size={16} className="text-cyan-300" />}>
              {aState === "loading" && (
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-white/10" />
                  <div className="h-4 w-48 rounded bg-white/10" />
                  <div className="h-4 w-44 rounded bg-white/10" />
                </div>
              )}
              {aState === "missing" && (
                <div className="text-sm text-white/65">Analytics aren’t set up yet.</div>
              )}
              {aState === "error" && (
                <div className="text-sm text-white/65">Couldn’t load analytics.</div>
              )}
              {aState === "ready" && analytics && (
                <div className="grid grid-cols-2 gap-4 text-[15px]">
                  <div><Muted>Total Runs</Muted><div className="mt-1"><Pretty>{analytics.totalRuns.toLocaleString()}</Pretty></div></div>
                  <div><Muted>Success Rate</Muted><div className="mt-1 text-emerald-300"><Pretty>{successRateText}</Pretty></div></div>
                  <div><Muted>Avg. Response</Muted><div className="mt-1"><Pretty>{Math.round(analytics.avgResponseMs)}ms</Pretty></div></div>
                </div>
              )}
            </Card>

            <Card title="Community" icon={<Users size={16} className="text-violet-300" />}>
              {cState === "loading" && (
                <div className="space-y-2">
                  <div className="h-4 w-72 rounded bg-white/10" />
                  <div className="h-4 w-64 rounded bg-white/10" />
                </div>
              )}
              {cState === "missing" && (
                <div className="text-sm text-white/65">Community stats aren’t connected.</div>
              )}
              {cState === "error" && (
                <div className="text-sm text-white/65">Couldn’t load community data.</div>
              )}
              {cState === "ready" && community && (
                <ul className="list-disc pl-5 text-[15px] leading-7 text-white/85">
                  <li><Pretty>{community.todayUsers.toLocaleString()}</Pretty> people used this today</li>
                  <li><Pretty>{community.weeklyRemixes.toLocaleString()}</Pretty> remixes this week</li>
                  {community.featured && <li>Featured in “Trending Workflows”</li>}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : (
        /* Node editor */
        <div>
          <div className="text-xs text-white/60 mb-2">
            Node ID: <span className="text-white/90">{selection.nodeId}</span>
          </div>

          <label className="block text-sm text-white/70">Name (nickname)</label>
          <input
            className="mt-1 w-full rounded-xl px-3 py-2 text-sm bg-transparent border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/10"
            placeholder="My block"
            defaultValue={selection?.config?.name ?? ""}
            onBlur={(e) =>
              selection.nodeId && onUpdateNodeConfig?.(selection.nodeId, { name: e.target.value })
            }
          />

          <label className="mt-4 block text-sm text-white/70">Description</label>
          <textarea
            className="mt-1 w-full rounded-xl px-3 py-2 text-sm bg-transparent border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/10"
            rows={8}
            placeholder="What does this block do?"
            defaultValue={selection?.config?.description ?? ""}
            onBlur={(e) =>
              selection.nodeId && onUpdateNodeConfig?.(selection.nodeId, { description: e.target.value })
            }
          />

          <div className="mt-4 flex items-center justify-between">
            <button
              className="rounded-xl px-3 py-2 text-sm border border-white/10 bg-white/5 hover:bg-white/10 transition"
              onClick={() => {
                if (!selection.nodeId) return;
                navigator.clipboard.writeText(JSON.stringify(selection?.config ?? {}, null, 2));
              }}
            >
              Copy JSON
            </button>
            <div className="inline-flex rounded-full p-[1.5px] bg-white/5 border border-white/10">
              <button className="rounded-full px-4 py-2 text-sm font-medium bg-[#121316] hover:bg-[#1a1b20] transition">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
