// src/app/builder/page.tsx
"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutPanelLeft, Play, Plus, RefreshCw, Rocket, X, ArrowRight, ArrowLeft, ZoomIn, ZoomOut, Grid3X3, Lock, Unlock, Maximize2, Minimize2, Sparkles, Loader2, BookOpen, Undo2, Redo2 } from "lucide-react";
import Link from "next/link";

import { useAuth } from "../../components/auth/AuthContext";
import ProfileAvatar from "../../components/ui/ProfileAvatar";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

import ReactFlowCanvas, { CanvasRef as BECanvasRef } from "../../components/builder/ReactFlowCanvas";
import BlockLibrary from "../../components/builder/BlockLibrary";
import InspectorPanel from "../../components/builder/InspectorPanel";
import WorkflowPublishModal from "../../components/builder/WorkflowPublishModal";
import PremiumWorkflowRunModal, { type WorkflowRunState, type WorkflowRunStep, type BuilderRunLimit } from "../../components/builder/PremiumWorkflowRunModal";
import { extractWorkflowInputs, extractWorkflowOutputs } from "../../lib/workflow/input-extraction";
import { canRunDemo, canRunDemoSync, trackDemoRun, getRemainingDemoRuns, getRemainingDemoRunsSync } from "../../lib/workflow/device-tracking";
import { validateWorkflowGraph, type ValidationResult } from "../../lib/workflow/validation";
import CanvasValidationBanner from "../../components/builder/CanvasValidationBanner";
import { stripGraphSecrets } from "../../lib/workflow/stripGraphSecrets";

import { cx } from "../../lib/cx";
import { emit, on } from "../../lib/bus";
import { track } from "../../lib/mixpanel";
import { getQuickStartTemplate } from "../../lib/quickStartTemplates";

function safeTrack(event: string, props?: Record<string, any>) {
  try {
    track(event, props);
  } catch {}
}

type Selection = { nodeId: string | null; specId?: string; config?: any };

type WindowKind = "blocks" | "inspector";
type WindowState = {
  id: WindowKind;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  minimized: boolean;
};

type DragType = "move" | "resize-se" | "resize-sw" | "resize-e" | "resize-s" | "resize-w" | "resize-n";
type DragState = {
  id: WindowKind;
  type: DragType;
  startX: number;
  startY: number;
  startRect: WindowState;
};

type DraftRow = {
  id: string;
  owner_id: string;
  title: string;
  graph: any;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
};

type BuilderMode = "edit" | "preview";

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

function nowIso() {
  return new Date().toISOString();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Kahn's topological sort - matches server execution order */
function getExecutionOrder(nodes: { id: string }[], edges: { source: string; target: string }[]): string[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  });
  const q: string[] = [];
  indeg.forEach((d, id) => d === 0 && q.push(id));
  const order: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    order.push(u);
    for (const v of adj.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if ((indeg.get(v) ?? 0) === 0) q.push(v);
    }
  }
  return order.length === nodes.length ? order : nodes.map((n) => n.id);
}

const DESKTOP_MIN_W = 1100;
const DESKTOP_MIN_H = 680;

// If you have a left icon-rail sidebar, this keeps the launcher overlay from blocking it.
const LEFT_RAIL_SAFE_PX = 76;

