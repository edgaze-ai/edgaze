"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../components/auth/AuthContext";
import {
  BarChart3,
  CheckCircle2,
  Workflow,
  Sparkles,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  Activity,
} from "lucide-react";

type RunRow = {
  id: string;
  kind: string;
  workflow_id?: string | null;
  prompt_id?: string | null;
  creator_user_id?: string | null;
  creator_handle?: string | null;
  creator_name?: string | null;
  started_at: string;
  ended_at?: string | null;
  status: string;
  error_message?: string | null;
  duration_ms?: number | null;
  tokens_in?: number | null;
  model?: string | null;
  metadata?: Record<string, unknown> | null;
};

type NodeLog = {
  node_id: string;
  spec_id: string;
  status: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  error_message?: string | null;
  tokens_used?: number | null;
  model?: string | null;
  retries: number;
};

type TimePoint = { date: string; count: number };

function fmtDate(ts: string) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function fmtShort(ts: string) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

function MiniBarChart({ data, color, max }: { data: TimePoint[]; color: string; max: number }) {
  const m = max > 0 ? max : 1;
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((d, i) => (
        <div
          key={d.date}
          className="flex-1 min-w-0 rounded-t transition-all hover:opacity-90"
          style={{
            height: `${Math.max(2, (d.count / m) * 100)}%`,
            backgroundColor: color,
          }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  );
}

const cardClass =
  "rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-white/[0.01] shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_4px_24px_-4px_rgba(0,0,0,0.4)]";

export default function AdminRunsPage() {
  const { getAccessToken } = useAuth();
  const [range, setRange] = useState<"7d" | "30d" | "90d">("7d");
  const [kind, setKind] = useState<"" | "workflow" | "prompt">("");
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [aggregates, setAggregates] = useState({
    totalRuns: 0,
    workflowRuns: 0,
    promptRuns: 0,
    successCount: 0,
    errorCount: 0,
    successRate: 0,
  });
  const [timeSeries, setTimeSeries] = useState<{
    workflow: TimePoint[];
    prompt: TimePoint[];
    total: TimePoint[];
  }>({ workflow: [], prompt: [], total: [] });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailRun, setDetailRun] = useState<RunRow | null>(null);
  const [detailLogs, setDetailLogs] = useState<NodeLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const params = new URLSearchParams();
      params.set("range", range);
      if (kind) params.set("kind", kind);
      if (creatorSearch.trim()) params.set("creator", creatorSearch.trim());
      params.set("page", String(page));
      params.set("limit", "50");
      const res = await fetch(`/api/admin/runs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load runs");
      }
      const data = await res.json();
      const newRuns = data.runs ?? [];
      setRuns((prev) => (page === 1 ? newRuns : [...prev, ...newRuns]));
      setTotal(data.total ?? 0);
      setAggregates(data.aggregates ?? {
        totalRuns: 0,
        workflowRuns: 0,
        promptRuns: 0,
        successCount: 0,
        errorCount: 0,
        successRate: 0,
      });
      setTimeSeries(data.timeSeries ?? { workflow: [], prompt: [], total: [] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [range, kind, creatorSearch, page, getAccessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(
    async (runId: string) => {
      setDetailLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(`/api/admin/runs/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load run details");
        const data = await res.json();
        setDetailRun(data.run);
        setDetailLogs(data.nodeLogs ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setDetailLoading(false);
      }
    },
    [getAccessToken]
  );

  const openDetail = (run: RunRow) => {
    setDetailRun(run);
    setDetailLogs([]);
    loadDetail(run.id);
  };


  const maxCount = useMemo(() => {
    const all = [...(timeSeries.total ?? []), ...(timeSeries.workflow ?? []), ...(timeSeries.prompt ?? [])];
    return Math.max(1, ...all.map((d) => d.count));
  }, [timeSeries]);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.style.overflowY = "auto";
    main.style.overflowX = "hidden";
    return () => {
      main.style.overflowY = "";
      main.style.overflowX = "";
    };
  }, []);

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Run analytics
        </h1>
        <p className="mt-1 text-[13px] text-white/50">
          Track workflow and prompt runs, success rate, and performance
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
                range === r
                  ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-white/55 hover:text-white/85 hover:bg-white/[0.05]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {(["", "workflow", "prompt"] as const).map((k) => (
            <button
              key={k || "all"}
              onClick={() => setKind(k)}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-all flex items-center gap-2 ${
                kind === k
                  ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-white/55 hover:text-white/85 hover:bg-white/[0.05]"
              }`}
            >
              {k === "" ? "All" : k === "workflow" ? <Workflow className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {k === "" ? "All" : k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            value={creatorQuery}
            onChange={(e) => setCreatorQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setCreatorSearch(creatorQuery)}
            placeholder="Search creator (handle, name…)"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 py-2.5 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
          />
          <button
            onClick={() => setCreatorSearch(creatorQuery)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-cyan-400 hover:bg-cyan-500/15 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">Total runs</span>
            <Activity className="h-4 w-4 text-white/30" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {loading ? "—" : aggregates.totalRuns}
          </p>
          <p className="mt-1 text-[12px] text-white/45">Completed (success or error)</p>
        </div>
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">Workflow runs</span>
            <Workflow className="h-4 w-4 text-cyan-400/60" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-cyan-300/95">
            {loading ? "—" : aggregates.workflowRuns}
          </p>
        </div>
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">Prompt runs</span>
            <Sparkles className="h-4 w-4 text-amber-400/60" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-300/95">
            {loading ? "—" : aggregates.promptRuns}
          </p>
        </div>
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">Success rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400/60" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-300/95">
            {loading ? "—" : `${aggregates.successRate}%`}
          </p>
          <p className="mt-1 text-[12px] text-white/45">
            {aggregates.successCount} success / {aggregates.errorCount} errors
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`${cardClass} p-6 lg:col-span-2`}>
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/55 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overall runs
          </h3>
          <div className="mt-4">
            {loading ? (
              <div className="h-24 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : (
              <MiniBarChart data={timeSeries.total} color="rgba(34,211,238,0.5)" max={maxCount} />
            )}
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-white/40">
            {timeSeries.total?.length
              ? `${fmtShort(timeSeries.total[0]?.date ?? "")} – ${fmtShort(timeSeries.total[timeSeries.total.length - 1]?.date ?? "")}`
              : "No data"}
          </div>
        </div>
        <div className={`${cardClass} p-6`}>
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/55">By kind</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] text-cyan-400/90 mb-1">
                <Workflow className="h-3.5 w-3.5" /> Workflow
              </div>
              {loading ? (
                <div className="h-8 bg-white/5 rounded" />
              ) : (
                <MiniBarChart data={timeSeries.workflow} color="rgba(34,211,238,0.4)" max={maxCount} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-[12px] text-amber-400/90 mb-1">
                <Sparkles className="h-3.5 w-3.5" /> Prompt
              </div>
              {loading ? (
                <div className="h-8 bg-white/5 rounded" />
              ) : (
                <MiniBarChart data={timeSeries.prompt} color="rgba(251,191,36,0.4)" max={maxCount} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Run list */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white/55">
            Run log
          </h3>
          <span className="text-[13px] font-medium tabular-nums text-white/55">
            {loading ? "Loading…" : `${total} runs`}
          </span>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400/60" />
            <p className="mt-3 text-[13px] text-white/45">Loading runs…</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-12 w-12 text-white/20" />
            <p className="mt-3 text-[13px] text-white/45">No runs in this period</p>
            <p className="mt-1 text-[12px] text-white/35">Try a different range or filter</p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {runs.map((run) => {
              const isExpanded = expandedId === run.id;
              const isSuccess = run.status === "success";
              return (
                <div
                  key={run.id}
                  className="border-b border-white/[0.05] last:border-0 transition-colors hover:bg-white/[0.02]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : run.id);
                      if (!isExpanded) openDetail(run);
                    }}
                    className="w-full flex items-center gap-4 px-6 py-4 text-left"
                  >
                    <span className="text-white/40">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <span
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        run.kind === "workflow"
                          ? "bg-cyan-500/15 text-cyan-400/90"
                          : "bg-amber-500/15 text-amber-400/90"
                      }`}
                    >
                      {run.kind === "workflow" ? <Workflow className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-white/90 capitalize">{run.kind}</span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase ${
                            isSuccess
                              ? "border-emerald-400/25 bg-emerald-500/15 text-emerald-300/95"
                              : "border-red-400/25 bg-red-500/15 text-red-300/95"
                          }`}
                        >
                          {run.status}
                        </span>
                        {run.creator_handle && (
                          <span className="text-[12px] text-white/55">
                            @{run.creator_handle}
                            {run.creator_name ? ` (${run.creator_name})` : ""}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-white/45 flex items-center gap-3">
                        <span>{fmtDate(run.started_at)}</span>
                        {run.duration_ms != null && (
                          <span>{run.duration_ms}ms</span>
                        )}
                        {run.tokens_in != null && run.tokens_in > 0 && (
                          <span>{run.tokens_in} tok</span>
                        )}
                        {run.model && <span>{run.model}</span>}
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-6 pb-4 pl-[4.5rem]">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                        <div className="grid gap-2 text-[12px] sm:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white/45">ID:</span>
                            <code className="text-white/75 font-mono truncate">{run.id}</code>
                          </div>
                          {run.workflow_id && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/45">Workflow:</span>
                              <code className="text-white/75 font-mono truncate">{run.workflow_id}</code>
                            </div>
                          )}
                          {run.error_message && (
                            <div className="sm:col-span-2 text-red-300/90">{run.error_message}</div>
                          )}
                        </div>
                        {detailLoading ? (
                          <div className="flex items-center gap-2 text-white/45 py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading node logs…
                          </div>
                        ) : detailLogs.length > 0 ? (
                          <div className="mt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45 mb-2">
                              Node logs
                            </p>
                            <div className="space-y-1.5">
                              {detailLogs.map((log) => (
                                <div
                                  key={log.node_id}
                                  className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-[12px]"
                                >
                                  <span className="font-mono text-cyan-400/90">{log.spec_id}</span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      log.status === "success"
                                        ? "bg-emerald-500/20 text-emerald-300/95"
                                        : "bg-red-500/20 text-red-300/95"
                                    }`}
                                  >
                                    {log.status}
                                  </span>
                                  {log.duration_ms != null && (
                                    <span className="text-white/45">{log.duration_ms}ms</span>
                                  )}
                                  {log.tokens_used != null && log.tokens_used > 0 && (
                                    <span className="text-white/45">{log.tokens_used} tok</span>
                                  )}
                                  {log.model && (
                                    <span className="text-white/45">{log.model}</span>
                                  )}
                                  {log.error_message && (
                                    <span className="text-red-300/80 truncate max-w-[200px]" title={log.error_message}>
                                      {log.error_message}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {runs.length > 0 && total > runs.length && (
          <div className="border-t border-white/[0.06] px-6 py-3 flex justify-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-white/80 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              Load more
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
