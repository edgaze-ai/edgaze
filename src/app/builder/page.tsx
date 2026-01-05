// src/app/builder/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  LayoutPanelLeft,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  X,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "../../components/auth/AuthContext";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

import ReactFlowCanvas, {
  CanvasRef as BECanvasRef,
} from "../../components/builder/ReactFlowCanvas";
import BlockLibrary from "../../components/builder/BlockLibrary";
import InspectorPanel from "../../components/builder/InspectorPanel";
import RunModal from "../../components/builder/RunModal";
import WorkflowPublishModal from "../../components/builder/WorkflowPublishModal";

import { cx } from "../../lib/cx";
import { emit, on } from "../../lib/bus";

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

type DragType =
  | "move"
  | "resize-se"
  | "resize-sw"
  | "resize-e"
  | "resize-s"
  | "resize-w"
  | "resize-n";
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

const DESKTOP_MIN_W = 1100;
const DESKTOP_MIN_H = 680;

// If you have a left icon-rail sidebar, this keeps the launcher overlay from blocking it.
const LEFT_RAIL_SAFE_PX = 76;

export default function BuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, authReady, requireAuth } = useAuth();

  const beRef = useRef<BECanvasRef>(null);

  const [mounted, setMounted] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const isDesktop = viewport.w >= DESKTOP_MIN_W && viewport.h >= DESKTOP_MIN_H;

  const previewParam =
    searchParams?.get("preview") === "1" ||
    searchParams?.get("mode") === "preview";

  // workflow state
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled Workflow");
  const [editingName, setEditingName] = useState(false);

  // builder mode
  const [mode, setMode] = useState<BuilderMode>("edit");
  const isPreview = mode === "preview";

  // selection/stats
  const [selection, setSelection] = useState<Selection>({ nodeId: null });
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  // launcher overlay (confined: does NOT block sidebar)
  const [showLauncher, setShowLauncher] = useState(true);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);
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

  // publish modal
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishWorkflowId, setPublishWorkflowId] = useState<string | null>(null);

  // floating windows (default positions like your screenshot)
  const [windows, setWindows] = useState<Record<WindowKind, WindowState>>({
    blocks: {
      id: "blocks",
      x: 96,
      y: 110,
      width: 420,
      height: 640,
      visible: true,
      minimized: false,
    },
    inspector: {
      id: "inspector",
      x: 0, // snapped on mount
      y: 110,
      width: 420,
      height: 640,
      visible: true,
      minimized: false,
    },
  });
  const [drag, setDrag] = useState<DragState | null>(null);

  // run
  const [running, setRunning] = useState(false);

  // deep-link guard (prevents repeated opening)
  const openedWorkflowIdRef = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const measure = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // snap inspector to right on first mount (and keep it consistent)
  useEffect(() => {
    if (!mounted) return;
    setWindows((prev) => {
      const w = prev.inspector;
      const margin = 96;
      const x = Math.max(margin, window.innerWidth - w.width - margin);
      return { ...prev, inspector: { ...w, x } };
    });
  }, [mounted]);

  // stats polling (safe + cheap)
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      const g = beRef.current?.getGraph?.();
      if (!g) return;
      setStats({ nodes: g.nodes?.length ?? 0, edges: g.edges?.length ?? 0 });
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
    if (!isPreview) return;

    setEditingName(false);
    setWindows((p) => ({
      ...p,
      blocks: { ...p.blocks, visible: false, minimized: false },
      inspector: { ...p.inspector, visible: false, minimized: false },
    }));
  }, [mounted, isPreview]);

  // listen to publish intent (bus) — ignore in preview
  useEffect(() => {
    const off = on("builder:publish", (p: any) => {
      if (isPreview) return;
      const id = typeof p?.workflowId === "string" ? p.workflowId : null;
      if (!id) return;
      setPublishWorkflowId(id);
      setPublishOpen(true);
    });
    return off;
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

      const pubRows = Array.isArray(wfData)
        ? (wfData as any as DraftRow[])
        : [];
      setPublished(pubRows);
    } catch (e: any) {
      setDrafts([]);
      setPublished([]);
      setWfError(e?.message || "Failed to load workflows.");
    } finally {
      setWfLoading(false);
    }
  }, [authReady, userId, supabase]);

  useEffect(() => {
    if (!mounted) return;
    void refreshWorkflows();
  }, [mounted, refreshWorkflows]);

  const hashGraph = (g: { nodes: any[]; edges: any[] }) => {
    // low-cost stable hash: counts + ids + positions
    const ns = (g.nodes || [])
      .map(
        (n: any) =>
          `${n.id}:${Math.round(n.position?.x ?? 0)}:${Math.round(
            n.position?.y ?? 0
          )}`
      )
      .join("|");
    const es = (g.edges || [])
      .map(
        (e: any) =>
          `${e.id ?? ""}:${e.source ?? ""}->${e.target ?? ""}:${
            e.sourceHandle ?? ""
          }:${e.targetHandle ?? ""}`
      )
      .join("|");
    return `${g.nodes?.length ?? 0}/${g.edges?.length ?? 0}::${ns}::${es}`;
  };

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
      const update = {
        title: name || "Untitled Workflow",
        graph,
        updated_at: nowIso(),
      };

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
      // In preview: ignore any graph changes (even if canvas emits)
      if (isPreview) return;

      latestGraphRef.current = graph;

      // only autosave if a draft is open
      if (!activeDraftId) return;

      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => void doAutosave(), AUTOSAVE_MS);
    },
    [activeDraftId, doAutosave, isPreview]
  );

  const onSelectionChange = useCallback(
    (sel: any) => {
      if (isPreview) return; // preview: no inspector anyway
      setSelection({
        nodeId: typeof sel?.nodeId === "string" ? sel.nodeId : null,
        specId: typeof sel?.specId === "string" ? sel.specId : undefined,
        config: sel?.config ?? undefined,
      });
    },
    [isPreview]
  );

  const openDraft = useCallback(
    async (id: string) => {
      setWfError(null);
      if (!requireAuth()) return;
      if (!userId) return;

      setMode("edit");

      // close launcher immediately (prevents double-open feeling)
      setShowLauncher(false);

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
        beRef.current?.loadGraph?.(g);

        // set saved hash to avoid immediate “save storm”
        latestGraphRef.current = g;
        lastSavedHashRef.current = hashGraph(g);

        // mark last_opened_at (fire and forget)
        supabase
          .from("workflow_drafts")
          .update({ last_opened_at: nowIso() })
          .eq("id", row.id)
          .eq("owner_id", userId)
          .then(() => refreshWorkflows())
          .catch(() => {});
      } catch (e: any) {
        setWfError(e?.message || "Failed to open workflow.");
        setShowLauncher(true);
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, userId, supabase, refreshWorkflows]
  );

  // Opening a published workflow should not try to autosave into drafts (since it was deleted).
  // This creates a NEW draft copy and opens that.
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
          .insert({
            owner_id: userId,
            title: wfRow?.title || "Untitled Workflow",
            graph: g,
            last_opened_at: nowIso(),
          })
          .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
          .single();

        if (insErr) throw insErr;

        const row = created as DraftRow;

        setActiveDraftId(String(row.id));
        setName(row.title || "Untitled Workflow");
        setEditingName(false);

        beRef.current?.loadGraph?.(normalizeGraph(row.graph));

        latestGraphRef.current = normalizeGraph(row.graph);
        lastSavedHashRef.current = hashGraph(latestGraphRef.current);

        await refreshWorkflows();
      } catch (e: any) {
        setWfError(e?.message || "Failed to open published workflow.");
        setShowLauncher(true);
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, userId, supabase, refreshWorkflows]
  );

  // Marketplace deep-link (EDIT): /builder?workflowId=...
  // Access rule: owner OR workflow is free OR buyer has workflow_purchases row.
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
          .insert({
            owner_id: userId,
            title: wfRow?.title || "Untitled Workflow",
            graph: g,
            last_opened_at: nowIso(),
          })
          .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
          .single();

        if (insErr) throw insErr;

        const row = created as DraftRow;

        setActiveDraftId(String(row.id));
        setName(row.title || "Untitled Workflow");
        setEditingName(false);

        const loaded = normalizeGraph(row.graph);
        beRef.current?.loadGraph?.(loaded);

        latestGraphRef.current = loaded;
        lastSavedHashRef.current = hashGraph(loaded);

        await refreshWorkflows();
      } catch (e: any) {
        setWfError(e?.message || "Failed to open workflow.");
        setShowLauncher(true);
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, userId, supabase, refreshWorkflows]
  );

  // Marketplace deep-link (PREVIEW ONLY): /builder?workflowId=...&preview=1
  // Loads workflow directly without creating drafts, and hard-locks editor.
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
        setActiveDraftId(String(workflowId)); // run uses this id
        setName(wfRow?.title || "Untitled Workflow");
        setEditingName(false);

        beRef.current?.loadGraph?.(g);

        latestGraphRef.current = g;
        lastSavedHashRef.current = hashGraph(g);

        // force hide any editing windows
        setWindows((p) => ({
          ...p,
          blocks: { ...p.blocks, visible: false, minimized: false },
          inspector: { ...p.inspector, visible: false, minimized: false },
        }));
      } catch (e: any) {
        setWfError(e?.message || "Failed to open workflow.");
        setShowLauncher(true);
        setMode("edit");
      } finally {
        setWfLoading(false);
      }
    },
    [requireAuth, userId, supabase]
  );

  // Auto-open from URL param once auth is ready (desktop only)
  useEffect(() => {
    if (!mounted) return;
    if (!isDesktop) return;
    if (!authReady) return;

    const wid = searchParams?.get("workflowId");
    if (!wid) return;

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
        .insert({
          owner_id: userId,
          title,
          graph: emptyGraph,
          last_opened_at: nowIso(),
        })
        .select("id,owner_id,title,graph,created_at,updated_at,last_opened_at")
        .single();

      if (error) throw error;

      const row = data as DraftRow;

      setActiveDraftId(String(row.id));
      setName(row.title || "Untitled Workflow");
      setEditingName(false);

      const g = normalizeGraph(row.graph);
      beRef.current?.loadGraph?.(g);

      latestGraphRef.current = g;
      lastSavedHashRef.current = hashGraph(g);

      setShowLauncher(false);
      setNewOpen(false);
      setNewTitle("");
      await refreshWorkflows();
    } catch (e: any) {
      setWfError(e?.message || "Failed to create workflow.");
    } finally {
      setCreating(false);
    }
  }, [requireAuth, userId, supabase, newTitle, refreshWorkflows]);

  // ensure the latest graph/title is persisted right before publish
  const ensureDraftSavedNow = useCallback(async () => {
    if (isPreview) return;
    if (!userId || !activeDraftId) return;
    const g = beRef.current?.getGraph?.();
    if (!g) return;

    latestGraphRef.current = g;

    const update = {
      title: name || "Untitled Workflow",
      graph: g,
      updated_at: nowIso(),
    };

    await supabase
      .from("workflow_drafts")
      .update(update)
      .eq("id", activeDraftId)
      .eq("owner_id", userId);

    lastSavedHashRef.current = hashGraph(g);
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

        let next: WindowState = { ...w };

        if (drag.type === "move") {
          next.x = clamp(drag.startRect.x + dx, 12, window.innerWidth - 80);
          next.y = clamp(drag.startRect.y + dy, 12, window.innerHeight - 80);
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

  const startDrag = (id: WindowKind, type: DragType) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({
      id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startRect: windows[id],
    });
  };

  const toggleWindow = (id: WindowKind) => {
    if (isPreview) return;
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], visible: !prev[id].visible, minimized: false },
    }));
  };

  const minimizeWindow = (id: WindowKind) => {
    if (isPreview) return;
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], minimized: !prev[id].minimized },
    }));
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

  const runWorkflow = () => {
    setRunning(true);
    emit("builder:run", { workflowId: activeDraftId });
  };

  const publishWorkflow = () => {
    if (isPreview) return;
    emit("builder:publish", { workflowId: activeDraftId });
  };

  // If user is on small viewport, keep builder unavailable.
  useEffect(() => {
    if (!mounted) return;
    if (!isDesktop) {
      setRunning(false);
      setShowLauncher(false);
    }
  }, [mounted, isDesktop]);

  const publishDraftForModal =
    !isPreview &&
    publishWorkflowId &&
    publishWorkflowId === activeDraftId &&
    activeDraftId &&
    userId
      ? {
          id: activeDraftId,
          owner_id: userId,
          title: name || "Untitled Workflow",
          graph_json:
            latestGraphRef.current ??
            beRef.current?.getGraph?.() ??
            { nodes: [], edges: [] },
          graph:
            latestGraphRef.current ??
            beRef.current?.getGraph?.() ??
            { nodes: [], edges: [] },
          created_at: nowIso(),
          updated_at: nowIso(),
          last_opened_at: nowIso(),
        }
      : null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(255,255,255,0.08),transparent_60%),linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,0,0,0.75)_35%,rgba(0,0,0,0.92))]" />

      {/* Top bar (premium glass) */}
      <div className="relative z-20 px-5 pt-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_90px_rgba(0,0,0,0.5)] px-4 py-3 flex items-center justify-between transition-all duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center overflow-hidden">
              <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={24} height={24} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-widest text-white/50">
                  Workflow
                </div>

                {/* Always show alpha pill */}
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                  v1 Alpha preview
                </span>

                {isPreview && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                    Preview only
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 min-w-0">
                {!isPreview && !editingName ? (
                  <button
                    className="text-[18px] font-semibold text-white truncate hover:text-white/90 transition-colors"
                    onClick={() => setEditingName(true)}
                    title="Rename"
                  >
                    {name || "Untitled Workflow"}
                  </button>
                ) : isPreview ? (
                  <div className="text-[18px] font-semibold text-white truncate">
                    {name || "Untitled Workflow"}
                  </div>
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

          <div className="flex items-center gap-2">
            <button
              onClick={openLauncher}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
              title="Home"
            >
              Home
            </button>

            <button
              onClick={runWorkflow}
              disabled={!activeDraftId}
              className={cx(
                "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors",
                !activeDraftId && "opacity-60 cursor-not-allowed"
              )}
              title="Run"
            >
              <Play className="h-4 w-4" />
              Run
            </button>

            {/* Publish hidden in preview */}
            {!isPreview && (
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
            )}

            <button
              onClick={refreshWorkflows}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cx("h-4 w-4", wfLoading && "animate-spin")} />
              Refresh
            </button>

            {/* Block/Inspector toggles hidden in preview */}
            {!isPreview && (
              <div className="flex items-center gap-1 pl-2">
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
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative z-10 h-[calc(100dvh-92px)] w-full">
        <ReactFlowCanvas
          ref={beRef}
          onGraphChange={onGraphChange}
          onSelectionChange={onSelectionChange}
          readOnly={isPreview}
        />
      </div>

      {/* Floating window: Blocks (hidden in preview) */}
      {!isPreview && windows.blocks.visible && (
        <FloatingWindow
          title="Blocks"
          state={windows.blocks}
          onMove={startDrag("blocks", "move")}
          onMinimize={() => minimizeWindow("blocks")}
          onClose={() =>
            setWindows((p) => ({
              ...p,
              blocks: { ...p.blocks, visible: false },
            }))
          }
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
          onClose={() =>
            setWindows((p) => ({
              ...p,
              inspector: { ...p.inspector, visible: false },
            }))
          }
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
                workflowId={activeDraftId ?? undefined}
                onUpdate={(nodeId, patch) => {
                  try {
                    beRef.current?.updateNodeConfig?.(nodeId, patch);
                  } catch {}
                }}
              />
            </div>
          )}
        </FloatingWindow>
      )}

      {/* Run modal */}
      <RunModal
        open={running}
        onClose={() => setRunning(false)}
        workflowId={activeDraftId ?? undefined}
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
          owner={{
            name: "You",
            handle: undefined,
            avatarUrl: null,
          }}
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

      {/* Desktop-only gating */}
      {!isDesktop && mounted && (
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
    <div
      className="fixed top-0 bottom-0 right-0 z-[70] pointer-events-none"
      style={{
        left: leftSafe,
      }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md pointer-events-none" />

      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
        <div
          className={cx(
            "w-[min(1180px,94vw)] h-[min(740px,90vh)] rounded-[26px]",
            "border border-white/12 bg-black/55 shadow-[0_30px_140px_rgba(0,0,0,0.8)] overflow-hidden",
            "pointer-events-auto",
            "transition-transform duration-200",
            "translate-y-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-8 w-8" />
              <div className="text-[18px] font-semibold text-white">Workflows</div>
              <div className="text-[12px] text-white/45 ml-2">
                Drafts autosave while you edit. Published items open as a new draft copy.
              </div>
            </div>

            <button
              onClick={onRefresh}
              className={cx(
                "inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10 transition-colors",
                busy && "opacity-70 cursor-not-allowed"
              )}
              disabled={busy}
              title="Refresh"
            >
              <RefreshCw className={cx("h-4 w-4", busy && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Body */}
          <div className="h-[calc(100%-72px)] grid grid-cols-12 gap-6 p-6 overflow-hidden">
            {/* Left rail */}
            <div className="col-span-12 md:col-span-4 overflow-auto pr-1">
              <button
                onClick={onToggleNew}
                className="w-full rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 px-5 py-4 text-left transition-colors"
              >
                <div className="text-sm font-semibold text-white">New</div>
                <div className="text-xs text-white/55 mt-0.5">Start a new workflow</div>
              </button>

              {newOpen ? (
                <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4">
                  <div className="text-xs text-white/60 mb-2">Workflow name</div>
                  <input
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                    value={newTitle}
                    onChange={(e) => onNewTitle(e.target.value)}
                    placeholder="e.g. hello-world"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      className={cx(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                        "bg-white text-black hover:bg-white/90",
                        creating && "opacity-70 cursor-not-allowed"
                      )}
                      disabled={creating}
                      onClick={onCreate}
                    >
                      {creating ? "Creating…" : "Create"}
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm border border-white/12 bg-white/5 text-white/85 hover:bg-white/10 transition-colors"
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
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[12px] text-red-300 leading-relaxed">
                  {errorText}
                </div>
              )}

              <div className="mt-4 text-[12px] text-white/45 leading-relaxed">
                Tip: open a draft to jump straight into the editor.
              </div>
            </div>

            {/* Right content */}
            <div className="col-span-12 md:col-span-8 overflow-auto pr-1">
              <div>
                <div className="text-sm font-semibold text-white/90 mb-3">Continue</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {continueItems.length === 0 ? (
                    <div className="text-sm text-white/50">No drafts yet.</div>
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

              <div className="mt-7">
                <div className="text-sm font-semibold text-white/90 mb-3">Your workflows</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {published.length === 0 ? (
                    <div className="text-sm text-white/50">No published workflows yet.</div>
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
        "rounded-2xl border border-white/12 bg-black/35 hover:bg-black/25 transition-colors",
        "p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{title}</div>
          <div className="mt-1 text-xs text-white/55">{meta}</div>
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
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }
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

  const toScreen = (p: { x: number; y: number }) => ({
    x: p.x * s + tx,
    y: p.y * s + ty,
  });

  const lines = edges.flatMap((e: any) => {
    const a = byId.get(String(e.source));
    const b = byId.get(String(e.target));
    if (!a || !b) return [];
    const A = toScreen(a);
    const B = toScreen(b);
    return [{ x1: A.x, y1: A.y, x2: B.x, y2: B.y }];
  });

  return (
    <div className="h-[140px] w-[140px] rounded-2xl border border-white/12 bg-black/35 overflow-hidden">
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
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.2"
          />
        ))}

        {pts.map((p) => {
          const P = toScreen(p);
          return <circle key={p.id} cx={P.x} cy={P.y} r="3.2" fill="url(#edg-preview)" />;
        })}

        {!hasPts && (
          <g>
            <rect x="24" y="32" width="92" height="76" rx="18" fill="rgba(255,255,255,0.05)" />
            <text x="70" y="78" textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="12">
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
      className="absolute z-30"
      style={{
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.minimized ? 56 : state.height,
      }}
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