export default function BuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, authReady, requireAuth, openSignIn, getAccessToken, profile } = useAuth();

  const beRef = useRef<BECanvasRef>(null);

  const [mounted, setMounted] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const isDesktop = viewport.w >= DESKTOP_MIN_W && viewport.h >= DESKTOP_MIN_H;

  const previewParam = searchParams?.get("preview") === "1" || searchParams?.get("mode") === "preview";

  // workflow state
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled Workflow");
  const [editingName, setEditingName] = useState(false);

  // Preview mode: store product page info for back button
  const [previewOwnerHandle, setPreviewOwnerHandle] = useState<string | null>(null);
  const [previewEdgazeCode, setPreviewEdgazeCode] = useState<string | null>(null);

  // builder mode - initialize from URL param
  const [mode, setMode] = useState<BuilderMode>(previewParam ? "preview" : "edit");
  const isPreview = mode === "preview";

  // selection/stats
  const [selection, setSelection] = useState<Selection>({ nodeId: null });
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  // Canvas control states
  const [showGrid, setShowGrid] = useState(true);
  const [locked, setLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // launcher overlay (confined: does NOT block sidebar)
  const [showLauncher, setShowLauncher] = useState(true);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);
  const [canvasValidation, setCanvasValidation] = useState<ValidationResult | null>(null);
  const [inspectorFieldHint, setInspectorFieldHint] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [published, setPublished] = useState<DraftRow[]>([]);

  // create-new form (NO auto-create)
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // autosave (debounced) — only save when graph actually changes
  const AUTOSAVE_MS = 900;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestGraphRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);

  // Undo/redo: graph history (only in edit mode with a draft)
  const UNDO_HISTORY_MAX = 50;
  const UNDO_DEBOUNCE_MS = 600;
  const [undoStack, setUndoStack] = useState<{ nodes: any[]; edges: any[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ nodes: any[]; edges: any[] }[]>([]);
  const previousGraphRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);
  const isUndoRedoRef = useRef(false);
  const graphChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // publish modal
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishWorkflowId, setPublishWorkflowId] = useState<string | null>(null);

  // floating windows - positions will be set precisely on mount
  // In preview mode, windows start hidden
  const [windows, setWindows] = useState<Record<WindowKind, WindowState>>({
    blocks: { id: "blocks", x: 0, y: 0, width: 280, height: 600, visible: !previewParam, minimized: false },
    inspector: { id: "inspector", x: 0, y: 0, width: 320, height: 600, visible: !previewParam, minimized: false },
  });
  const [windowsInitialized, setWindowsInitialized] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Measure header height and position windows
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const topbarInnerRef = useRef<HTMLDivElement>(null);
  const minimapElRef = useRef<HTMLElement | null>(null);

  // Track if user has moved panels (so we don't override their layout)
  const userMovedRef = useRef<Record<WindowKind, boolean>>({
    blocks: false,
    inspector: false,
  });

  function findMinimapEl(): HTMLElement | null {
    return (
      (document.querySelector(".react-flow__minimap") as HTMLElement | null) ??
      (document.querySelector("[data-testid='rf__minimap']") as HTMLElement | null)
    );
  }

  // Premium run modal
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runState, setRunState] = useState<WorkflowRunState | null>(null);
  const [builderRunLimit, setBuilderRunLimit] = useState<BuilderRunLimit | null>(null);
  const [requiresApiKeys, setRequiresApiKeys] = useState<string[] | null>(null);
  const [running, setRunning] = useState(false);
  const [showPreparingToast, setShowPreparingToast] = useState(false);
  const runAbortRef = useRef<AbortController | null>(null);
  const autoExecuteTriggeredRef = useRef(false);

  // deep-link guard (prevents repeated opening)
  const openedWorkflowIdRef = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    safeTrack("Builder Viewed", {
      surface: "builder",
      isDesktop,
      previewParam,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);
  useEffect(() => {
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // Reliable layout: useLayoutEffect + ResizeObserver with explicit refs
  useLayoutEffect(() => {
    if (!mounted) return;

    let raf1 = 0;
    let raf2 = 0;

    const applyDefaultLayout = () => {
      const rootEl = rootRef.current;
      const headerEl = headerRef.current;
      const topbarInnerEl = topbarInnerRef.current;
      if (!rootEl || !headerEl || !topbarInnerEl) return;

      // Resolve minimap element (lazy)
      if (!minimapElRef.current) {
        minimapElRef.current = findMinimapEl();
      }

      const rootRect = rootEl.getBoundingClientRect();
      const headerRect = headerEl.getBoundingClientRect();
      const innerRect = topbarInnerEl.getBoundingClientRect();

      // Convert viewport -> root-local coordinates
      const innerLeft = innerRect.left - rootRect.left;
      const innerRight = innerRect.right - rootRect.left;
      const headerBottom = headerRect.bottom - rootRect.top;

      const gapBelowTopbar = 5;
      const panelTopY = Math.round(headerBottom + gapBelowTopbar);

      const blocksW = 280;
      const inspectorW = 320;

      const edgeInset = 0;
      const blocksX = Math.round(innerLeft + edgeInset);
      const inspectorX = Math.round(innerRight - inspectorW - edgeInset);

      const safeLeft = 12;
      const safeRight = 12;

      const rootW = rootRect.width;
      const rootH = rootRect.height;

      const blocksXClamped = clamp(blocksX, safeLeft, rootW - blocksW - safeRight);
      const inspectorXClamped = clamp(inspectorX, safeLeft, rootW - inspectorW - safeRight);

      const minimapEl = minimapElRef.current;
      const minimapRect = minimapEl ? minimapEl.getBoundingClientRect() : null;

      const bottomPad = 20;
      const minimapTopY = minimapRect ? minimapRect.top - rootRect.top : rootH;

      const inspectorMaxH = Math.max(240, Math.floor(minimapTopY - panelTopY - bottomPad));
      const blocksH = Math.max(240, Math.floor(rootH - panelTopY - bottomPad));

      setWindows((prev) => {
        const next = { ...prev };

        if (!userMovedRef.current.blocks) {
          next.blocks = {
            ...next.blocks,
            x: blocksXClamped,
            y: panelTopY,
            width: blocksW,
            height: blocksH,
            visible: true,
            minimized: false,
          };
        }

        if (!userMovedRef.current.inspector) {
          next.inspector = {
            ...next.inspector,
            x: inspectorXClamped,
            y: panelTopY,
            width: inspectorW,
            height: inspectorMaxH,
            visible: true,
            minimized: false,
          };
        }

        return next;
      });

      setWindowsInitialized(true);
    };

    // Double rAF to let layout settle (fonts, images, etc.)
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        applyDefaultLayout();
      });
    });

    // Observe root + topbar + minimap resizing (the key to "always correct")
    const ro = new ResizeObserver(() => {
      // don't spam; schedule on next frame
      requestAnimationFrame(applyDefaultLayout);
    });

    if (rootRef.current) ro.observe(rootRef.current);
    if (headerRef.current) ro.observe(headerRef.current);
    if (topbarInnerRef.current) ro.observe(topbarInnerRef.current);

    const tryAttachMinimap = () => {
      const mm = findMinimapEl();
      if (mm && mm !== minimapElRef.current) {
        minimapElRef.current = mm;
        ro.observe(mm);
        applyDefaultLayout();
      }
    };

    // Try attach minimap now + shortly after (ReactFlow mounts later)
    tryAttachMinimap();
    const t = window.setTimeout(tryAttachMinimap, 300);

    // Also handle viewport resize
    const onWinResize = () => requestAnimationFrame(applyDefaultLayout);
    window.addEventListener("resize", onWinResize);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t);
      window.removeEventListener("resize", onWinResize);
      ro.disconnect();
    };
  }, [mounted]);

  // stats polling (safe + cheap)
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      const g = beRef.current?.getGraph?.();
      if (!g) return;
      setStats({ nodes: g.nodes?.length ?? 0, edges: g.edges?.length ?? 0 });

      // Sync canvas control states
      if (beRef.current) {
        setShowGrid(beRef.current.getShowGrid?.() ?? true);
        setLocked(beRef.current.getLocked?.() ?? false);
        setIsFullscreen(beRef.current.getIsFullscreen?.() ?? false);
      }
    }, 700);
    return () => clearInterval(id);
  }, [mounted]);

  // In preview mode: hard-disable editing keystrokes (copy/paste/duplicate/delete/undo/redo)
  useEffect(() => {
    if (!mounted) return;
    if (!isPreview) return;

    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const meta = e.metaKey || e.ctrlKey;

      const block =
        key === "delete" ||
        key === "backspace" ||
        (meta && (key === "c" || key === "v" || key === "x" || key === "d")) ||
        (meta && key === "z") ||
        (meta && key === "y");

      if (block) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [mounted, isPreview]);

  // When entering preview: force-hide blocks/inspector and stop rename edit state
  useEffect(() => {
    if (!mounted) return;
    if (!isPreview) {
      // Clear preview state when leaving preview mode
      setPreviewOwnerHandle(null);
      setPreviewEdgazeCode(null);
      return;
    }

    setEditingName(false);
    setShowLauncher(false);
    setWindows((p) => ({
      ...p,
      blocks: { ...p.blocks, visible: false, minimized: false },
      inspector: { ...p.inspector, visible: false, minimized: false },
    }));
  }, [mounted, isPreview]);

  // Sync mode with URL param changes
  useEffect(() => {
    if (!mounted) return;
    const urlMode = previewParam ? "preview" : "edit";
    if (mode !== urlMode) {
      setMode(urlMode);
    }
  }, [mounted, previewParam, mode]);

  // listen to publish intent (bus) — ignore in preview
  useEffect(() => {
    const off = on("builder:publish", (p: any) => {
      if (isPreview) return;
      const id = typeof p?.workflowId === "string" ? p.workflowId : null;
      if (!id) return;
      setPublishWorkflowId(id);
      setPublishOpen(true);
    });

    return () => {
      try {
        off?.(); // ignore whatever it returns (boolean/undefined)
      } catch {}
    };
  }, [isPreview]);


  const refreshWorkflows = useCallback(async () => {
    setWfError(null);

    if (!authReady) return;

    if (!userId) {
      setDrafts([]);
      setPublished([]);
      setWfError("Please sign in to create and load workflows.");
      return;
    }

    setWfLoading(true);
    try {
      // drafts
      const { data, error } = await supabase
        .from("workflow_drafts")
        .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const rows = Array.isArray(data) ? (data as DraftRow[]) : [];
      setDrafts(rows);

      // published workflows (your own)
      const { data: wfData, error: wfErr } = await supabase
        .from("workflows")
        .select("id,owner_id,title,graph,created_at,updated_at")
        .eq("owner_id", userId)
        .eq("is_published", true)
        .order("updated_at", { ascending: false });

      if (wfErr) throw wfErr;

      const pubRows = Array.isArray(wfData) ? ((wfData as any) as DraftRow[]) : [];
      setPublished(pubRows);

      safeTrack("Workflows Listed", {
        surface: "builder",
        draft_count: rows.length,
        published_count: pubRows.length,
      });
    } catch (e: any) {
      setDrafts([]);
      setPublished([]);
      setWfError(e?.message || "Failed to load workflows.");

      safeTrack("Workflows List Failed", {
        surface: "builder",
        message: e?.message || "unknown",
      });
    } finally {
      setWfLoading(false);
    }
  }, [authReady, userId, supabase]);

  useEffect(() => {
    if (!mounted) return;
    void refreshWorkflows();
  }, [mounted, refreshWorkflows]);

  const hashGraph = (g: { nodes: any[]; edges: any[] }) => {
    // low-cost stable hash: counts + ids + positions + config (to detect config changes)
    const ns = (g.nodes || [])
      .map((n: any) => {
        const configHash = JSON.stringify(n.data?.config ?? {});
        return `${n.id}:${Math.round(n.position?.x ?? 0)}:${Math.round(n.position?.y ?? 0)}:${configHash}`;
      })
      .join("|");
    const es = (g.edges || [])
      .map(
        (e: any) =>
          `${e.id ?? ""}:${e.source ?? ""}->${e.target ?? ""}:${e.sourceHandle ?? ""}:${e.targetHandle ?? ""}`
      )
      .join("|");
    return `${g.nodes?.length ?? 0}/${g.edges?.length ?? 0}::${ns}::${es}`;
  };

  const cloneGraph = (g: { nodes: any[]; edges: any[] }) =>
    JSON.parse(JSON.stringify({ nodes: g.nodes ?? [], edges: g.edges ?? [] }));

  const loadGraphAndResetHistory = useCallback((g: { nodes: any[]; edges: any[] }) => {
    const normalized = normalizeGraph(g);
    setUndoStack([]);
    setRedoStack([]);
    isUndoRedoRef.current = true;
    previousGraphRef.current = cloneGraph(normalized);
    latestGraphRef.current = normalized;
    setCanvasValidation(validateWorkflowGraph(normalized.nodes ?? [], normalized.edges ?? []));
    beRef.current?.loadGraph?.(normalized);
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !activeDraftId) return;
    const current = beRef.current?.getGraph?.();
    if (!current) return;
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    isUndoRedoRef.current = true;
    setRedoStack((r) => [...r.slice(-(UNDO_HISTORY_MAX - 1)), cloneGraph(current)]);
    setUndoStack((u) => u.slice(0, -1));
    previousGraphRef.current = cloneGraph(prev);
    beRef.current?.loadGraph?.(prev);
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [activeDraftId, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !activeDraftId) return;
    const current = beRef.current?.getGraph?.();
    if (!current) return;
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    isUndoRedoRef.current = true;
    setUndoStack((u) => [...u.slice(-(UNDO_HISTORY_MAX - 1)), cloneGraph(current)]);
    setRedoStack((r) => r.slice(0, -1));
    previousGraphRef.current = cloneGraph(next);
    beRef.current?.loadGraph?.(next);
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [activeDraftId, redoStack]);

  // Edit mode: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
  useEffect(() => {
    if (!mounted || isPreview) return;

    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      if (meta && key === "z") {
        if (shift) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (meta && key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [mounted, isPreview, undo, redo]);

  const doAutosave = useCallback(async () => {
    if (isPreview) return;
    if (!userId || !activeDraftId) return;

    const graph = latestGraphRef.current;
    if (!graph) return;

    const h = hashGraph(graph);
    if (h === lastSavedHashRef.current) return;

    if (saveInFlightRef.current) {
      saveAgainRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    saveAgainRef.current = false;

    try {
      const update = { title: name || "Untitled Workflow", graph, updated_at: nowIso() };

      const { error } = await supabase
        .from("workflow_drafts")
        .update(update)
        .eq("id", activeDraftId)
        .eq("owner_id", userId);

      if (!error) lastSavedHashRef.current = h;
      if (error) console.error("Autosave failed", error);
    } finally {
      saveInFlightRef.current = false;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        queueMicrotask(() => void doAutosave());
      }
    }
  }, [supabase, userId, activeDraftId, name, isPreview]);

  const onGraphChange = useCallback(
    (graph: { nodes: any[]; edges: any[] }) => {
      setStats({ nodes: graph.nodes?.length ?? 0, edges: graph.edges?.length ?? 0 });
      // Run validation on every graph change - surfaces errors at canvas before run
      const validation = validateWorkflowGraph(graph.nodes ?? [], graph.edges ?? []);
      setCanvasValidation(validation);
      if (validation.valid) {
        setWfError(null); // Clear previous run error when user fixes issues at canvas
      }
      if (isPreview) return;
      latestGraphRef.current = graph;

      if (!activeDraftId) return;

      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => void doAutosave(), AUTOSAVE_MS);

      // Push previous graph to undo stack (debounced) so we don't record every drag frame
      if (isUndoRedoRef.current) return;
      if (graphChangeTimerRef.current) clearTimeout(graphChangeTimerRef.current);
      graphChangeTimerRef.current = setTimeout(() => {
        graphChangeTimerRef.current = null;
        const prev = previousGraphRef.current;
        const prevHash = prev ? hashGraph(prev) : "";
        const newHash = hashGraph(graph);
        if (prevHash === newHash) return;
        if (prev && (prev.nodes?.length > 0 || prev.edges?.length > 0)) {
          setUndoStack((u) => [...u.slice(-(UNDO_HISTORY_MAX - 1)), cloneGraph(prev)]);
          setRedoStack([]);
        }
        previousGraphRef.current = cloneGraph(graph);
      }, UNDO_DEBOUNCE_MS);
    },
    [activeDraftId, doAutosave, isPreview]
  );

  const onFocusValidationNode = useCallback(
    (nodeId: string, fieldHint?: string) => {
      if (isPreview) return;
      beRef.current?.selectAndFocusNode?.(nodeId);
      setInspectorFieldHint(fieldHint ?? null);
      setWindows((prev) => ({ ...prev, inspector: { ...prev.inspector, visible: true, minimized: false } }));
    },
    [isPreview]
  );

  const onSelectionChange = useCallback(
    (sel: any) => {
      if (isPreview) return;
      setInspectorFieldHint(null);
      // Always get the latest config from the graph to ensure we have the most up-to-date values
      const nodeId = typeof sel?.nodeId === "string" ? sel.nodeId : null;
      if (nodeId) {
        const graph = beRef.current?.getGraph?.();
        const node = graph?.nodes?.find((n: any) => n.id === nodeId);
        setSelection({
          nodeId,
          specId: typeof sel?.specId === "string" ? sel.specId : undefined,
          config: node?.data?.config ?? sel?.config ?? undefined,
        });
      } else {
        setSelection({
          nodeId: null,
          specId: undefined,
          config: undefined,
        });
      }
    },
    [isPreview]
  );

  const openDraft = useCallback(
    async (id: string) => {
      setWfError(null);
      if (!requireAuth()) return;
      if (!userId) return;

      setMode("edit");
      setShowLauncher(false);
      // Clear preview state when switching to edit mode
      setPreviewOwnerHandle(null);
      setPreviewEdgazeCode(null);

      setWfLoading(true);
      try {
        const { data, error } = await supabase
          .from("workflow_drafts")
          .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
          .eq("id", id)
          .eq("owner_id", userId)
          .single();

        if (error) throw error;

        const row = data as DraftRow;
        setActiveDraftId(String(row.id));
        setName(row.title || "Untitled Workflow");
        setEditingName(false);

        const g = normalizeGraph(row.graph);
        loadGraphAndResetHistory(g);

        safeTrack("Workflow Opened", {
          surface: "builder",
          source: "draft",
          workflow_id: String(row.id),
          title: row.title || "Untitled Workflow",
          node_count: g.nodes?.length ?? 0,
          edge_count: g.edges?.length ?? 0,
        });

        latestGraphRef.current = g;
        lastSavedHashRef.current = hashGraph(g);

        supabase
          .from("workflow_drafts")
          .update({ last_opened_at: nowIso() })
          .eq("id", row.id)
          .eq("owner_id", userId)
          .then(async () => {
            try {
              await Promise.resolve(refreshWorkflows());
            } catch {}
          });
      } catch (e: any) {
        setWfError(e?.message || "Failed to open workflow.");
        setShowLauncher(true);

        safeTrack("Workflow Open Failed", {
          surface: "builder",
          source: "draft",
          message: e?.message || "unknown",
        });
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, userId, supabase, refreshWorkflows, loadGraphAndResetHistory]
  );

  const openPublishedAsDraft = useCallback(
    async (workflowId: string) => {
      setWfError(null);
      if (!requireAuth()) return;
      if (!userId) return;

      setMode("edit");
      setShowLauncher(false);
      setWfLoading(true);

      try {
        const { data: wf, error: wfErr } = await supabase
          .from("workflows")
          .select("id,owner_id,title,graph")
          .eq("id", workflowId)
          .eq("owner_id", userId)
          .single();

        if (wfErr) throw wfErr;

        const wfRow = wf as any;
        const g = normalizeGraph(wfRow?.graph);

        const { data: created, error: insErr } = await supabase
          .from("workflow_drafts")
          .insert({ owner_id: userId, title: wfRow?.title || "Untitled Workflow", graph: stripGraphSecrets(g) as any, last_opened_at: nowIso() })
          .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
          .single();

        if (insErr) throw insErr;

        const row = created as DraftRow;

        setActiveDraftId(String(row.id));
        setName(row.title || "Untitled Workflow");
        setEditingName(false);

        const ng = normalizeGraph(row.graph);
        loadGraphAndResetHistory(ng);
        lastSavedHashRef.current = hashGraph(ng);

        safeTrack("Workflow Opened", {
          surface: "builder",
          source: "published_as_draft",
          workflow_id: String(row.id),
          from_workflow_id: String(workflowId),
          title: row.title || "Untitled Workflow",
          node_count: ng.nodes?.length ?? 0,
          edge_count: ng.edges?.length ?? 0,
        });

        await refreshWorkflows();
      } catch (e: any) {
        setWfError(e?.message || "Failed to open published workflow.");
        setShowLauncher(true);

        safeTrack("Workflow Open Failed", {
          surface: "builder",
          source: "published_as_draft",
          from_workflow_id: String(workflowId),
          message: e?.message || "unknown",
        });
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, userId, supabase, refreshWorkflows, loadGraphAndResetHistory]
  );

  const openMarketplaceWorkflowAsDraft = useCallback(
    async (workflowId: string) => {
      setWfError(null);
      if (!requireAuth()) return;
      if (!userId) return;

      setMode("edit");
      setShowLauncher(false);
      setWfLoading(true);

      try {
        const { data: wf, error: wfErr } = await supabase
          .from("workflows")
          .select("id,owner_id,title,graph,is_paid,monetisation_mode,is_public,is_published")
          .eq("id", workflowId)
          .eq("is_published", true)
          .maybeSingle();

        if (wfErr) throw wfErr;
        if (!wf) throw new Error("Workflow not found.");

        const wfRow = wf as any;

        if (wfRow.is_public === false) throw new Error("This workflow is private.");

        const isOwner = String(wfRow.owner_id ?? "") === String(userId);
        const isFree = wfRow.monetisation_mode === "free" || wfRow.is_paid === false;

        let hasPurchase = false;
        if (!isOwner && !isFree) {
          const { data: pr, error: prErr } = await supabase
            .from("workflow_purchases")
            .select("id,status")
            .eq("workflow_id", workflowId)
            .eq("buyer_id", userId)
            .maybeSingle();

          if (prErr) throw prErr;
          hasPurchase = Boolean(pr && (pr as any).status && (pr as any).status !== "refunded");
        }

        if (!isOwner && !isFree && !hasPurchase) {
          throw new Error("You don’t have access to this workflow.");
        }

        const g = normalizeGraph(wfRow?.graph);

        const { data: created, error: insErr } = await supabase
          .from("workflow_drafts")
          .insert({ owner_id: userId, title: wfRow?.title || "Untitled Workflow", graph: stripGraphSecrets(g) as any, last_opened_at: nowIso() })
          .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
          .single();

        if (insErr) throw insErr;

        const row = created as DraftRow;

        setActiveDraftId(String(row.id));
        setName(row.title || "Untitled Workflow");
        setEditingName(false);

        const loaded = normalizeGraph(row.graph);
        loadGraphAndResetHistory(loaded);
        lastSavedHashRef.current = hashGraph(loaded);

        await refreshWorkflows();
      } catch (e: any) {
        setWfError(e?.message || "Failed to open workflow.");
        setShowLauncher(true);
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, userId, supabase, refreshWorkflows, loadGraphAndResetHistory]
  );

  const openMarketplaceWorkflowPreview = useCallback(
    async (workflowId: string) => {
      setWfError(null);
      if (!requireAuth()) return;
      if (!userId) return;

      setMode("preview");
      setShowLauncher(false);
      setWfLoading(true);

      try {
        const { data: wf, error: wfErr } = await supabase
          .from("workflows")
          .select("id,owner_id,owner_handle,edgaze_code,title,graph,is_paid,monetisation_mode,is_public,is_published")
          .eq("id", workflowId)
          .eq("is_published", true)
          .maybeSingle();

        if (wfErr) throw wfErr;
        if (!wf) throw new Error("Workflow not found.");

        const wfRow = wf as any;

        if (wfRow.is_public === false) throw new Error("This workflow is private.");

        const isOwner = String(wfRow.owner_id ?? "") === String(userId);
        const isFree = wfRow.monetisation_mode === "free" || wfRow.is_paid === false;

        let hasPurchase = false;
        if (!isOwner && !isFree) {
          const { data: pr, error: prErr } = await supabase
            .from("workflow_purchases")
            .select("id,status")
            .eq("workflow_id", workflowId)
            .eq("buyer_id", userId)
            .maybeSingle();

          if (prErr) throw prErr;
          hasPurchase = Boolean(pr && (pr as any).status && (pr as any).status !== "refunded");
        }

        if (!isOwner && !isFree && !hasPurchase) {
          throw new Error("You don’t have access to this workflow.");
        }

        const g = normalizeGraph(wfRow?.graph);
        setActiveDraftId(String(workflowId)); // run uses this id
        setName(wfRow?.title || "Untitled Workflow");
        setEditingName(false);

        // Store product page info for back button
        setPreviewOwnerHandle(wfRow?.owner_handle ?? null);
        setPreviewEdgazeCode(wfRow?.edgaze_code ?? null);

        loadGraphAndResetHistory(g);
        lastSavedHashRef.current = hashGraph(g);

        setWindows((p) => ({
          ...p,
          blocks: { ...p.blocks, visible: false, minimized: false },
          inspector: { ...p.inspector, visible: false, minimized: false },
        }));
      } catch (e: any) {
        setWfError(e?.message || "Failed to open workflow.");
        setShowLauncher(true);
        setMode("edit");
        // Clear preview state on error
        setPreviewOwnerHandle(null);
        setPreviewEdgazeCode(null);
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, userId, supabase, loadGraphAndResetHistory]
  );

  // Auto-open from URL param once auth is ready (preview works on mobile, edit is desktop-only)
  useEffect(() => {
    if (!mounted) return;
    if (!authReady) return;

    const wid = searchParams?.get("workflowId");
    if (!wid) return;

    // For edit mode, require desktop. Preview mode works on mobile.
    if (!previewParam && !isDesktop) return;

    if (openedWorkflowIdRef.current === wid + (previewParam ? "|p" : "|e")) return;
    openedWorkflowIdRef.current = wid + (previewParam ? "|p" : "|e");

    if (activeDraftId) return;

    if (previewParam) {
      void openMarketplaceWorkflowPreview(wid);
    } else {
      void openMarketplaceWorkflowAsDraft(wid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isDesktop, authReady, previewParam]);

  const createDraft = useCallback(async () => {
    setWfError(null);
    if (!requireAuth()) return;
    if (!userId) return;

    setMode("edit");

    const title = newTitle.trim();
    if (!title) {
      setWfError("Workflow name is required.");
      return;
    }

    setCreating(true);
    try {
      const emptyGraph = { nodes: [], edges: [] };

      const { data, error } = await supabase
        .from("workflow_drafts")
        .insert({ owner_id: userId, title, graph: emptyGraph, last_opened_at: nowIso() })
        .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
        .single();

      if (error) throw error;

      const row = data as DraftRow;

      setActiveDraftId(String(row.id));
      setName(row.title || "Untitled Workflow");
      setEditingName(false);

      const g = normalizeGraph(row.graph);
      loadGraphAndResetHistory(g);
      lastSavedHashRef.current = hashGraph(g);

      setShowLauncher(false);
      setNewOpen(false);
      setNewTitle("");

      safeTrack("Workflow Created", {
        surface: "builder",
        workflow_id: String(row.id),
        title: row.title || title,
      });

      await refreshWorkflows();
    } catch (e: any) {
      setWfError(e?.message || "Failed to create workflow.");

      safeTrack("Workflow Create Failed", {
        surface: "builder",
        title,
        message: e?.message || "unknown",
      });
    } finally {
      setCreating(false);
    }
  }, [requireAuth, userId, supabase, newTitle, refreshWorkflows, loadGraphAndResetHistory]);

  const createDraftFromQuickStart = useCallback(
    async (templateId: string) => {
      setWfError(null);
      if (!requireAuth()) return;
      if (!userId) return;

      const template = getQuickStartTemplate(templateId);
      if (!template) {
        setWfError("Quick start template not found.");
        return;
      }

      setMode("edit");
      setCreating(true);
      try {
        const g = normalizeGraph(template.graph);

        const { data, error } = await supabase
          .from("workflow_drafts")
          .insert({
            owner_id: userId,
            title: template.title,
            graph: stripGraphSecrets(g) as any,
            last_opened_at: nowIso(),
          })
          .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
          .single();

        if (error) throw error;

        const row = data as DraftRow;

        setActiveDraftId(String(row.id));
        setName(row.title || "Untitled Workflow");
        setEditingName(false);

        loadGraphAndResetHistory(g);
        lastSavedHashRef.current = hashGraph(g);

        setShowLauncher(false);

        safeTrack("Workflow Created", {
          surface: "builder",
          source: "quick_start",
          template_id: templateId,
          workflow_id: String(row.id),
          title: template.title,
          node_count: g.nodes?.length ?? 0,
          edge_count: g.edges?.length ?? 0,
        });

        await refreshWorkflows();
      } catch (e: any) {
        setWfError(e?.message || "Failed to load quick start.");
        safeTrack("Workflow Create Failed", {
          surface: "builder",
          source: "quick_start",
          template_id: templateId,
          message: e?.message || "unknown",
        });
      } finally {
        setCreating(false);
      }
    },
    [requireAuth, userId, supabase, refreshWorkflows, loadGraphAndResetHistory]
  );

  const ensureDraftSavedNow = useCallback(async () => {
    if (isPreview) return;
    if (!userId || !activeDraftId) return;
    // Always get the latest graph from the canvas to ensure we have the most recent config
    const g = beRef.current?.getGraph?.();
    if (!g) return;

    latestGraphRef.current = g;

    const update = { title: name || "Untitled Workflow", graph: stripGraphSecrets(g) as any, updated_at: nowIso() };

    const { error } = await supabase.from("workflow_drafts").update(update).eq("id", activeDraftId).eq("owner_id", userId);

    if (!error) {
      lastSavedHashRef.current = hashGraph(g);
    } else {
      console.error("Failed to save draft before publish:", error);
    }
  }, [supabase, userId, activeDraftId, name, isPreview]);

  // ----- Floating window drag/resize (foolproof, no crashes) -----
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      setWindows((prev) => {
        const w = prev[drag.id];
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;

        const minW = 340;
        const minH = 240;

        const rr = rootRef.current?.getBoundingClientRect();
        const maxW = rr?.width ?? window.innerWidth;
        const maxH = rr?.height ?? window.innerHeight;

        let next: WindowState = { ...w };

        if (drag.type === "move") {
          next.x = clamp(drag.startRect.x + dx, 12, maxW - 80);
          next.y = clamp(drag.startRect.y + dy, 12, maxH - 80);
        } else {
          const sr = drag.startRect;

          if (drag.type === "resize-se") {
            next.width = Math.max(minW, sr.width + dx);
            next.height = Math.max(minH, sr.height + dy);
          } else if (drag.type === "resize-sw") {
            next.width = Math.max(minW, sr.width - dx);
            next.height = Math.max(minH, sr.height + dy);
            next.x = clamp(sr.x + dx, 12, sr.x + sr.width - minW);
          } else if (drag.type === "resize-e") {
            next.width = Math.max(minW, sr.width + dx);
          } else if (drag.type === "resize-s") {
            next.height = Math.max(minH, sr.height + dy);
          } else if (drag.type === "resize-w") {
            next.width = Math.max(minW, sr.width - dx);
            next.x = clamp(sr.x + dx, 12, sr.x + sr.width - minW);
          } else if (drag.type === "resize-n") {
            next.height = Math.max(minH, sr.height - dy);
            next.y = clamp(sr.y + dy, 12, sr.y + sr.height - minH);
          }
        }

        return { ...prev, [drag.id]: next };
      });
    };

    const onUp = () => setDrag(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag]);

  const startDrag =
    (id: WindowKind, type: DragType) =>
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      userMovedRef.current[id] = true; // Mark as user-moved so auto-layout doesn't override
      setDrag({ id, type, startX: e.clientX, startY: e.clientY, startRect: windows[id] });
    };

  const toggleWindow = (id: WindowKind) => {
    if (isPreview) return;
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], visible: !prev[id].visible, minimized: false } }));
  };

  const minimizeWindow = (id: WindowKind) => {
    if (isPreview) return;
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], minimized: !prev[id].minimized } }));
  };

  // topbar actions
  const openLauncher = () => {
    if (isPreview) {
      router.push("/marketplace");
      return;
    }
    if (!activeDraftId) {
      router.push("/marketplace");
      return;
    }
    setShowLauncher(true);
  };

  // Premium workflow execution
  const runWorkflow = async () => {
    if (!activeDraftId) return;

    const graph = beRef.current?.getGraph?.();
    if (!graph) return;

    // Show instant toast notification
    setShowPreparingToast(true);

    // Device-based limit only for unauthenticated preview (product page demo). Purchased workflows use server-side 10-run limit.
    if (isPreview) {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        const canRun = await canRunDemo(activeDraftId);
        if (!canRun) {
          safeTrack("Workflow Demo Run Blocked", {
            surface: "builder",
            workflow_id: activeDraftId,
            reason: "device_limit_reached",
          });
          setWfError(`You've used your free demo runs for this workflow. Sign in or add your own API keys to continue.`);
          return;
        }
      }
    }

    safeTrack("Workflow Run Initiated", {
      surface: "builder",
      workflow_id: activeDraftId,
      workflow_name: name,
      node_count: graph.nodes?.length || 0,
      edge_count: graph.edges?.length || 0,
      is_preview: isPreview,
    });

    // Validate workflow graph before execution
    const validation = validateWorkflowGraph(graph.nodes || [], graph.edges || []);

    if (!validation.valid) {
      const errorMessage = validation.errors.map((e) => e.message).join("\n\n");
      setWfError(errorMessage);
      safeTrack("Workflow Run Blocked", {
        surface: "builder",
        workflow_id: activeDraftId,
        reason: "validation_failed",
        errors: validation.errors.map((e) => e.message),
      });
      return;
    }

    // Extract inputs from workflow
    const inputs = extractWorkflowInputs(graph.nodes || []);
    const aiSpecs = ["openai-chat", "openai-embeddings", "openai-image"];
    const hasAiNodes = (graph.nodes || []).some((n: any) => aiSpecs.includes(n.data?.specId ?? ""));
    const isBuilderTest = !isPreview;
    const showInputPhase = inputs.length > 0 || (isBuilderTest && hasAiNodes);

    // Builder test requires authentication (unlike preview/demo)
    if (isBuilderTest) {
      if (!requireAuth()) {
        // User needs to sign in - requireAuth already opens the sign-in modal
        return;
      }
    }

    // Fetch remaining runs for builder test or purchased preview (both get 10 runs)
    if (hasAiNodes && (isBuilderTest || (isPreview && (await getAccessToken())))) {
      try {
        const accessToken = await getAccessToken();
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        const remRes = await fetch(
          `/api/flow/run/remaining?workflowId=${encodeURIComponent(activeDraftId)}&isBuilderTest=${isBuilderTest ? "1" : "0"}&isPreview=${isPreview ? "1" : "0"}`,
          { method: "GET", headers, credentials: "include" }
        );
        if (remRes.ok) {
          const rem = await remRes.json();
          if (rem.ok) {
            if (rem.isAdmin) {
              setBuilderRunLimit({ used: 0, limit: 999999, isAdmin: true });
            } else if (rem.used != null && rem.limit != null) {
              setBuilderRunLimit({ used: rem.used, limit: rem.limit, isAdmin: false });
            }
          }
        }
      } catch {
        setBuilderRunLimit({ used: 0, limit: 10 });
      }
    } else {
      setBuilderRunLimit(null);
    }

    // Initialize run state
    const workflowGraph = beRef.current?.getGraph?.();
    const initialState: WorkflowRunState = {
      workflowId: activeDraftId,
      workflowName: name || "Untitled Workflow",
      phase: showInputPhase ? "input" : "executing",
      status: "idle",
      steps: [],
      graph: workflowGraph ? {
        nodes: (workflowGraph.nodes || []).map((n: any) => ({
          id: n.id,
          data: {
            specId: n.data?.specId,
            title: n.data?.title,
            config: n.data?.config,
          },
        })),
        edges: (workflowGraph.edges || []).map((e: any) => ({
          source: e.source,
          target: e.target,
        })),
      } : undefined,
      logs: [],
      inputs: showInputPhase ? (inputs.length > 0 ? inputs : []) : undefined,
      summary: validation.warnings.length > 0
        ? `${validation.warnings.length} warning(s): ${validation.warnings[0]?.message ?? ""}`
        : undefined,
    };

    setRunState(initialState);
    setRunModalOpen(true);
    setRequiresApiKeys(null);
    autoExecuteTriggeredRef.current = false;
    // Hide toast when modal opens
    setShowPreparingToast(false);
    setRunning(true);

    // keep the bus event for future, but don’t execute runtime logic now
    // emit("builder:run", { workflowId: activeDraftId });
  };

  const publishWorkflow = () => {
    if (isPreview) return;
    emit("builder:publish", { workflowId: activeDraftId });
  };

  const handleSubmitInputs = async (inputValues: Record<string, any>) => {
    if (!activeDraftId || !runState) return;

    const graph = beRef.current?.getGraph?.();
    if (!graph) return;

    const aiSpecs = ["openai-chat", "openai-embeddings", "openai-image"];
    const hasAiNodes = (graph.nodes || []).some((n: any) => aiSpecs.includes(n.data?.specId ?? ""));

    // Builder test requires authentication (unlike preview/demo)
    const isBuilderTest = !isPreview;
    if (isBuilderTest) {
      if (!requireAuth()) {
        // User needs to sign in - requireAuth already opens the sign-in modal
        return;
      }
    }

    // Track demo run only for unauthenticated preview (product page one-time demo). Purchased workflows use server-side workflow_runs.
    if (isPreview) {
      const token = await getAccessToken();
      if (!token) {
        trackDemoRun(activeDraftId);
      }
    }

    const openaiApiKeyFromModal = typeof inputValues.__openaiApiKey === "string" ? inputValues.__openaiApiKey.trim() : "";

    // Convert File objects to base64 for transmission (exclude __openaiApiKey from inputs)
    const processedInputs: Record<string, any> = {};
    for (const [key, value] of Object.entries(inputValues)) {
      if (key === "__openaiApiKey") continue;
      if (value instanceof File) {
        // Convert file to base64
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(value);
          });
          processedInputs[key] = {
            filename: value.name,
            type: value.type,
            size: value.size,
            data: base64,
          };
        } catch (error) {
          console.error("Failed to convert file to base64:", error);
          setWfError("Failed to process file upload. Please try again.");
          return;
        }
      } else {
        processedInputs[key] = value;
      }
    }

    // Collect API keys from node configs and from modal (when BYOK required after free runs exhausted)
    const userApiKeys: Record<string, Record<string, string>> = {};
    const modalApiKey = openaiApiKeyFromModal;
    for (const node of graph.nodes || []) {
      const specId = node.data?.specId;
      const apiKey = node.data?.config?.apiKey;

      // Check if this node requires API keys and has one configured
      if (specId && ["openai-chat", "openai-embeddings", "openai-image"].includes(specId)) {
        if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
          userApiKeys[node.id] = { apiKey: apiKey.trim() };
        } else if (modalApiKey && requiresApiKeys?.includes(node.id)) {
          userApiKeys[node.id] = { apiKey: modalApiKey };
        }
      }
    }

    // Update state to executing
    setRunState({
      ...runState,
      phase: "executing",
      status: "running",
      inputValues: processedInputs,
      startedAt: Date.now(),
    });

    try {
      // Get access token from auth context to ensure session is passed
      const accessToken = await getAccessToken();

      // Build headers with auth token if available
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      runAbortRef.current = new AbortController();
      const response = await fetch("/api/flow/run", {
        method: "POST",
        headers,
        credentials: "include", // Ensure cookies are sent
        signal: runAbortRef.current.signal,
        body: JSON.stringify({
          workflowId: activeDraftId,
          nodes: graph.nodes || [],
          edges: graph.edges || [],
          inputs: processedInputs,
          userApiKeys,
          isDemo: isPreview,
          isBuilderTest: !isPreview,
          openaiApiKey: !isPreview ? openaiApiKeyFromModal || undefined : undefined,
          stream: true,
        }),
      });

      if (!response.ok) {
        let errorData: any = { error: `HTTP ${response.status}: ${response.statusText}` };
        try {
          errorData = await response.json();
        } catch {
          // If JSON parsing fails, use the status text
        }
        const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;

        // Update run counter from error response if available
        if (activeDraftId && hasAiNodes && errorData.freeRunsRemaining != null) {
          const limit = isPreview ? 10 : 10;
          const freeRunsRemaining = errorData.freeRunsRemaining;
          const used = Math.max(0, limit - freeRunsRemaining);
          setBuilderRunLimit({ used, limit, isAdmin: false });
        }

        // BYOK required: switch to input phase and show API key prompt
        if (response.status === 403 && Array.isArray(errorData.requiresApiKeys) && errorData.requiresApiKeys.length > 0) {
          setRequiresApiKeys(errorData.requiresApiKeys);
          const inputs = extractWorkflowInputs(graph.nodes || []);
          setRunState((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "input",
                  status: "idle",
                  inputs: inputs.length > 0 ? inputs : [],
                  error: undefined,
                }
              : prev
          );
          setRunning(false);
          return;
        }

        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type") || "";
      const isStreaming = contentType.includes("ndjson");

      let result: any;

      if (isStreaming && response.body) {
        // Live streaming: consume NDJSON and update runState as nodes execute
        const execOrder = getExecutionOrder(graph.nodes || [], graph.edges || []);
        const nodeMap = new Map((graph.nodes || []).map((n: any) => [n.id, n]));
        const initialSteps: WorkflowRunStep[] = execOrder.map((nodeId) => {
          const node = nodeMap.get(nodeId);
          const specId = node?.data?.specId || "default";
          return {
            id: nodeId,
            title: node?.data?.title || node?.data?.config?.name || humanReadableStep(specId),
            status: "queued" as const,
            timestamp: Date.now(),
          };
        });

        setRunState((prev) => (prev ? { ...prev, steps: initialSteps } : prev));

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.type === "node_start") {
                setRunState((prev) => {
                  if (!prev) return prev;
                  const next = prev.steps.map((s) => (s.id === evt.nodeId ? { ...s, status: "running" as const } : s));
                  return { ...prev, steps: next, currentStepId: evt.nodeId };
                });
              } else if (evt.type === "node_done") {
                setRunState((prev) => {
                  if (!prev) return prev;
                  const next = prev.steps.map((s) => (s.id === evt.nodeId ? { ...s, status: "done" as const } : s));
                  return { ...prev, steps: next, currentStepId: null };
                });
              } else if (evt.type === "node_failed") {
                setRunState((prev) => {
                  if (!prev) return prev;
                  const next = prev.steps.map((s) => (s.id === evt.nodeId ? { ...s, status: "error" as const, detail: evt.error } : s));
                  return { ...prev, steps: next, currentStepId: null };
                });
              } else if (evt.type === "complete") {
                result = evt;
                break;
              }
            } catch {
              // Skip malformed lines
            }
          }
          if (result) break;
        }
        if (!result || !result.ok) {
          throw new Error(result?.error || "Execution failed");
        }
      } else {
        result = await response.json();
      }
      if (!result.ok) {
        const errorMessage = result.error || result.message || "Execution failed";

        // Update run counter from error response if available (failed runs also count)
        if (!isPreview && activeDraftId && hasAiNodes && result.freeRunsRemaining != null) {
          const FREE_BUILDER_RUNS = 10;
          const freeRunsRemaining = result.freeRunsRemaining;
          const used = Math.max(0, FREE_BUILDER_RUNS - freeRunsRemaining);
          setBuilderRunLimit({ used, limit: FREE_BUILDER_RUNS, isAdmin: false });
          console.warn(`[Run Counter] Updated from error result: ${used}/${FREE_BUILDER_RUNS}, remaining: ${freeRunsRemaining}`);
        }

        throw new Error(errorMessage);
      }

      // Update run counter immediately from API response (before processing result)
      if (activeDraftId && hasAiNodes && result.freeRunsRemaining != null) {
        const limit = 10;
        const freeRunsRemaining = result.freeRunsRemaining;
        const used = Math.max(0, limit - freeRunsRemaining);
        setBuilderRunLimit({ used, limit, isAdmin: false });
      }

      const executionResult = result.result;
      const logs = (executionResult.logs || []).map((log: any) => ({
        t: log.timestamp || Date.now(),
        level: log.type === "error" ? "error" : log.type === "warn" ? "warn" : "info",
        text: log.message || log.text || "",
        nodeId: log.nodeId,
        specId: log.specId,
      }));

      const steps = Object.entries(executionResult.nodeStatus || {}).map(([nodeId, status]: [string, any]) => {
        const node = graph.nodes?.find((n: any) => n.id === nodeId);
        const specId = node?.data?.specId || "default";
        const nodeTitle = node?.data?.title || node?.data?.config?.name || humanReadableStep(specId);
        const errorLog = logs.find((l: any) => l.nodeId === nodeId && l.level === "error");
        return {
          id: nodeId,
          title: nodeTitle,
          detail: errorLog ? errorLog.text : undefined,
          status: mapNodeStatus(status),
          icon: getStepIcon(specId),
          timestamp: Date.now(),
        };
      });

      // Build set of raw input values so we never show them as output (hide passthrough/echo)
      const displayInputValues = processedInputs
        ? Object.fromEntries(
            Object.entries(processedInputs).filter(
              ([k]) =>
                !k.startsWith("__") &&
                k !== "__openaiApiKey" &&
                k !== "__builder_test" &&
                k !== "__builder_user_key" &&
                k !== "__workflow_id"
            )
          )
        : {};
      const echoParts = Object.values(displayInputValues)
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);
      const echoPartSet = new Set(echoParts);
      const normalizeLines = (s: string) =>
        s
          .trim()
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .split(/\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .sort()
          .join("\n");
      const isEchoString = (s: string) => {
        const t = String(s).trim();
        if (!t.length) return false;
        if (echoPartSet.has(t)) return true;
        const norm = normalizeLines(t);
        const expectedNorm = echoParts.slice().sort().join("\n");
        return norm === expectedNorm;
      };

      const outputs = extractWorkflowOutputs(graph.nodes || [])
        .map((output) => {
          const finalOutput = executionResult.finalOutputs?.find((fo: any) => fo.nodeId === output.nodeId);
          if (!finalOutput) return null;
          let value = finalOutput.value;
          if (typeof value === "string" && isEchoString(value)) return null;
          if (value !== null && typeof value === "object" && Array.isArray((value as any).results)) {
            const results = ((value as any).results as unknown[]).filter(
              (item) => typeof item !== "string" || !isEchoString(item)
            );
            if (results.length === 0) return null;
            value = results.length === 1 ? results[0] : { ...(value as object), results };
          }
          return {
            ...output,
            value,
            type: typeof value === "string" ? "string" : "json",
          };
        })
        .filter((o): o is NonNullable<typeof o> => o != null);

      // Check for errors in logs or node status
      const hasError = executionResult.workflowStatus === "failed" ||
                       logs.some((l: any) => l.level === "error") ||
                       Object.values(executionResult.nodeStatus || {}).some((s: any) => s === "failed" || s === "timeout");

      const errorMessage = hasError
        ? logs.find((l: any) => l.level === "error")?.text ||
          Object.entries(executionResult.nodeStatus || {})
            .filter(([_, status]: [string, any]) => status === "failed" || status === "timeout")
            .map(([nodeId]: [string, any]) => {
              const node = graph.nodes?.find((n: any) => n.id === nodeId);
              return node?.data?.title || nodeId;
            })
            .join(", ") + " failed"
        : undefined;

      const workflowGraph = beRef.current?.getGraph?.();
      setRunState({
        ...runState,
        phase: "output",
        status: hasError ? "error" : "success",
        steps,
        logs,
        outputs: hasError ? undefined : outputs,
        outputsByNode: executionResult.outputsByNode || {},
        error: errorMessage,
        finishedAt: Date.now(),
        summary: hasError ? undefined : "Workflow executed successfully",
        graph: workflowGraph ? {
          nodes: (workflowGraph.nodes || []).map((n: any) => ({
            id: n.id,
            data: {
              specId: n.data?.specId,
              title: n.data?.title,
              config: n.data?.config,
            },
          })),
          edges: (workflowGraph.edges || []).map((e: any) => ({
            source: e.source,
            target: e.target,
          })),
        } : runState?.graph,
      });

      // Refresh remaining runs after successful completion as a backup/verification
      // (We already updated from the API response above, but this ensures sync with DB)
      if (!isPreview && activeDraftId && hasAiNodes) {
        setTimeout(async () => {
          try {
            const accessToken = await getAccessToken();
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
            const remRes = await fetch(
              `/api/flow/run/remaining?workflowId=${encodeURIComponent(activeDraftId)}&isBuilderTest=1`,
              { method: "GET", headers, credentials: "include" }
            );
            if (remRes.ok) {
              const rem = await remRes.json();
              if (rem.ok) {
                if (rem.isAdmin) {
                  setBuilderRunLimit({ used: 0, limit: 999999, isAdmin: true });
                } else if (rem.used != null && rem.limit != null) {
                  setBuilderRunLimit({ used: rem.used, limit: rem.limit, isAdmin: false });
                  console.warn(`[Run Counter] Verified/refreshed from DB: ${rem.used}/${rem.limit}`);
                }
              }
            }
          } catch (err) {
            console.error("Failed to refresh run count:", err);
          }
        }, 500); // 500ms delay to ensure DB update completed
      }

      safeTrack("Workflow Run Completed", {
        surface: "builder",
        workflow_id: activeDraftId,
        status: executionResult.workflowStatus,
        duration_ms: Date.now() - (runState.startedAt || Date.now()),
      });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        setRunning(false);
        return; // User cancelled - handleCancelRun already updated state
      }
      const errorMessage = error?.message || error?.toString() || "Execution failed. Please check your workflow configuration and try again.";

      // Refetch remaining runs after failed run too (failed runs also count)
      if (!isPreview && activeDraftId && hasAiNodes) {
        setTimeout(async () => {
          try {
            const accessToken = await getAccessToken();
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
            const remRes = await fetch(
              `/api/flow/run/remaining?workflowId=${encodeURIComponent(activeDraftId)}&isBuilderTest=1`,
              { method: "GET", headers, credentials: "include" }
            );
            if (remRes.ok) {
              const rem = await remRes.json();
              if (rem.ok) {
                if (rem.isAdmin) {
                  setBuilderRunLimit({ used: 0, limit: 999999, isAdmin: true });
                } else if (rem.used != null && rem.limit != null) {
                  setBuilderRunLimit({ used: rem.used, limit: rem.limit, isAdmin: false });
                  console.warn(`[Run Counter] Verified/refreshed after error: ${rem.used}/${rem.limit}`);
                }
              }
            }
          } catch (err) {
            console.error("Failed to refresh run count after error:", err);
          }
        }, 500); // 500ms delay to ensure DB update completed
      }

      const workflowGraph = beRef.current?.getGraph?.();
      setRunState({
        ...runState,
        phase: "output",
        status: "error",
        error: errorMessage,
        finishedAt: Date.now(),
        logs: [
          ...(runState.logs || []),
          {
            t: Date.now(),
            level: "error" as const,
            text: errorMessage,
          },
        ],
        graph: workflowGraph ? {
          nodes: (workflowGraph.nodes || []).map((n: any) => ({
            id: n.id,
            data: {
              specId: n.data?.specId,
              title: n.data?.title,
              config: n.data?.config,
            },
          })),
          edges: (workflowGraph.edges || []).map((e: any) => ({
            source: e.source,
            target: e.target,
          })),
        } : runState?.graph,
      });

      safeTrack("Workflow Run Failed", {
        surface: "builder",
        workflow_id: activeDraftId,
        error: errorMessage,
      });
    } finally {
      setRunning(false);
    }
  };

  const mapNodeStatus = (status: string): "queued" | "running" | "done" | "error" | "skipped" => {
    const map: Record<string, "queued" | "running" | "done" | "error" | "skipped"> = {
      idle: "queued",
      ready: "queued",
      running: "running",
      success: "done",
      failed: "error",
      timeout: "error",
      skipped: "skipped",
    };
    return map[status] || "queued";
  };

  const getStepIcon = (specId: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      input: <ArrowRight className="h-4 w-4" />,
      "openai-chat": <Play className="h-4 w-4" />,
      "openai-embeddings": <Play className="h-4 w-4" />,
      "openai-image": <Play className="h-4 w-4" />,
      "http-request": <Play className="h-4 w-4" />,
      merge: <Play className="h-4 w-4" />,
      transform: <Play className="h-4 w-4" />,
      output: <Play className="h-4 w-4" />,
    };
    return icons[specId] || <Play className="h-4 w-4" />;
  };

  const humanReadableStep = (specId: string): string => {
    const map: Record<string, string> = {
      input: "Collecting input data",
      "openai-chat": "Processing with AI",
      "openai-embeddings": "Generating embeddings",
      "openai-image": "Creating image",
      "http-request": "Fetching data",
      merge: "Combining data",
      transform: "Transforming data",
      output: "Preparing output",
    };
    return map[specId] || `Executing ${specId}`;
  };

  const handleCancelRun = () => {
    runAbortRef.current?.abort();
    setRunState((prev) => (prev ? { ...prev, status: "error", error: "Cancelled by user" } : null));
    setRunning(false);
  };

  const handleRerun = () => {
    setRunState(null);
    setRunModalOpen(false);
    setRequiresApiKeys(null);
    setShowPreparingToast(false);
    autoExecuteTriggeredRef.current = false;
    setTimeout(() => runWorkflow(), 100);
  };

  // Auto-execute when modal opens with no inputs (phase "executing" from start) - otherwise it would prepare forever
  useEffect(() => {
    if (
      !runModalOpen ||
      !runState ||
      runState.phase !== "executing" ||
      runState.status !== "idle" ||
      autoExecuteTriggeredRef.current
    )
      return;
    const hasInputs = runState.inputs && runState.inputs.length > 0;
    if (hasInputs) return;
    autoExecuteTriggeredRef.current = true;
    handleSubmitInputs({});
  }, [runModalOpen, runState?.phase, runState?.status, runState?.inputs?.length]);

  // If user is on small viewport, keep builder unavailable (except in preview mode).
  useEffect(() => {
    if (!mounted) return;
    if (!isDesktop && !isPreview) {
      setRunning(false);
      setShowLauncher(false);
    }
  }, [mounted, isDesktop, isPreview]);

  const publishDraftForModal =
    !isPreview && publishWorkflowId && publishWorkflowId === activeDraftId && activeDraftId && userId
      ? (() => {
          // Always get the latest graph from canvas to ensure we have the most recent config
          const latestGraph = beRef.current?.getGraph?.() ?? latestGraphRef.current ?? { nodes: [], edges: [] };
          const safeGraph = stripGraphSecrets(latestGraph) as any;
          return {
            id: activeDraftId,
            owner_id: userId,
            title: name || "Untitled Workflow",
            graph_json: safeGraph,
            graph: safeGraph,
            created_at: nowIso(),
            updated_at: nowIso(),
            last_opened_at: nowIso(),
          };
        })()
      : null;

  return (
    <div ref={rootRef} className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(255,255,255,0.08),transparent_60%),linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,0,0,0.75)_35%,rgba(0,0,0,0.92))]" />

      {/* Canvas - Full height, extends to top */}
      <div className="absolute inset-0 z-0">
        <ReactFlowCanvas ref={beRef} mode={mode} onGraphChange={onGraphChange} onSelectionChange={onSelectionChange} />
      </div>

      {/* Top bar (floating on top of canvas) */}
      <div ref={headerRef} className={cx(
        "absolute top-0 left-0 right-0 z-20 transition-all duration-200",
        isPreview ? "px-3 pt-3 md:px-5 md:pt-4" : "px-5 pt-4"
      )}>
        {/* Preparing Toast Notification */}
        {showPreparingToast && (
          <div className="mb-3 opacity-0 animate-[fadeInSlide_0.3s_ease-out_forwards]">
            <div className="w-full rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 backdrop-blur-xl shadow-[0_8px_32px_rgba(34,211,238,0.25)] px-4 py-3 flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-md animate-pulse" />
                <Loader2 className="relative h-5 w-5 text-cyan-400 animate-spin" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">Preparing to run</div>
                <div className="text-xs text-white/60">Initializing workflow execution...</div>
              </div>
            </div>
          </div>
        )}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fadeInSlide {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}} />
        {isPreview ? (
          /* Premium Preview Mode Topbar - Mobile Optimized */
          <div
            ref={topbarInnerRef}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_24px_120px_rgba(0,0,0,0.65)] px-3 py-2.5 md:px-4 md:py-3 flex items-center justify-between transition-all duration-200"
          >
            {/* Left: Back Button (mobile) + Logo + Title */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {/* Back button - visible on mobile when we have product page info */}
              {previewOwnerHandle && previewEdgazeCode && (
                <button
                  onClick={() => {
                    router.push(`/${previewOwnerHandle}/${previewEdgazeCode}`);
                  }}
                  className="h-8 w-8 md:h-9 md:w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors shrink-0"
                  title="Back to product page"
                >
                  <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-white/80" />
                </button>
              )}
              <div className="shrink-0">
                <ProfileAvatar
                  name={profile?.full_name}
                  avatarUrl={profile?.avatar_url}
                  size={36}
                  handle={profile?.handle}
                  showFallback
                />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] md:text-[18px] font-semibold text-white truncate">{name || "Untitled Workflow"}</div>
                <div className="hidden md:flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-white/45">
                    {stats.nodes} nodes · {stats.edges} edges
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Run Button (mobile optimized) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={runWorkflow}
                disabled={!activeDraftId || (canvasValidation != null && !canvasValidation.valid)}
                className={cx(
                  "relative inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 backdrop-blur-sm px-4 py-2.5 md:px-6 md:py-3 text-[13px] md:text-[14px] font-semibold text-white shadow-[0_8px_32px_rgba(34,211,238,0.25)] hover:from-cyan-500/30 hover:to-purple-500/30 transition-all duration-200",
                  "min-w-[100px] md:min-w-[140px]",
                  (!activeDraftId || (canvasValidation != null && !canvasValidation.valid)) && "opacity-50 cursor-not-allowed"
                )}
                title={
                  canvasValidation && !canvasValidation.valid
                    ? canvasValidation.errors[0]?.message ?? "Fix issues before running"
                    : "Run Workflow"
                }
              >
                <Play className="h-4 w-4 md:h-5 md:w-5" />
                <span className="hidden sm:inline">Run</span>
              </button>

              {/* Zoom controls (mobile: smaller, desktop: normal) */}
              <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                <button
                  onClick={() => beRef.current?.zoomOut?.()}
                  title="Zoom out"
                  className="h-8 w-8 md:h-9 md:w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors"
                >
                  <ZoomOut className="h-3.5 w-3.5 md:h-4 md:w-4 text-white/80" />
                </button>
                <button
                  onClick={() => beRef.current?.zoomIn?.()}
                  title="Zoom in"
                  className="h-8 w-8 md:h-9 md:w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors"
                >
                  <ZoomIn className="h-3.5 w-3.5 md:h-4 md:w-4 text-white/80" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Edit Mode Topbar (existing) */
          <div
            ref={topbarInnerRef}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_24px_120px_rgba(0,0,0,0.65)] px-4 py-3 flex items-center justify-between gap-4 min-h-[56px] overflow-x-auto transition-all duration-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <ProfileAvatar
                  name={profile?.full_name}
                  avatarUrl={profile?.avatar_url}
                  size={36}
                  handle={profile?.handle}
                  showFallback
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] uppercase tracking-widest text-white/50">Workflow</div>

                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                    v1 Alpha preview
                  </span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  {!editingName ? (
                    <button
                      className="text-[18px] font-semibold text-white truncate hover:text-white/90 transition-colors"
                      onClick={() => setEditingName(true)}
                      title="Rename"
                    >
                      {name || "Untitled Workflow"}
                    </button>
                  ) : (
                    <input
                      className="w-[min(420px,50vw)] rounded-xl bg-black/40 border border-white/10 px-3 py-1.5 text-[14px] text-white outline-none"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setEditingName(false);
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      autoFocus
                    />
                  )}

                  {activeDraftId ? (
                    <span className="text-[11px] text-white/45">
                      {stats.nodes} nodes · {stats.edges} edges
                    </span>
                  ) : (
                    <span className="text-[11px] text-white/45">No workflow open</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/docs/builder/workflow-studio"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
                title="Documentation"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Docs</span>
              </Link>

              <button
                onClick={openLauncher}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
                title="Home"
              >
                Home
              </button>

              <button
                onClick={runWorkflow}
                disabled={!activeDraftId || (canvasValidation != null && !canvasValidation.valid)}
                className={cx(
                  "relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors",
                  (!activeDraftId || (canvasValidation != null && !canvasValidation.valid)) && "opacity-60 cursor-not-allowed"
                )}
                title={
                  canvasValidation && !canvasValidation.valid
                    ? canvasValidation.errors[0]?.message ?? "Fix issues before running"
                    : "Run Workflow"
                }
              >
                <Play className="h-4 w-4" />
                <span>Run</span>
              </button>

              <button
                onClick={publishWorkflow}
                disabled={!activeDraftId}
                className={cx(
                  "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors",
                  !activeDraftId && "opacity-60 cursor-not-allowed"
                )}
                title="Publish"
              >
                <Rocket className="h-4 w-4" />
                Publish
              </button>

              <button
                onClick={refreshWorkflows}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cx("h-4 w-4", wfLoading && "animate-spin")} />
                Refresh
              </button>

              {/* Canvas controls: Undo, Redo, Zoom, Grid, Lock */}
              <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                <button
                  onClick={undo}
                  disabled={!activeDraftId || undoStack.length === 0}
                  className={cx(
                    "h-9 w-9 rounded-full border border-white/10 grid place-items-center transition-colors",
                    activeDraftId && undoStack.length > 0
                      ? "bg-white/5 text-white/85 hover:bg-white/10"
                      : "bg-white/5 text-white/40 cursor-not-allowed"
                  )}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={redo}
                  disabled={!activeDraftId || redoStack.length === 0}
                  className={cx(
                    "h-9 w-9 rounded-full border border-white/10 grid place-items-center transition-colors",
                    activeDraftId && redoStack.length > 0
                      ? "bg-white/5 text-white/85 hover:bg-white/10"
                      : "bg-white/5 text-white/40 cursor-not-allowed"
                  )}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => beRef.current?.zoomOut?.()}
                  title="Zoom out (−)"
                  className="h-9 w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors"
                >
                  <ZoomOut className="h-4 w-4 text-white/80" />
                </button>
                <button
                  onClick={() => beRef.current?.zoomIn?.()}
                  title="Zoom in (+)"
                  className="h-9 w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors"
                >
                  <ZoomIn className="h-4 w-4 text-white/80" />
                </button>
                <button
                  onClick={() => {
                    beRef.current?.toggleGrid?.();
                    setTimeout(() => {
                      setShowGrid(beRef.current?.getShowGrid?.() ?? true);
                    }, 0);
                  }}
                  title={`Toggle grid (G) – ${showGrid ? "On" : "Off"}`}
                  className={cx(
                    "h-9 w-9 rounded-full border border-white/10 grid place-items-center transition-colors",
                    showGrid
                      ? "bg-white/10 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    beRef.current?.toggleLock?.();
                    setTimeout(() => {
                      setLocked(beRef.current?.getLocked?.() ?? false);
                    }, 0);
                  }}
                  title={`Toggle lock (L) – ${locked ? "Locked" : "Free"}`}
                  className={cx(
                    "h-9 w-9 rounded-full border border-white/10 grid place-items-center transition-colors",
                    locked
                      ? "bg-white/10 text-white"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  )}
                >
                  {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => {
                    beRef.current?.fullscreen?.();
                    setTimeout(() => {
                      setIsFullscreen(beRef.current?.getIsFullscreen?.() ?? false);
                    }, 0);
                  }}
                  title="Toggle fullscreen (F)"
                  className="h-9 w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4 text-white/80" /> : <Maximize2 className="h-4 w-4 text-white/80" />}
                </button>
              </div>

              <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                <button
                  className={cx(
                    "h-9 w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors",
                    windows.blocks.visible && "ring-2 ring-white/10"
                  )}
                  title="Toggle Blocks"
                  onClick={() => toggleWindow("blocks")}
                >
                  <Plus className="h-4 w-4 text-white/80" />
                </button>
                <button
                  className={cx(
                    "h-9 w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors",
                    windows.inspector.visible && "ring-2 ring-white/10"
                  )}
                  title="Toggle Inspector"
                  onClick={() => toggleWindow("inspector")}
                >
                  <LayoutPanelLeft className="h-4 w-4 text-white/80" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating windows container - positioned relative to viewport */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        {/* Floating window: Blocks (hidden in preview) */}
        {!isPreview && windows.blocks.visible && (
          <FloatingWindow
            title="Blocks"
            state={windows.blocks}
            onMove={startDrag("blocks", "move")}
            onMinimize={() => minimizeWindow("blocks")}
            onClose={() => setWindows((p) => ({ ...p, blocks: { ...p.blocks, visible: false } }))}
            onResizeSE={startDrag("blocks", "resize-se")}
            onResizeSW={startDrag("blocks", "resize-sw")}
            onResizeE={startDrag("blocks", "resize-e")}
            onResizeS={startDrag("blocks", "resize-s")}
            onResizeW={startDrag("blocks", "resize-w")}
            onResizeN={startDrag("blocks", "resize-n")}
          >
            {!windows.blocks.minimized && (
              <div className="h-full">
                <BlockLibrary
                  onAdd={(specId: string) => {
                    emit("builder:addNode", { specId });
                  }}
                  onLoadQuickStart={createDraftFromQuickStart}
                />
              </div>
            )}
          </FloatingWindow>
        )}

        {/* Floating window: Inspector (hidden in preview) */}
        {!isPreview && windows.inspector.visible && (
          <FloatingWindow
            title="Inspector"
            state={windows.inspector}
            onMove={startDrag("inspector", "move")}
            onMinimize={() => minimizeWindow("inspector")}
            onClose={() => setWindows((p) => ({ ...p, inspector: { ...p.inspector, visible: false } }))}
            onResizeSE={startDrag("inspector", "resize-se")}
            onResizeSW={startDrag("inspector", "resize-sw")}
            onResizeE={startDrag("inspector", "resize-e")}
            onResizeS={startDrag("inspector", "resize-s")}
            onResizeW={startDrag("inspector", "resize-w")}
            onResizeN={startDrag("inspector", "resize-n")}
          >
            {!windows.inspector.minimized && (
              <div className="h-full">
                <InspectorPanel
                  selection={selection}
                  fieldHint={inspectorFieldHint}
                  workflowId={activeDraftId ?? undefined}
                  getLatestGraph={() => beRef.current?.getGraph?.() ?? null}
                  onUpdate={(nodeId, patch) => {
                    try {
                      beRef.current?.updateNodeConfig?.(nodeId, patch);
                      // Force graph change to trigger autosave
                      const graph = beRef.current?.getGraph?.();
                      if (graph) {
                        onGraphChange(graph);
                      }
                    } catch {}
                  }}
                />
              </div>
            )}
          </FloatingWindow>
        )}

      </div>

      {/* Validation banner - bottom, compact and expandable */}
      {canvasValidation && (canvasValidation.errors.length > 0 || canvasValidation.warnings.length > 0) && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 flex justify-center">
          <CanvasValidationBanner
            validation={canvasValidation}
            onFocusNode={onFocusValidationNode}
          />
        </div>
      )}

      {/* Premium Run Modal */}
      <PremiumWorkflowRunModal
        open={runModalOpen}
        onClose={() => {
          if (runState?.status !== "running" && runState?.phase !== "executing") {
            setRunModalOpen(false);
            setRunState(null);
            setRequiresApiKeys(null);
            autoExecuteTriggeredRef.current = false;
          }
        }}
        state={runState}
        onCancel={handleCancelRun}
        onRerun={handleRerun}
        onSubmitInputs={handleSubmitInputs}
        onBuyWorkflow={activeDraftId && previewOwnerHandle && previewEdgazeCode ? () => {
          router.push(`/${previewOwnerHandle}/${previewEdgazeCode}`);
        } : undefined}
        remainingDemoRuns={activeDraftId ? getRemainingDemoRunsSync(activeDraftId) : undefined}
        workflowId={activeDraftId || undefined}
        isBuilderTest={!isPreview}
        builderRunLimit={builderRunLimit ?? undefined}
        requiresApiKeys={requiresApiKeys ?? undefined}
      />

      {/* Publish modal (disabled in preview) */}
      {!isPreview && (
        <WorkflowPublishModal
          open={publishOpen}
          onClose={() => {
            setPublishOpen(false);
            setPublishWorkflowId(null);
          }}
          draft={publishDraftForModal}
          owner={{ name: "You", handle: undefined, avatarUrl: null }}
          onEnsureDraftSaved={ensureDraftSavedNow}
          onPublished={async () => {
            setPublishOpen(false);
            setPublishWorkflowId(null);
            setActiveDraftId(null);
            setShowLauncher(true);
            await refreshWorkflows();
          }}
        />
      )}

      {/* Desktop-only gating (only for edit mode, preview works on mobile) */}
      {!isDesktop && !isPreview && !previewParam && mounted && (
          <div className="absolute inset-0 z-[80]">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="w-[min(560px,92vw)] rounded-3xl border border-white/12 bg-white/[0.05] backdrop-blur-xl shadow-[0_30px_140px_rgba(0,0,0,0.75)] p-6">
                <div className="text-white text-lg font-semibold">Builder is desktop-only</div>
                <div className="mt-2 text-sm text-white/60 leading-relaxed">
                  Open the workflow builder on a larger screen (min {DESKTOP_MIN_W}px wide and {DESKTOP_MIN_H}px tall).
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-white text-black hover:bg-white/90 transition-colors"
                    onClick={() => router.push("/marketplace")}
                  >
                    Go to Marketplace <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm border border-white/12 bg-white/5 text-white/85 hover:bg-white/10 transition-colors"
                    onClick={() => refreshWorkflows()}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Confined Workflows launcher overlay (disabled in preview) */}
      {!isPreview && showLauncher && isDesktop && (
        <LauncherOverlay
          leftSafe={LEFT_RAIL_SAFE_PX}
          busy={wfLoading || creating}
          errorText={wfError}
          drafts={drafts}
          published={published}
          newOpen={newOpen}
          newTitle={newTitle}
          creating={creating}
          userId={userId}
          onSignIn={openSignIn}
          onToggleNew={() => setNewOpen((v) => !v)}
          onNewTitle={(v) => setNewTitle(v)}
          onCreate={() => void createDraft()}
          onCancelNew={() => {
            setNewOpen(false);
            setNewTitle("");
          }}
          onRefresh={() => void refreshWorkflows()}
          onOpenDraft={(id) => void openDraft(id)}
          onOpenPublished={(id) => void openPublishedAsDraft(id)}
        />
      )}
    </div>
  );
}


