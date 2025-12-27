"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LayoutPanelLeft, Play, Plus, RefreshCw, Rocket, Search as SearchIcon, X } from "lucide-react";

import { useAuth } from "../../components/auth/AuthContext"; // adjust path if yours differs
import ReactFlowCanvas, { CanvasRef as BECanvasRef } from "../../components/builder/ReactFlowCanvas";
import BlockLibrary from "../../components/builder/BlockLibrary";
import InspectorPanel from "../../components/builder/InspectorPanel";
import RunModal from "../../components/builder/RunModal";
import { cx } from "../../lib/cx";
import { emit } from "../../lib/bus";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

type AnyRow = Record<string, any>;
type Selection = { nodeId: string | null; specId?: string; config?: any };

type WindowKind = "blocks" | "inspector";
type WindowState = { id: WindowKind; x: number; y: number; width: number; height: number; visible: boolean; minimized: boolean };
type DragType = "move" | "resize-se" | "resize-sw" | "resize-e" | "resize-s" | "resize-w" | "resize-n";
type DragState = { id: WindowKind; type: DragType; startX: number; startY: number; startRect: WindowState };

function normalizeGraph(raw: any): { nodes: any[]; edges: any[] } {
  if (!raw) return { nodes: [], edges: [] };
  if (typeof raw === "string") {
    try {
      return normalizeGraph(JSON.parse(raw));
    } catch {
      return { nodes: [], edges: [] };
    }
  }
  return {
    nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
    edges: Array.isArray(raw.edges) ? raw.edges : [],
  };
}

function rowTitle(r: AnyRow) {
  return r.title ?? r.name ?? r.workflow_name ?? r.filename ?? r.label ?? "Untitled Workflow";
}

function rowPublished(r: AnyRow) {
  return Boolean(r.is_published ?? r.published ?? r.isPublished ?? false);
}

function rowUpdatedAt(r: AnyRow): string | null {
  return r.updated_at ?? r.modified_at ?? r.created_at ?? null;
}

async function fetchSupabaseToken(): Promise<string | null> {
  const res = await fetch("/api/supabase/token", { method: "GET" });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.token ?? null;
}

