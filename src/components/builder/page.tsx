// src/app/builder/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Plus, RefreshCw, Home, Play, UploadCloud, Loader2 } from "lucide-react";

import { useAuth } from "../../components/auth/AuthContext";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

import BlockLibrary from "../../components/builder/BlockLibrary";
import InspectorPanel from "../../components/builder/InspectorPanel";
import ReactFlowCanvas, {
  type BuilderCanvasHandle,
} from "../../components/builder/ReactFlowCanvas";
import RunModal from "../../components/builder/RunModal";
import WorkflowLauncherModal from "../../components/builder/WorkflowLauncherModal";

import { emit } from "../../lib/bus";

type DraftRow = {
  id: string;
  owner_id: string;
  title: string;
  graph: any;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
};

type Selection = {
  nodeId: string | null;
  specId?: string;
  config?: any;
};

const BUILDER_HEIGHT = "calc(100vh - 120px)";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function defaultGraph() {
  return {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

export default function BuilderPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, authReady, loading, requireAuth } = useAuth();

  // existing behaviour (mode toggle + resizable layout)
  const [mode, setMode] = useState<"frontend" | "backend">("frontend");

  // selection for inspector (restores inspector safety + avoids undefined crashes)
  const [selection, setSelection] = useState<Selection>({ nodeId: null });

  // Launcher modal + drafts
  const [launcherOpen, setLauncherOpen] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // New draft inline form (inside modal)
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Active draft
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("Builder");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Canvas ref (imperative methods exist in your ReactFlowCanvas)
  const canvasRef = useRef<BuilderCanvasHandle | null>(null);

  // autosave debounce
  const saveTimerRef = useRef<any>(null);
  const lastGraphRef = useRef<any>(null);
  const savingRef = useRef(false);

  // Disable page scroll only while on builder (kept)
  useEffect(() => {
    const scroller = document.querySelector(
      "div.overflow-y-auto"
    ) as HTMLElement | null;
    const prev = scroller?.style.overflowY;
    if (scroller) {
      scroller.style.overflowY = "hidden";
      scroller.scrollTop = 0;
    }
    return () => {
      if (scroller) scroller.style.overflowY = prev || "auto";
    };
  }, []);

  const canUse = useMemo(
    () => authReady && !loading && !!userId,
    [authReady, loading, userId]
  );

  const fetchDrafts = useCallback(async () => {
    if (!canUse) return;

    setBusy(true);
    setErrorText(null);

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("workflow_drafts")
          .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
          .eq("owner_id", userId as string)
          .order("last_opened_at", { ascending: false, nullsFirst: false })
          .order("updated_at", { ascending: false }),
        12000,
        "Loading workflows"
      );

      if (error) throw error;
      setDrafts((data as DraftRow[]) ?? []);
    } catch (e: any) {
      setErrorText(e?.message || "Failed to load workflows.");
      setDrafts([]);
    } finally {
      setBusy(false);
    }
  }, [canUse, supabase, userId]);

  // Initial open: require auth then load drafts
  useEffect(() => {
    if (!authReady) return;

    if (!userId) {
      requireAuth();
      return;
    }

    fetchDrafts();
  }, [authReady, userId, requireAuth, fetchDrafts]);

  const openHome = useCallback(() => {
    setLauncherOpen(true);
    setShowNewForm(false);
    setNewTitle("");
    setErrorText(null);
    fetchDrafts();
  }, [fetchDrafts]);

  const openDraft = useCallback(
    async (draftId: string) => {
      if (!canUse) return;

      setBusy(true);
      setErrorText(null);

      try {
        const { data, error } = await withTimeout(
          supabase
            .from("workflow_drafts")
            .select("id,title,graph")
            .eq("id", draftId)
            .eq("owner_id", userId as string)
            .maybeSingle(),
          12000,
          "Opening workflow"
        );

        if (error) throw error;
        if (!data) throw new Error("Draft not found.");

        // mark opened (non-blocking)
        supabase
          .from("workflow_drafts")
          .update({ last_opened_at: new Date().toISOString() })
          .eq("id", draftId)
          .eq("owner_id", userId as string);

        setActiveDraftId(draftId);
        setActiveTitle((data as any).title || "Untitled workflow");
        setLauncherOpen(false);
        setShowNewForm(false);
        setSelection({ nodeId: null });

        const graph = (data as any).graph ?? defaultGraph();

        requestAnimationFrame(() => {
          canvasRef.current?.loadGraph?.(graph);
        });
      } catch (e: any) {
        setErrorText(e?.message || "Failed to open draft.");
      } finally {
        setBusy(false);
      }
    },
    [canUse, supabase, userId]
  );

  const createDraft = useCallback(async () => {
    if (!canUse) return;

    const title = (newTitle || "").trim();
    if (!title) {
      setErrorText("Workflow name is required.");
      return;
    }

    setBusy(true);
    setErrorText(null);

    try {
      const payload = {
        owner_id: userId as string,
        title,
        graph: defaultGraph(),
        last_opened_at: new Date().toISOString(),
      };

      const { data, error } = await withTimeout(
        supabase
          .from("workflow_drafts")
          .insert(payload)
          .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
          .single(),
        12000,
        "Creating workflow"
      );

      if (error) throw error;

      const row = data as DraftRow;

      setDrafts((prev) => [row, ...prev]);
      setNewTitle("");
      setShowNewForm(false);

      // open immediately
      setActiveDraftId(row.id);
      setActiveTitle(row.title || "Untitled workflow");
      setLauncherOpen(false);
      setSelection({ nodeId: null });

      requestAnimationFrame(() => {
        canvasRef.current?.loadGraph?.(row.graph ?? defaultGraph());
      });
    } catch (e: any) {
      setErrorText(
        e?.message ||
          "Failed to create workflow. (If this persists: check RLS policy on workflow_drafts for INSERT + owner_id = auth.uid())"
      );
    } finally {
      setBusy(false);
    }
  }, [canUse, newTitle, supabase, userId]);

  const scheduleSave = useCallback(
    (graph: any) => {
      if (!canUse) return;
      if (!activeDraftId) return;

      lastGraphRef.current = graph;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        if (savingRef.current) return;
        savingRef.current = true;

        try {
          const g = lastGraphRef.current ?? graph;

          // Don’t force-updating updated_at unless you really need it.
          // Keep it simple: write graph only (your DB can manage updated_at via trigger if you want).
          const { error } = await supabase
            .from("workflow_drafts")
            .update({ graph: g })
            .eq("id", activeDraftId)
            .eq("owner_id", userId as string);

          if (error) throw error;

          setLastSavedAt(new Date().toLocaleTimeString());
        } catch (e: any) {
          setErrorText(e?.message || "Autosave failed.");
        } finally {
          savingRef.current = false;
        }
      }, 650);
    },
    [activeDraftId, canUse, supabase, userId]
  );

  const onGraphChange = useCallback(
    (graph: { nodes: any[]; edges: any[] }) => {
      const viewport = canvasRef.current?.getGraph?.()?.viewport ?? undefined;
      scheduleSave({ ...graph, ...(viewport ? { viewport } : {}) });
    },
    [scheduleSave]
  );

  // Selection + config updates (InspectorPanel ↔ Canvas)
  const onSelectionChange = useCallback((sel: any) => {
    if (!sel) {
      setSelection({ nodeId: null });
      return;
    }
    setSelection({
      nodeId: sel.nodeId ?? null,
      specId: sel.specId,
      config: sel.config,
    });
  }, []);

  const onUpdateNodeConfig = useCallback((nodeId: string, patch: any) => {
    const anyRef: any = canvasRef.current as any;
    if (typeof anyRef?.updateNodeConfig === "function") {
      anyRef.updateNodeConfig(nodeId, patch);
      return;
    }
    // fallback: keep UI stable even if method name differs
    setErrorText("Canvas updateNodeConfig method not found (check ReactFlowCanvas handle).");
  }, []);

  const runWorkflow = useCallback(async () => {
    if (!activeDraftId) {
      openHome();
      return;
    }

    const graph = canvasRef.current?.getGraph?.() ?? { nodes: [], edges: [] };

    emit("workflow:status", { phase: "starting" });

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graph),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        emit("workflow:status", {
          phase: "error",
          message: data?.error || "Run failed.",
        });
        return;
      }

      emit("workflow:status", { phase: "finished", data });
    } catch (e: any) {
      emit("workflow:status", {
        phase: "error",
        message: e?.message || "Run failed.",
      });
    }
  }, [activeDraftId, openHome]);

  const continueItems = useMemo(
    () =>
      drafts.map((d) => ({
        id: d.id,
        title: d.title,
        status: "draft" as const,
        updated_at: d.updated_at,
        last_opened_at: d.last_opened_at ?? undefined,
        graph: d.graph ?? null,
      })),
    [drafts]
  );

  const publishedItems = useMemo(() => [], []);

  return (
    <div className="h-full w-full">
      <WorkflowLauncherModal
        open={launcherOpen}
        continueItems={continueItems as any}
        publishedItems={publishedItems as any}
        onCreateNew={() => {
          if (!userId) {
            requireAuth();
            return;
          }
          setShowNewForm(true);
          setErrorText(null);
        }}
        onOpen={(id) => openDraft(id)}
        onClose={() => setLauncherOpen(false)}
        onRefresh={() => fetchDrafts()}
        errorText={errorText}
        busy={busy}
        newForm={
          showNewForm ? (
            <div className="mt-4 rounded-2xl border border-white/12 bg-black/35 p-5">
              <div className="text-[13px] font-semibold text-white mb-2">
                Workflow name
              </div>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Email triage"
                className="w-full rounded-xl border border-white/14 bg-black/40 px-4 py-3 text-[13px] text-white outline-none focus:border-cyan-400/60"
              />

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={createDraft}
                  disabled={busy}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold",
                    "border border-white/14 bg-white/10 hover:bg-white/12",
                    busy && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowNewForm(false);
                    setNewTitle("");
                    setErrorText(null);
                  }}
                  className="rounded-xl px-4 py-2.5 text-[13px] border border-white/12 bg-black/30 hover:bg-black/25 text-white/85"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null
        }
      />

      {/* Header */}
      <div className="px-6 pt-4">
        <div className="edge-glass edge-border rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="min-w-0 flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.22em] text-white/55">
                WORKFLOW
              </div>
              <h3 className="truncate text-xl font-semibold">
                {activeDraftId ? activeTitle : "Builder"}
              </h3>
              {activeDraftId && (
                <div className="mt-0.5 text-[11px] text-white/50">
                  {lastSavedAt ? `Autosaved ${lastSavedAt}` : "Autosave enabled"}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openHome}
              className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/5 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10"
              title="Workflows home"
            >
              <Home className="h-4 w-4" />
              Home
            </button>

            <button
              type="button"
              onClick={runWorkflow}
              className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/5 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10"
              title="Run workflow"
            >
              <Play className="h-4 w-4" />
              Run
            </button>

            <button
              type="button"
              onClick={() => {}}
              className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/5 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10"
              title="Publish (coming soon)"
            >
              <UploadCloud className="h-4 w-4" />
              Publish
            </button>

            <div className="relative -top-[4px] rounded-full p-[1.5px] edge-grad">
              <div className="rounded-full edge-glass edge-border px-1 py-[6px] text-xs leading-none">
                <button
                  onClick={() => setMode("frontend")}
                  className={cx(
                    "rounded-full px-3 py-1",
                    mode === "frontend" && "bg-white/10"
                  )}
                >
                  Frontend
                </button>
                <button
                  onClick={() => setMode("backend")}
                  className={cx(
                    "rounded-full px-3 py-1",
                    mode === "backend" && "bg-white/10"
                  )}
                >
                  Backend
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchDrafts}
              className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/5 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="px-6 mt-[7px] pb-4">
        <PanelGroup
          direction="horizontal"
          className="rounded-2xl overflow-hidden edge-border w-full"
          style={{ height: BUILDER_HEIGHT }}
        >
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

          <Panel defaultSize={56} minSize={36} maxSize={68}>
            <div className="h-full px-2">
              <div className="h-full edge-glass edge-border rounded-2xl overflow-hidden">
                <ReactFlowCanvas
                  ref={canvasRef}
                  onGraphChange={onGraphChange}
                  // harmless if canvas doesn’t use it; fixes inspector if it does
                  onSelectionChange={onSelectionChange as any}
                />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 relative group">
            <span className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-[2px] rounded-full edge-grad opacity-60 group-hover:opacity-100" />
          </PanelResizeHandle>

          <Panel defaultSize={22} minSize={16} maxSize={36}>
            <div className="h-full pl-2">
              <div className="h-full mr-2 edge-glass edge-border rounded-2xl overflow-hidden">
                <div className="h-full overflow-auto p-5">
                  <InspectorPanel
                    selection={selection as any}
                    onUpdateNodeConfig={onUpdateNodeConfig as any}
                    workflowId={activeDraftId ?? undefined}
                  />
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <RunModal />
    </div>
  );
}