function LauncherOverlay({
  leftSafe,
  busy,
  errorText,
  drafts,
  published,
  newOpen,
  newTitle,
  creating,
  userId,
  onSignIn,
  onToggleNew,
  onNewTitle,
  onCreate,
  onCancelNew,
  onRefresh,
  onOpenDraft,
  onOpenPublished,
}: {
  leftSafe: number;
  busy: boolean;
  errorText: string | null;
  drafts: DraftRow[];
  published: DraftRow[];
  newOpen: boolean;
  newTitle: string;
  creating: boolean;
  userId: string | null;
  onSignIn: () => void;
  onToggleNew: () => void;
  onNewTitle: (v: string) => void;
  onCreate: () => void;
  onCancelNew: () => void;
  onRefresh: () => void;
  onOpenDraft: (id: string) => void;
  onOpenPublished: (id: string) => void;
}) {
  const continueItems = drafts;

  return (
    <div className="fixed top-0 bottom-0 right-0 z-[70] pointer-events-none" style={{ left: leftSafe }}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md pointer-events-none" />

      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
        <div
          className={cx(
            "w-[min(1180px,94vw)] h-[min(740px,90vh)] rounded-[28px]",
            "border border-gray-700/40 bg-black/90 backdrop-blur-2xl shadow-[0_40px_160px_rgba(0,0,0,0.9)] overflow-hidden",
            "pointer-events-auto",
            "transition-all duration-300 ease-out",
            "translate-y-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700/30 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-black/40 border border-gray-700/40 grid place-items-center overflow-hidden">
                <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[18px] font-semibold text-white tracking-tight">Workflows</div>
                <div className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  Drafts autosave while you edit. Published items open as a new draft copy.
                </div>
              </div>
            </div>

            <button
              onClick={onRefresh}
              className={cx(
                "inline-flex items-center gap-2 rounded-xl border border-gray-700/40 bg-black/40 px-4 py-2 text-[12px] text-gray-300 hover:bg-black/60 hover:text-white hover:border-gray-600/50 transition-all duration-200",
                busy && "opacity-50 cursor-not-allowed"
              )}
              disabled={busy}
              title="Refresh"
            >
              <RefreshCw className={cx("h-3.5 w-3.5", busy && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Body */}
          <div className="h-[calc(100%-80px)] grid grid-cols-12 gap-6 p-6 overflow-hidden">
            {/* Left rail */}
            <div className="col-span-12 md:col-span-4 overflow-auto pr-1">
              {!userId ? (
                <div className="w-full rounded-xl border border-gray-700/40 bg-black/40 p-5">
                  <div className="text-sm font-semibold text-white mb-2">Sign in to create workflows</div>
                  <div className="text-xs text-gray-400 mb-4">
                    Sign in to save your workflows and access them from anywhere.
                  </div>
                  <button
                    onClick={onSignIn}
                    className="w-full rounded-lg bg-white text-black px-4 py-2.5 text-sm font-semibold hover:bg-gray-100 transition-colors shadow-lg shadow-white/10"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <button
                  onClick={onToggleNew}
                  className="w-full rounded-xl border border-gray-700/40 bg-black/40 hover:bg-black/60 hover:border-gray-600/50 px-5 py-4 text-left transition-all duration-200 group"
                >
                  <div className="text-sm font-semibold text-white group-hover:text-white">New</div>
                  <div className="text-xs text-gray-400 mt-0.5 group-hover:text-gray-300">Start a new workflow</div>
                </button>
              )}

              {userId && newOpen ? (
                <div className="mt-4 rounded-xl border border-gray-700/40 bg-black/40 p-4 backdrop-blur-sm">
                  <div className="text-xs text-gray-400 mb-2 font-medium">Workflow name</div>
                  <input
                    className="w-full rounded-lg bg-black/60 border border-gray-700/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-600/50 focus:bg-black/80 transition-all duration-200"
                    value={newTitle}
                    onChange={(e) => onNewTitle(e.target.value)}
                    placeholder="e.g. hello-world"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      className={cx(
                        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200",
                        "bg-white text-black hover:bg-gray-100 shadow-lg shadow-white/10",
                        creating && "opacity-60 cursor-not-allowed"
                      )}
                      disabled={creating}
                      onClick={onCreate}
                    >
                      {creating ? "Creating…" : "Create"}
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm border border-gray-700/40 bg-black/40 text-gray-300 hover:bg-black/60 hover:text-white hover:border-gray-600/50 transition-all duration-200"
                      onClick={onCancelNew}
                      disabled={creating}
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {errorText && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-[12px] text-red-300/90 leading-relaxed backdrop-blur-sm">
                  {errorText}
                </div>
              )}

              <div className="mt-4 text-[12px] text-gray-400 leading-relaxed font-medium">
                Tip: open a draft to jump straight into the editor.
              </div>
            </div>

            {/* Right content */}
            <div className="col-span-12 md:col-span-8 overflow-auto pr-1">
              {!userId ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="text-lg font-semibold text-white mb-2">Sign in to view your workflows</div>
                  <div className="text-sm text-gray-400 mb-6 max-w-md">
                    Sign in to see your drafts and published workflows. Your workflows will be saved and accessible from any device.
                  </div>
                  <button
                    onClick={onSignIn}
                    className="inline-flex items-center gap-2 rounded-lg bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-gray-100 transition-colors shadow-lg shadow-white/10"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-sm font-semibold text-white mb-4 tracking-tight">Continue</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {continueItems.length === 0 ? (
                        <div className="text-sm text-gray-500">No drafts yet.</div>
                      ) : (
                        continueItems.map((w) => (
                          <WorkflowCard
                            key={w.id}
                            title={w.title}
                            meta={`Draft · ${countSummary(w.graph)}`}
                            graph={w.graph}
                            onClick={() => onOpenDraft(w.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="text-sm font-semibold text-white mb-4 tracking-tight">Your workflows</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {published.length === 0 ? (
                        <div className="text-sm text-gray-500">No published workflows yet.</div>
                      ) : (
                        published.map((w) => (
                          <WorkflowCard
                            key={w.id}
                            title={w.title}
                            meta={`Published · ${countSummary(w.graph)}`}
                            graph={w.graph}
                            onClick={() => onOpenPublished(w.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function countSummary(graph: any) {
  const g = normalizeGraph(graph);
  const n = g.nodes.length;
  const e = g.edges.length;
  return n === 0 && e === 0 ? "Empty" : `${n} nodes · ${e} edges`;
}

function WorkflowCard({
  title,
  meta,
  graph,
  onClick,
}: {
  title: string;
  meta: string;
  graph: any;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-xl border border-gray-700/40 bg-black/40 hover:bg-black/60 hover:border-gray-600/50 transition-all duration-200",
        "p-4 text-left shadow-[0_8px_32px_rgba(0,0,0,0.4)] group"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate group-hover:text-white transition-colors">{title}</div>
          <div className="mt-1 text-xs text-gray-400 group-hover:text-gray-300 transition-colors">{meta}</div>
        </div>

        <div className="shrink-0">
          <GraphPreviewSquare graph={graph} />
        </div>
      </div>
    </button>
  );
}

function GraphPreviewSquare({ graph }: { graph: any }) {
  const g = normalizeGraph(graph);
  const nodes = g.nodes.slice(0, 30);
  const edges = g.edges.slice(0, 60);

  const pts = nodes
    .map((n: any) => ({
      id: String(n.id),
      x: Number(n.position?.x ?? 0),
      y: Number(n.position?.y ?? 0),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  const byId = new Map(pts.map((p) => [p.id, p]));

  const bounds = pts.reduce(
    (acc, p) => {
      acc.minX = Math.min(acc.minX, p.x);
      acc.minY = Math.min(acc.minY, p.y);
      acc.maxX = Math.max(acc.maxX, p.x);
      acc.maxY = Math.max(acc.maxY, p.y);
      return acc;
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const hasPts = pts.length > 0 && Number.isFinite(bounds.minX);

  const pad = 18;
  const W = 140;
  const H = 140;

  const scaleX = hasPts ? (W - pad * 2) / Math.max(1, bounds.maxX - bounds.minX) : 1;
  const scaleY = hasPts ? (H - pad * 2) / Math.max(1, bounds.maxY - bounds.minY) : 1;
  const s = Math.min(scaleX, scaleY);

  const tx = hasPts ? pad - bounds.minX * s : pad;
  const ty = hasPts ? pad - bounds.minY * s : pad;

  const toScreen = (p: { x: number; y: number }) => ({ x: p.x * s + tx, y: p.y * s + ty });

  const lines = edges.flatMap((e: any) => {
    const a = byId.get(String(e.source));
    const b = byId.get(String(e.target));
    if (!a || !b) return [];
    const A = toScreen(a);
    const B = toScreen(b);
    return [{ x1: A.x, y1: A.y, x2: B.x, y2: B.y }];
  });

  return (
    <div className="h-[140px] w-[140px] rounded-xl border border-gray-700/40 bg-black/40 overflow-hidden backdrop-blur-sm">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <defs>
          <linearGradient id="edg-preview" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(34,211,238,0.85)" />
            <stop offset="1" stopColor="rgba(232,121,249,0.85)" />
          </linearGradient>
          <radialGradient id="bg" cx="50%" cy="35%" r="70%">
            <stop offset="0" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#bg)" />

        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="rgba(255,255,255,0.20)"
            strokeWidth="1.2"
          />
        ))}

        {pts.map((p) => {
          const P = toScreen(p);
          return <circle key={p.id} cx={P.x} cy={P.y} r="3.2" fill="url(#edg-preview)" />;
        })}

        {!hasPts && (
          <g>
            <rect x="24" y="32" width="92" height="76" rx="18" fill="rgba(255,255,255,0.06)" />
            <text x="70" y="78" textAnchor="middle" fill="rgba(255,255,255,0.40)" fontSize="12">
              Empty
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function FloatingWindow({
  title,
  state,
  children,
  onMove,
  onMinimize,
  onClose,
  onResizeSE,
  onResizeSW,
  onResizeE,
  onResizeS,
  onResizeW,
  onResizeN,
}: {
  title: string;
  state: WindowState;
  children: React.ReactNode;
  onMove: (e: React.MouseEvent) => void;
  onMinimize: () => void;
  onClose: () => void;
  onResizeSE: (e: React.MouseEvent) => void;
  onResizeSW: (e: React.MouseEvent) => void;
  onResizeE: (e: React.MouseEvent) => void;
  onResizeS: (e: React.MouseEvent) => void;
  onResizeW: (e: React.MouseEvent) => void;
  onResizeN: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{ left: state.x, top: state.y, width: state.width, height: state.minimized ? 56 : state.height }}
    >
      <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_24px_120px_rgba(0,0,0,0.65)] overflow-hidden">
        <div
          className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/20 cursor-grab active:cursor-grabbing"
          onMouseDown={onMove}
        >
          <div className="text-sm font-semibold text-white/90">{title}</div>
          <div className="flex items-center gap-2">
            <button
              className="h-8 w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onMinimize}
              title="Minimize"
            >
              <span className="block text-center leading-[28px]">–</span>
            </button>
            <button
              className="h-8 w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onClose}
              title="Close"
            >
              <span className="block text-center leading-[28px]">×</span>
            </button>
          </div>
        </div>

        {!state.minimized && <div className="h-[calc(100%-56px)]">{children}</div>}
      </div>

      {!state.minimized && (
        <>
          <div className="absolute right-0 top-3 bottom-3 w-2 cursor-e-resize" onMouseDown={onResizeE} />
          <div className="absolute left-0 top-3 bottom-3 w-2 cursor-w-resize" onMouseDown={onResizeW} />
          <div className="absolute top-0 left-3 right-3 h-2 cursor-n-resize" onMouseDown={onResizeN} />
          <div className="absolute bottom-0 left-3 right-3 h-2 cursor-s-resize" onMouseDown={onResizeS} />
          <div className="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize" onMouseDown={onResizeSE} />
          <div className="absolute left-0 bottom-0 h-4 w-4 cursor-sw-resize" onMouseDown={onResizeSW} />
        </>
      )}
    </div>
  );
}