function makeAuthedSupabase(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export default function BuilderPage() {
  const { user, requireAuth } = useAuth();
  const beRef = useRef<BECanvasRef>(null);

  const [mounted, setMounted] = useState(false);

  // supabase auth bridge
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [sbReady, setSbReady] = useState(false);

  // workflow state
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled Workflow");
  const [editingName, setEditingName] = useState(false);

  // selection/stats
  const [selection, setSelection] = useState<Selection>({ nodeId: null });
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  // launcher modal
  const [showLauncher, setShowLauncher] = useState(true);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<AnyRow[]>([]);
  const [published, setPublished] = useState<AnyRow[]>([]);

  // autosave
  const AUTOSAVE_MS = 1200;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestGraphRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);

  // floating windows (your screenshot sizing)
  const [windows, setWindows] = useState<Record<WindowKind, WindowState>>({
    blocks: { id: "blocks", x: 72, y: 96, width: 380, height: 560, visible: true, minimized: false },
    inspector: { id: "inspector", x: 1000, y: 96, width: 380, height: 560, visible: true, minimized: false },
  });
  const [drag, setDrag] = useState<DragState | null>(null);

  // run
  const [running, setRunning] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => () => autosaveTimerRef.current && clearTimeout(autosaveTimerRef.current), []);

  // Build authed supabase client whenever NextAuth user exists
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setSbReady(false);
      setSb(null);

      if (!SUPABASE_URL || !SUPABASE_ANON) {
        setSbReady(true);
        setWfError("Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
        return;
      }

      // If no NextAuth user, don’t even try
      if (!user) {
        setSbReady(true);
        return;
      }

      const token = await fetchSupabaseToken();
      if (cancelled) return;

      if (!token) {
        setSbReady(true);
        setWfError("Not signed in (NextAuth session exists, but Supabase token bridge failed).");
        return;
      }

      setSb(makeAuthedSupabase(token));
      setSbReady(true);
      setWfError(null);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Keep inspector snapped right once
  useEffect(() => {
    if (!mounted) return;
    setWindows((prev) => {
      const w = prev.inspector;
      const margin = 72;
      const x = Math.max(margin, window.innerWidth - w.width - margin);
      return { ...prev, inspector: { ...w, x } };
    });
  }, [mounted]);

  // stats polling
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      const g = beRef.current?.getGraph?.();
      if (!g) return;
      setStats({ nodes: g.nodes?.length ?? 0, edges: g.edges?.length ?? 0 });
    }, 700);
    return () => clearInterval(id);
  }, [mounted]);

  const refreshWorkflows = useCallback(async () => {
    setWfError(null);

    if (!user) {
      setDrafts([]);
      setPublished([]);
      setWfError("Please sign in to create and load workflows.");
      return;
    }
    if (!sb) {
      setDrafts([]);
      setPublished([]);
      if (!sbReady) return;
      setWfError("Supabase client not ready. Check /api/supabase/token and SUPABASE_JWT_SECRET.");
      return;
    }

    setWfLoading(true);
    try {
      const { data, error } = await sb.from("workflows").select("*").order("updated_at", { ascending: false });
      if (error) throw error;

      const rows = Array.isArray(data) ? (data as AnyRow[]) : [];
      const d: AnyRow[] = [];
      const p: AnyRow[] = [];
      for (const r of rows) (rowPublished(r) ? p : d).push(r);

      setDrafts(d);
      setPublished(p);

      if (activeWorkflowId) setShowLauncher(false);
      else setShowLauncher(true);
    } catch (e: any) {
      setDrafts([]);
      setPublished([]);
      setWfError(e?.message || "Failed to load workflows.");
    } finally {
      setWfLoading(false);
    }
  }, [user, sb, sbReady, activeWorkflowId]);

  useEffect(() => {
    if (!mounted) return;
    void refreshWorkflows();
  }, [mounted, refreshWorkflows]);

  const doAutosave = useCallback(async () => {
    if (!sb || !activeWorkflowId) return;
    const graph = latestGraphRef.current;
    if (!graph) return;

    if (saveInFlightRef.current) {
      saveAgainRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    saveAgainRef.current = false;

    try {
      const update: AnyRow = {
        title: name || "Untitled Workflow",
        graph,
        updated_at: new Date().toISOString(),
      };

      const { error } = await sb.from("workflows").update(update).eq("id", activeWorkflowId);
      if (error) console.error("Autosave failed", error);
    } finally {
      saveInFlightRef.current = false;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        queueMicrotask(() => void doAutosave());
      }
    }
  }, [sb, activeWorkflowId, name]);

  const onGraphChange = useCallback(
    (graph: { nodes: any[]; edges: any[] }) => {
      latestGraphRef.current = graph;
      if (!activeWorkflowId) return;

      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => void doAutosave(), AUTOSAVE_MS);
    },
    [activeWorkflowId, doAutosave]
  );

  const createNewWorkflow = useCallback(async () => {
    setWfError(null);

    if (!requireAuth()) return;
    if (!sb) {
      setWfError("Supabase client not ready. Fix /api/supabase/token first.");
      return;
    }

    setWfLoading(true);
    try {
      const emptyGraph = { nodes: [], edges: [] };

      // IMPORTANT: Do not reference status/graph_json.
      const { data, error } = await sb
        .from("workflows")
        .insert({ title: "Untitled Workflow", is_published: false, graph: emptyGraph })
        .select("*")
        .single();

      if (error) throw error;

      const row = data as AnyRow;
      setActiveWorkflowId(String(row.id));
      setName(rowTitle(row));
      setEditingName(false);

      beRef.current?.loadGraph?.(normalizeGraph(row.graph));

      setShowLauncher(false);
      await refreshWorkflows();
    } catch (e: any) {
      setWfError(e?.message || "Failed to create workflow.");
    } finally {
      setWfLoading(false);
    }
  }, [requireAuth, sb, refreshWorkflows]);

  const openWorkflow = useCallback(
    async (id: string) => {
      setWfError(null);

      if (!requireAuth()) return;
      if (!sb) {
        setWfError("Supabase client not ready. Fix /api/supabase/token first.");
        return;
      }

      setWfLoading(true);
      try {
        const { data, error } = await sb.from("workflows").select("*").eq("id", id).single();
        if (error) throw error;

        const row = data as AnyRow;
        setActiveWorkflowId(String(row.id));
        setName(rowTitle(row));
        setEditingName(false);

        beRef.current?.loadGraph?.(normalizeGraph(row.graph));
        setShowLauncher(false);

        await refreshWorkflows();
      } catch (e: any) {
        setWfError(e?.message || "Failed to open workflow.");
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, sb, refreshWorkflows]
  );

  // window dragging
  useEffect(() => {
    if (!drag || !mounted) return;

    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      setWindows((prev) => {
        const cur = prev[drag.id];
        if (!cur) return prev;

        let { x, y, width, height } = drag.startRect;

        switch (drag.type) {
          case "move":
            x += dx;
            y += dy;
            break;
          case "resize-se":
            width = Math.max(280, width + dx);
            height = Math.max(260, height + dy);
            break;
          case "resize-sw": {
            const newW = Math.max(280, width - dx);
            x += width - newW;
            width = newW;
            height = Math.max(260, height + dy);
            break;
          }
          case "resize-e":
            width = Math.max(280, width + dx);
            break;
          case "resize-w":
            width = Math.max(280, width - dx);
            x += dx;
            break;
          case "resize-s":
            height = Math.max(260, height + dy);
            break;
          case "resize-n":
            height = Math.max(260, height - dy);
            y += dy;
            break;
        }

        const margin = 12;
        const maxX = window.innerWidth - width - margin;
        const maxY = window.innerHeight - height - margin;
        const minY = 72;

        x = Math.min(Math.max(margin, x), maxX);
        y = Math.min(Math.max(minY, y), maxY);

        return { ...prev, [drag.id]: { ...cur, x, y, width, height } };
      });
    };

    const onUp = () => setDrag(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, mounted]);

  const startDrag = (id: WindowKind, type: DragType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = windows[id];
    setDrag({ id, type, startX: e.clientX, startY: e.clientY, startRect: { ...rect } });
  };

  const toggleVisible = (id: WindowKind) => setWindows((p) => ({ ...p, [id]: { ...p[id], visible: !p[id].visible } }));
  const toggleMinimized = (id: WindowKind) => setWindows((p) => ({ ...p, [id]: { ...p[id], minimized: !p[id].minimized } }));

  const runWorkflow = useCallback(async () => {
    if (running) return;
    setRunning(true);
    emit("workflow:status", { phase: "starting" } as any);

    try {
      const graph = beRef.current?.getGraph?.() ?? { nodes: [], edges: [] };

      const res = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graph),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      emit("workflow:status", { phase: "finished", data: await res.json() } as any);
    } catch (e: any) {
      emit("workflow:status", { phase: "error", message: e?.message || "Run failed." } as any);
    } finally {
      setRunning(false);
    }
  }, [running]);

  const saveBadge = useMemo(() => {
    if (!activeWorkflowId) return null;
    return <span className="text-white/50 text-xs">Autosave on</span>;
  }, [activeWorkflowId]);

  if (!mounted) return null;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#05060A] text-white">
      <div className="absolute inset-0">
        <ReactFlowCanvas ref={beRef} onSelectionChange={(s) => setSelection(s)} onGraphChange={onGraphChange} />
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-3 z-30 px-6">
        <div className="pointer-events-auto flex items-center justify-between gap-4 rounded-2xl bg-black/65 px-4 py-2.5 shadow-[0_18px_60px_rgba(0,0,0,0.65)] border border-white/10 backdrop-blur-xl">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex flex-col min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">WORKFLOW STUDIO</div>

              <div className="mt-0.5 flex items-center gap-2 min-w-0">
                {editingName ? (
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                    className="max-w-xs rounded-full border border-white/20 bg-black/60 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                ) : (
                  <button
                    type="button"
                    className="max-w-xs truncate rounded-full border border-transparent px-3 py-1 text-left text-sm font-semibold hover:border-white/30"
                    onClick={() => setEditingName(true)}
                    title="Rename"
                  >
                    {name}
                  </button>
                )}

                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                  Draft · Not published
                </span>

                {saveBadge}
              </div>
            </div>
          </div>

          <div className="flex flex-none items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/12 bg-black/70 px-3 py-1.5 text-xs text-white/70 sm:flex">
              <span className="text-white/60">Graph</span>
              <span className="mx-1 h-4 w-px bg-white/10" />
              <span className="font-medium text-white">{stats.nodes} nodes</span>
              <span className="text-white/30">·</span>
              <span className="font-medium text-white">{stats.edges} edges</span>
            </div>

            <button
              type="button"
              onClick={() => setShowLauncher(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
              title="Workflows"
            >
              <LayoutPanelLeft size={14} />
              Workflows
            </button>

            <button
              type="button"
              onClick={runWorkflow}
              disabled={running}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium transition",
                running ? "bg-white/15 text-white/70 cursor-wait" : "bg-white/5 hover:bg-white/10"
              )}
            >
              <Play size={14} className={running ? "animate-pulse" : undefined} />
              {running ? "Running…" : "Run"}
            </button>

            <button
              type="button"
              onClick={() => emit("workflow:publish")}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF6FD8] via-[#9B6BFF] to-[#4DD4FF] px-3.5 py-1.5 text-xs font-semibold text-black shadow-lg shadow-[#9B6BFF]/45 hover:brightness-110"
            >
              <Rocket size={14} />
              Publish
            </button>
          </div>
        </div>
      </div>

      {/* Dock buttons */}
      <div className="pointer-events-none absolute left-4 top-24 z-30 flex flex-col gap-3">
        <DockButton icon={LayoutPanelLeft} label="Blocks" active={windows.blocks.visible} onClick={() => toggleVisible("blocks")} />
        <DockButton icon={SearchIcon} label="Inspector" active={windows.inspector.visible} onClick={() => toggleVisible("inspector")} />
      </div>

      {/* Floating windows */}
      {(["blocks", "inspector"] as WindowKind[]).map((id) => {
        const state = windows[id];
        if (!state.visible) return null;

        const minimized = state.minimized;
        const style: React.CSSProperties = {
          left: state.x,
          top: state.y,
          width: state.width,
          height: minimized ? undefined : state.height,
        };

        const isBlocks = id === "blocks";

        return (
          <div key={id} className="pointer-events-auto absolute z-20 select-none" style={style}>
            <div className="relative flex h-full flex-col rounded-2xl edge-glass edge-border shadow-[0_24px_80px_rgba(0,0,0,0.75)] overflow-hidden">
              <div
                className="flex cursor-move items-center justify-between bg-gradient-to-r from-white/[0.06] via-black/40 to-white/[0.04] px-3 py-2 text-xs"
                onMouseDown={(e) => startDrag(id, "move", e)}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-white/10 text-[11px] font-semibold">
                    {isBlocks ? "BL" : "IN"}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-white/85">
                      {isBlocks ? "Blocks · Backend nodes" : "Inspector · Node properties"}
                    </span>
                    <span className="text-[10px] text-white/45">
                      {isBlocks
                        ? "Drag blocks into the canvas to build your graph."
                        : selection.nodeId
                        ? "Edit the selected node from your graph."
                        : "Select a node on the canvas to begin."}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"
                    onClick={() => toggleMinimized(id)}
                    title={minimized ? "Expand" : "Minimize"}
                  >
                    <span className="text-[11px]">–</span>
                  </button>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"
                    onClick={() => toggleVisible(id)}
                    title="Close"
                  >
                    <span className="text-[11px]">×</span>
                  </button>
                </div>
              </div>

              {!minimized && (
                <div className="relative flex flex-1 min-h-0 flex-col bg-black/60 px-3 py-3 border-t border-white/10">
                  {isBlocks ? (
                    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-black/60">
                      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                        <BlockLibrary />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-black/60">
                      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                        <InspectorPanel
                          selection={selection}
                          onUpdateNodeConfig={(nodeId: string, patch: any) => beRef.current?.updateNodeConfig?.(nodeId, patch)}
                          workflowId={activeWorkflowId ?? undefined}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!minimized && (
                <>
                  <div className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize" onMouseDown={(e) => startDrag(id, "resize-se", e)} />
                  <div className="absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize" onMouseDown={(e) => startDrag(id, "resize-sw", e)} />
                  <div className="absolute bottom-0 left-3 right-3 h-2 cursor-ns-resize" onMouseDown={(e) => startDrag(id, "resize-s", e)} />
                  <div className="absolute top-0 left-3 right-3 h-2 cursor-ns-resize" onMouseDown={(e) => startDrag(id, "resize-n", e)} />
                  <div className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize" onMouseDown={(e) => startDrag(id, "resize-e", e)} />
                  <div className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize" onMouseDown={(e) => startDrag(id, "resize-w", e)} />
                </>
              )}
            </div>
          </div>
        );
      })}

      <WorkflowsModal
        open={showLauncher}
        loading={wfLoading}
        error={wfError}
        drafts={drafts}
        published={published}
        canClose={Boolean(activeWorkflowId)}
        onClose={() => activeWorkflowId && setShowLauncher(false)}
        onRefresh={refreshWorkflows}
        onNew={createNewWorkflow}
        onPick={(id) => void openWorkflow(id)}
      />

      <RunModal />
    </div>
  );
}

function WorkflowsModal(props: {
  open: boolean;
  loading: boolean;
  error: string | null;
  drafts: AnyRow[];
  published: AnyRow[];
  canClose: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onNew: () => void;
  onPick: (id: string) => void;
}) {
  const { open, loading, error, drafts, published, canClose, onClose, onRefresh, onNew, onPick } = props;
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

      <div className="absolute left-1/2 top-1/2 w-[min(980px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-[28px] border border-white/12 bg-black/60 shadow-[0_40px_140px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8">
                <Image src="/brand/edgaze-mark.png" alt="Edgaze" fill className="object-contain" priority />
              </div>
              <div className="text-lg font-semibold tracking-tight">Workflows</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
                Refresh
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={!canClose}
                className={cx(
                  "inline-flex items-center justify-center rounded-full border px-2.5 py-2 text-white/80 transition",
                  canClose ? "border-white/12 bg-white/5 hover:bg-white/10" : "border-white/10 bg-white/5 opacity-40 cursor-not-allowed"
                )}
                title={canClose ? "Close" : "Pick or create a workflow first"}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[420px_1fr]">
            <div className="space-y-3">
              <button
                type="button"
                onClick={onNew}
                disabled={loading}
                className={cx(
                  "w-full rounded-2xl border border-white/12 bg-white/5 p-4 text-left hover:bg-white/10 transition",
                  loading ? "opacity-70 cursor-wait" : ""
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-black/50">
                    <Plus size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold">New</div>
                    <div className="text-sm text-white/55">Start a new workflow</div>
                  </div>
                </div>
              </button>

              {error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <div className="text-xs text-white/40">
                Drafts autosave while you edit. Publishing pushes to the marketplace later.
              </div>
            </div>

            <div className="space-y-6 min-w-0">
              <Section title="Continue" subtitle={drafts.length ? "Pick up where you left off." : "No drafts yet."}>
                {drafts.length ? <WorkflowGrid rows={drafts} onPick={onPick} /> : <EmptyRow />}
              </Section>

              <Section title="Your workflows" subtitle={published.length ? "Your published workflows." : "No published workflows yet."}>
                {published.length ? <WorkflowGrid rows={published} onPick={onPick} /> : <EmptyRow />}
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-3">
        <div className="text-sm font-semibold">{props.title}</div>
        <div className="text-sm text-white/50">{props.subtitle}</div>
      </div>
      {props.children}
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/45">
      Nothing here yet.
    </div>
  );
}

function WorkflowGrid(props: { rows: AnyRow[]; onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {props.rows.slice(0, 8).map((r) => {
        const id = String(r.id ?? "");
        const title = rowTitle(r);
        const updated = rowUpdatedAt(r);

        return (
          <button
            key={id}
            type="button"
            onClick={() => id && props.onPick(id)}
            className="rounded-2xl border border-white/12 bg-white/5 p-4 text-left hover:bg-white/10 transition"
          >
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs text-white/50">
              {updated ? `Updated ${new Date(updated).toLocaleString()}` : " "}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DockButton(props: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl border text-[10px] transition-colors",
        props.active
          ? "border-[#FF6FD8]/60 bg-gradient-to-b from-[#FF6FD8]/40 via-[#9B6BFF]/35 to-[#4DD4FF]/40 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_rgba(0,0,0,0.85)]"
          : "border-white/18 bg-black/75 text-white/70 hover:border-white/40 hover:bg-black/60"
      )}
    >
      <Icon size={18} className="shrink-0" />
      <span className="sr-only">{props.label}</span>
    </button>
  );
}
