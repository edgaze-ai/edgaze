"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Download, Loader2, Search, TimerReset } from "lucide-react";

import { useAuth } from "../../../components/auth/AuthContext";

type TraceSessionRow = {
  id: string;
  kind: string;
  source: string;
  phase: string;
  route_id?: string | null;
  request_path?: string | null;
  workflow_id?: string | null;
  workflow_run_id?: string | null;
  analytics_run_id?: string | null;
  status?: string | null;
  actor_id?: string | null;
  started_at_epoch_ms: number;
  duration_ms?: number | null;
  event_count?: number | null;
  workflow_name?: string | null;
  account_label?: string | null;
  session_count?: number | null;
};

type TimelineEntry = {
  timelineSource: string;
  timestampEpochMs: number;
  sinceSessionStartMs?: number;
  sinceBundleStartMs?: number;
  phase: string;
  source: string;
  sessionId: string;
  sessionKind: string;
  sequence: number;
  severity: string;
  eventName: string;
  nodeId?: string | null;
  attemptNumber?: number | null;
  payload: Record<string, unknown>;
};

type TraceDetail = {
  bundle: Record<string, unknown>;
  run: Record<string, unknown>;
  nodes: Array<Record<string, unknown>>;
  attempts: Array<Record<string, unknown>>;
  nodeExecutionDetails: Array<Record<string, unknown>>;
  dependencyStateByNodeId: Record<string, unknown>;
  streamSummary: Record<string, unknown>;
  streamEvents: TimelineEntry[];
  traceSessions: Array<Record<string, unknown>>;
  traceEntries: Array<Record<string, unknown>>;
  workflowEvents: Array<Record<string, unknown>>;
  timeline: TimelineEntry[];
};

const cardClass =
  "rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-white/[0.01] shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_4px_24px_-4px_rgba(0,0,0,0.4)]";

function formatTime(epochMs: number) {
  if (!Number.isFinite(epochMs)) return "Unknown";
  return new Date(epochMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms?: number | null) {
  if (!ms || ms <= 0) return "0 ms";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function getRelativeMs(item: TimelineEntry) {
  return item.sinceBundleStartMs ?? item.sinceSessionStartMs ?? 0;
}

export default function AdminTracesPage() {
  const { getAccessToken } = useAuth();
  const [range, setRange] = useState<"7d" | "30d" | "90d">("7d");
  const [phase, setPhase] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<TraceSessionRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const params = new URLSearchParams();
      params.set("range", range);
      if (phase) params.set("phase", phase);
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/admin/traces?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load traces");
      setSessions(payload.sessions ?? []);
      if (!selectedSessionId && payload.sessions?.[0]?.id) {
        setSelectedSessionId(payload.sessions[0].id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, phase, range, search, selectedSessionId]);

  const loadDetail = useCallback(
    async (sessionId: string) => {
      setDetailLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const response = await fetch(`/api/admin/traces/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load trace detail");
        setDetail(payload);
      } catch (error) {
        console.error(error);
      } finally {
        setDetailLoading(false);
      }
    },
    [getAccessToken],
  );

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (selectedSessionId) {
      loadDetail(selectedSessionId);
    }
  }, [loadDetail, selectedSessionId]);

  // Enable scrolling like other admin pages
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

  const groupedTimeline = useMemo(() => {
    const groups = new Map<string, TimelineEntry[]>();
    for (const item of detail?.timeline ?? []) {
      const key = item.phase || "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
  }, [detail]);

  const downloadTrace = useCallback(async () => {
    if (!selectedSessionId) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch(`/api/admin/traces/${selectedSessionId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to download trace");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `trace-${selectedSessionId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  }, [getAccessToken, selectedSessionId]);

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Trace timeline</h1>
          <p className="mt-1 text-[13px] text-white/50">
            One heavily detailed trace bundle per workflow run, with the full ordered timeline in
            one place.
          </p>
        </div>
        <button
          onClick={downloadTrace}
          disabled={!selectedSessionId}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download trace
        </button>
      </div>

      <div className={`${cardClass} p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {(["7d", "30d", "90d"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`rounded-lg px-4 py-2 text-[13px] font-medium transition ${
                  range === value ? "bg-white/10 text-white" : "text-white/55 hover:text-white/85"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
            className="rounded-xl border border-white/[0.08] bg-[#0d0d10] px-4 py-2 text-[13px] text-white/80 outline-none"
          >
            <option value="">All phases</option>
            <option value="request">request</option>
            <option value="worker">worker</option>
            <option value="stream">stream</option>
            <option value="client_render">client_render</option>
            <option value="background_job">background_job</option>
            <option value="admin">admin</option>
          </select>
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0d0d10] px-4 py-2">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setSearch(query);
              }}
              placeholder="Search workflow run, workflow name, account, route..."
              className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
            />
          </div>
          <button
            onClick={() => setSearch(query)}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-[13px] font-medium text-black transition hover:bg-cyan-400"
          >
            Search
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className={`${cardClass} p-3`}>
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
              Workflow Runs
            </span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-white/45" /> : null}
          </div>
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedSessionId === session.id
                    ? "border-cyan-400/40 bg-cyan-400/[0.08]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-white">
                      {session.workflow_name ||
                        session.route_id ||
                        session.request_path ||
                        session.id}
                    </div>
                    <div className="mt-1 truncate text-[12px] text-white/45">
                      {session.account_label || "unknown"} · {session.id}
                    </div>
                  </div>
                  <div className="rounded-full border border-white/[0.08] px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                    run
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/45">
                  <span>{formatTime(session.started_at_epoch_ms)}</span>
                  <span>{formatDuration(session.duration_ms)}</span>
                  <span>{session.event_count ?? 0} events</span>
                  <span>{session.session_count ?? 0} sessions</span>
                  <span>{session.status ?? "unknown"}</span>
                </div>
              </button>
            ))}
            {!loading && sessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center text-[13px] text-white/45">
                No workflow-run trace bundles matched your filters.
              </div>
            ) : null}
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          {detailLoading ? (
            <div className="flex min-h-[420px] items-center justify-center text-white/45">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading timeline...
            </div>
          ) : !detail ? (
            <div className="flex min-h-[420px] items-center justify-center text-white/45">
              Select a workflow run to inspect its full trace bundle.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Workflow
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {String(detail.bundle.workflowName ?? "Untitled Workflow")}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Account
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {String(detail.bundle.accountLabel ?? "unknown")}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Started
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {detail.bundle.startedAt
                      ? formatTime(Date.parse(String(detail.bundle.startedAt)))
                      : "Unknown"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Duration
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {formatDuration(Number(detail.bundle.durationMs ?? 0))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Trace Sessions
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {detail.traceSessions.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Trace Entries
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {detail.traceEntries.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Workflow Events
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {detail.workflowEvents.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Timeline Entries
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {detail.timeline.length}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Nodes</div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {detail.nodes.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Attempts
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {detail.attempts.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Stream Events
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {detail.streamEvents.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Run Status
                  </div>
                  <div className="mt-2 text-[14px] font-medium text-white">
                    {String(detail.run.status ?? "unknown")}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-[#09090c] p-4">
                <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
                  <Activity className="h-4 w-4" />
                  Ordered Timeline
                </div>
                <div className="mt-5 space-y-6">
                  {groupedTimeline.map(([group, items]) => (
                    <div key={group} className="space-y-3">
                      <div className="sticky top-0 z-[1] flex items-center gap-2 bg-[#09090c]/90 py-1 text-[12px] font-medium uppercase tracking-[0.18em] text-cyan-300/80 backdrop-blur">
                        <TimerReset className="h-4 w-4" />
                        {group}
                      </div>
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div
                            key={`${item.timelineSource}-${item.sessionId}-${item.sequence}-${item.timestampEpochMs}`}
                            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-[13px] font-medium text-white">
                                  {item.eventName}
                                </div>
                                <div className="mt-1 text-[12px] text-white/45">
                                  {formatTime(item.timestampEpochMs)} · +{getRelativeMs(item)} ms
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 text-[11px] text-white/45">
                                <span>{item.source}</span>
                                <span>{item.sessionKind}</span>
                                <span>seq {item.sequence}</span>
                                {item.nodeId ? <span>node {item.nodeId}</span> : null}
                                {item.attemptNumber ? (
                                  <span>attempt {item.attemptNumber}</span>
                                ) : null}
                              </div>
                            </div>
                            <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px] leading-5 text-white/70">
                              {JSON.stringify(item.payload ?? {}, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-[#09090c] p-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
                    Server vs UI Node Detail
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px] leading-5 text-white/70">
                    {JSON.stringify(detail.nodeExecutionDetails, null, 2)}
                  </pre>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#09090c] p-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
                    Node Details
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px] leading-5 text-white/70">
                    {JSON.stringify(detail.nodes, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-[#09090c] p-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
                    Attempt Details
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px] leading-5 text-white/70">
                    {JSON.stringify(detail.attempts, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-[#09090c] p-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
                    Stream Summary
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px] leading-5 text-white/70">
                    {JSON.stringify(detail.streamSummary, null, 2)}
                  </pre>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#09090c] p-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
                    Stream Events
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px] leading-5 text-white/70">
                    {JSON.stringify(detail.streamEvents, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-[#09090c] p-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
                    Run Object
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px] leading-5 text-white/70">
                    {JSON.stringify(detail.run, null, 2)}
                  </pre>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#09090c] p-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
                    Dependency State
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px] leading-5 text-white/70">
                    {JSON.stringify(detail.dependencyStateByNodeId, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
