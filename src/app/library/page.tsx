// src/app/library/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Edit3, ExternalLink, Layers, ShoppingBag } from "lucide-react";

import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../../components/auth/AuthContext";
import ProfileMenu from "../../components/auth/ProfileMenu";

import PublishPromptModal from "../../components/prompt-studio/PublishPromptModal";
import WorkflowPublishModal from "../../components/builder/WorkflowPublishModal";

type Visibility = "public" | "unlisted" | "private" | null;
type MonetisationMode = "free" | "paywall" | "subscription" | "both" | null;

type LibraryKind = "prompt" | "workflow";
type MobileTab = "created" | "purchased";

type PromptRowRaw = {
  id: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_handle: string | null;
  type: string | null;
  edgaze_code: string | null;
  title: string | null;
  description: string | null;
  tags: string | null;
  thumbnail_url: string | null;

  visibility: Visibility;
  monetisation_mode: MonetisationMode;
  is_paid: boolean | null;
  price_usd: number | null;

  views_count?: number | null;
  view_count?: number | null;
  likes_count?: number | null;
  like_count?: number | null;
  runs_count?: number | null;

  is_published?: boolean | null;
  is_public?: boolean | null;
  updated_at?: string | null;

  // edit-needed
  prompt_text?: string | null;
  placeholders?: any | null;
  demo_images?: any | null;
  output_demo_urls?: any | null;
};

type WorkflowRowRaw = {
  id: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_handle: string | null;
  type: string | null;
  edgaze_code: string | null;
  title: string | null;
  description: string | null;
  tags: string | null;
  thumbnail_url: string | null;

  monetisation_mode: MonetisationMode;
  is_paid: boolean | null;
  price_usd: number | null;

  views_count?: number | null;
  likes_count?: number | null;
  runs_count?: number | null;

  is_published?: boolean | null;
  is_public?: boolean | null;
  updated_at?: string | null;

  // edit-needed
  graph?: any | null;
  graph_json?: any | null;
  demo_images?: any | null;
  output_demo_urls?: any | null;
};

type PurchasePromptRow = {
  id: string;
  created_at: string;
  prompt_id: string;
  buyer_id: string;
  status?: string | null;
};

type PurchaseWorkflowRow = {
  id: string;
  created_at: string;
  workflow_id: string;
  buyer_id: string;
  status?: string | null;
};

type LibraryItem = {
  kind: LibraryKind;
  id: string;

  owner_id: string | null;
  owner_name: string | null;
  owner_handle: string | null;
  edgaze_code: string | null;

  title: string | null;
  description: string | null;
  tags: string | null;
  thumbnail_url: string | null;

  monetisation_mode: MonetisationMode;
  is_paid: boolean | null;
  price_usd: number | null;

  views: number;
  likes: number;
  runs: number;

  updated_at: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeCounts(row: any) {
  const views = Number(row?.views_count ?? row?.view_count ?? row?.views ?? 0) || 0;
  const likes = Number(row?.likes_count ?? row?.like_count ?? row?.likes ?? 0) || 0;
  const runs = Number(row?.runs_count ?? row?.runs ?? 0) || 0;
  return { views, likes, runs };
}

function normalizePrompt(row: PromptRowRaw): LibraryItem {
  const { views, likes, runs } = normalizeCounts(row);
  return {
    kind: "prompt",
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    owner_handle: row.owner_handle,
    edgaze_code: row.edgaze_code,
    title: row.title,
    description: row.description,
    tags: row.tags,
    thumbnail_url: row.thumbnail_url,
    monetisation_mode: row.monetisation_mode,
    is_paid: row.is_paid,
    price_usd: row.price_usd,
    views,
    likes,
    runs,
    updated_at: row.updated_at ?? null,
  };
}

function normalizeWorkflow(row: WorkflowRowRaw): LibraryItem {
  const { views, likes, runs } = normalizeCounts(row);
  return {
    kind: "workflow",
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    owner_handle: row.owner_handle,
    edgaze_code: row.edgaze_code,
    title: row.title,
    description: row.description,
    tags: row.tags,
    thumbnail_url: row.thumbnail_url,
    monetisation_mode: row.monetisation_mode,
    is_paid: row.is_paid,
    price_usd: row.price_usd,
    views,
    likes,
    runs,
    updated_at: row.updated_at ?? null,
  };
}

type LibraryCardProps = {
  item: LibraryItem;
  context: "created" | "purchased";
  onEdit?: (kind: LibraryKind, id: string) => void;
};

function LibraryCard({ item, context, onEdit }: LibraryCardProps) {
  const router = useRouter();

  const isFree = item.monetisation_mode === "free" || item.is_paid === false;
  const priceLabel =
    isFree || item.price_usd == null ? (isFree ? "Free" : "Paid") : `$${Number(item.price_usd).toFixed(2)}`;

  const badgeLabel = item.kind === "workflow" ? "Workflow" : "Prompt";

  const openListing = () => {
    if (!item.owner_handle || !item.edgaze_code) return;

    // FIX: workflows are /<handle>/<code>
    if (item.kind === "workflow") {
      router.push(`/${item.owner_handle}/${item.edgaze_code}`);
      return;
    }

    // prompts are /p/<handle>/<code>
    router.push(`/p/${item.owner_handle}/${item.edgaze_code}`);
  };

  return (
    <div className="flex flex-col rounded-3xl border border-white/12 bg-white/[0.03] p-3 sm:p-4 text-sm shadow-[0_0_30px_rgba(15,23,42,0.7)]">
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-24 sm:w-28 overflow-hidden rounded-2xl bg-slate-900/80 shrink-0">
          {item.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnail_url} alt={item.title || "Thumbnail"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-white/55">No image</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[10px] text-white/70">
                {badgeLabel}
              </div>
              <div
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px]",
                  isFree ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-50" : "border-pink-400/20 bg-pink-400/10 text-pink-50"
                )}
              >
                {priceLabel}
              </div>
            </div>

            {context === "created" ? (
              <button
                type="button"
                onClick={() => onEdit?.(item.kind, item.id)}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10"
                title="Edit & republish"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </button>
            ) : null}
          </div>

          <div className="mt-2 text-[13px] font-semibold text-white truncate">{item.title || "Untitled"}</div>
          <div className="mt-1 text-[11px] text-white/55 line-clamp-2">{item.description || ""}</div>

          <div className="mt-2 text-[11px] text-white/45">
            @{item.owner_handle} • {item.views} views • {item.likes} likes • {item.runs} runs
          </div>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={openListing}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[12px] font-semibold text-black hover:bg-white/90"
        >
          <ExternalLink className="h-4 w-4" />
          Open
        </button>
      </div>
    </div>
  );
}

function parsePlaceholders(raw: any): Array<{ name: string; question: string }> {
  if (!raw) return [];
  try {
    if (Array.isArray(raw)) {
      return raw
        .map((x) => ({
          name: String((x as any)?.name ?? "").trim(),
          question: String((x as any)?.question ?? "").trim(),
        }))
        .filter((x) => x.name && x.question);
    }
    if (typeof raw === "string") {
      const j = JSON.parse(raw);
      return parsePlaceholders(j);
    }
  } catch {
    // ignore
  }
  return [];
}

function isBadPurchaseStatus(status: string | null | undefined) {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return false; // keep null/empty
  // Only exclude obvious non-entitled states
  return (
    s === "failed" ||
    s === "canceled" ||
    s === "cancelled" ||
    s === "refunded" ||
    s === "void" ||
    s === "voided" ||
    s === "requires_payment_method" ||
    s === "requires_action"
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, profile } = useAuth();

  const [mobileTab, setMobileTab] = useState<MobileTab>("created");

  const [loadingCreated, setLoadingCreated] = useState(true);
  const [loadingPurchased, setLoadingPurchased] = useState(true);

  const [created, setCreated] = useState<LibraryItem[]>([]);
  const [purchased, setPurchased] = useState<LibraryItem[]>([]);

  const [promptRawById, setPromptRawById] = useState<Map<string, PromptRowRaw>>(new Map());
  const [workflowRawById, setWorkflowRawById] = useState<Map<string, WorkflowRowRaw>>(new Map());

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [promptMeta, setPromptMeta] = useState<any>(null);
  const [promptText, setPromptText] = useState<string>("");
  const [promptPlaceholders, setPromptPlaceholders] = useState<Array<{ name: string; question: string }>>([]);

  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [workflowDraft, setWorkflowDraft] = useState<any>(null);

  const [refreshNonce, setRefreshNonce] = useState(0);
  const triggerRefresh = () => setRefreshNonce((n) => n + 1);

  // Load CREATED
  useEffect(() => {
    let cancelled = false;

    async function loadCreated() {
      if (!userId) {
        setCreated([]);
        setPromptRawById(new Map());
        setWorkflowRawById(new Map());
        setLoadingCreated(false);
        return;
      }

      setLoadingCreated(true);

      try {
        const [promptsRes, workflowsRes] = await Promise.all([
          supabase
            .from("prompts")
            .select(
              [
                "id",
                "owner_id",
                "owner_name",
                "owner_handle",
                "type",
                "edgaze_code",
                "title",
                "description",
                "tags",
                "thumbnail_url",
                "visibility",
                "monetisation_mode",
                "is_paid",
                "price_usd",
                "views_count",
                "view_count",
                "likes_count",
                "like_count",
                "runs_count",
                "is_published",
                "is_public",
                "updated_at",
                "prompt_text",
                "placeholders",
                "demo_images",
                "output_demo_urls",
              ].join(",")
            )
            .eq("owner_id", userId)
            .order("updated_at", { ascending: false }),

          supabase
            .from("workflows")
            .select(
              [
                "id",
                "owner_id",
                "owner_name",
                "owner_handle",
                "type",
                "edgaze_code",
                "title",
                "description",
                "tags",
                "thumbnail_url",
                "monetisation_mode",
                "is_paid",
                "price_usd",
                "views_count",
                "likes_count",
                "runs_count",
                "is_published",
                "is_public",
                "updated_at",
                "graph",
                "graph_json",
                "demo_images",
                "output_demo_urls",
              ].join(",")
            )
            .eq("owner_id", userId)
            .order("updated_at", { ascending: false }),
        ]);

        if (cancelled) return;

        const promptRows = (promptsRes.data ?? []) as any[];
        const workflowRows = (workflowsRes.data ?? []) as any[];

        const pMap = new Map<string, PromptRowRaw>();
        for (const r of promptRows) pMap.set(r.id, r as PromptRowRaw);

        const wMap = new Map<string, WorkflowRowRaw>();
        for (const r of workflowRows) wMap.set(r.id, r as WorkflowRowRaw);

        setPromptRawById(pMap);
        setWorkflowRawById(wMap);

        const combined: LibraryItem[] = [
          ...promptRows.map((r) => normalizePrompt(r as PromptRowRaw)),
          ...workflowRows.map((r) => normalizeWorkflow(r as WorkflowRowRaw)),
        ].sort((a, b) => {
          const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return tb - ta;
        });

        setCreated(combined);
      } catch (e) {
        console.warn?.("Error loading created library", e);
        if (!cancelled) {
          setCreated([]);
          setPromptRawById(new Map());
          setWorkflowRawById(new Map());
        }
      } finally {
        if (!cancelled) setLoadingCreated(false);
      }
    }

    loadCreated();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase, refreshNonce]);

  // Load PURCHASED (FIXED)
  useEffect(() => {
    let cancelled = false;

    async function loadPurchased() {
      if (!userId) {
        setPurchased([]);
        setLoadingPurchased(false);
        return;
      }

      setLoadingPurchased(true);

      try {
        // IMPORTANT FIX:
        // Do NOT hard-filter status = "paid". Your new tables/provider can write different statuses or null.
        const [promptPurchasesRes, workflowPurchasesRes] = await Promise.all([
          supabase
            .from("prompt_purchases")
            .select("id, created_at, prompt_id, buyer_id, status")
            .eq("buyer_id", userId)
            .order("created_at", { ascending: false }),

          supabase
            .from("workflow_purchases")
            .select("id, created_at, workflow_id, buyer_id, status, provider, currency, price_usd, external_ref")
            .eq("buyer_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        if (cancelled) return;

        const promptPurchasesAll = (promptPurchasesRes.data ?? []) as PurchasePromptRow[];
        const workflowPurchasesAll = (workflowPurchasesRes.data ?? []) as PurchaseWorkflowRow[];

        // Keep “good or unknown” statuses, drop obvious bad ones
        const promptPurchases = promptPurchasesAll.filter((p) => !isBadPurchaseStatus(p.status));
        const workflowPurchases = workflowPurchasesAll.filter((w) => !isBadPurchaseStatus(w.status));

        const promptIds = Array.from(new Set(promptPurchases.map((p) => p.prompt_id).filter(Boolean)));
        const workflowIds = Array.from(new Set(workflowPurchases.map((w) => w.workflow_id).filter(Boolean)));

        const [promptsDataRes, workflowsDataRes] = await Promise.all([
          promptIds.length
            ? supabase
                .from("prompts")
                .select(
                  [
                    "id",
                    "owner_id",
                    "owner_name",
                    "owner_handle",
                    "type",
                    "edgaze_code",
                    "title",
                    "description",
                    "tags",
                    "thumbnail_url",
                    "visibility",
                    "monetisation_mode",
                    "is_paid",
                    "price_usd",
                    "views_count",
                    "view_count",
                    "likes_count",
                    "like_count",
                    "runs_count",
                    "updated_at",
                  ].join(",")
                )
                .in("id", promptIds)
            : (Promise.resolve({ data: [], error: null }) as any),

          workflowIds.length
            ? supabase
                .from("workflows")
                .select(
                  [
                    "id",
                    "owner_id",
                    "owner_name",
                    "owner_handle",
                    "type",
                    "edgaze_code",
                    "title",
                    "description",
                    "tags",
                    "thumbnail_url",
                    "monetisation_mode",
                    "is_paid",
                    "price_usd",
                    "views_count",
                    "likes_count",
                    "runs_count",
                    "updated_at",
                  ].join(",")
                )
                .in("id", workflowIds)
            : (Promise.resolve({ data: [], error: null }) as any),
        ]);

        if (cancelled) return;

        if (promptsDataRes.error) console.warn?.("Error loading purchased prompts", promptsDataRes.error);
        if (workflowsDataRes.error) console.warn?.("Error loading purchased workflows", workflowsDataRes.error);

        const promptMap = new Map<string, LibraryItem>(
          (promptsDataRes.data ?? []).map((r: any) => {
            const item = normalizePrompt(r as PromptRowRaw);
            return [item.id, item];
          })
        );

        const workflowMap = new Map<string, LibraryItem>(
          (workflowsDataRes.data ?? []).map((r: any) => {
            const item = normalizeWorkflow(r as WorkflowRowRaw);
            return [item.id, item];
          })
        );
        type PurchaseKey = { kind: LibraryKind; created_at: string; id: string };

        const combinedPurchases: PurchaseKey[] = [
          ...promptPurchases.map<PurchaseKey>((p) => ({
            kind: "prompt",
            created_at: p.created_at,
            id: p.prompt_id,
          })),
          ...workflowPurchases.map<PurchaseKey>((w) => ({
            kind: "workflow",
            created_at: w.created_at,
            id: w.workflow_id,
          })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        const ordered: LibraryItem[] = [];
        for (const p of combinedPurchases) {
          const item = p.kind === "prompt" ? promptMap.get(p.id) : workflowMap.get(p.id);
          if (item) ordered.push(item);
        }

        setPurchased(ordered);
      } catch (err) {
        console.warn?.("Unexpected error loading purchases", err);
        if (!cancelled) setPurchased([]);
      } finally {
        if (!cancelled) setLoadingPurchased(false);
      }
    }

    loadPurchased();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase, refreshNonce]);

  function openEdit(kind: LibraryKind, id: string) {
    if (kind === "prompt") {
      const row = promptRawById.get(id);
      if (!row) return;

      const ownerName = row.owner_name || profile?.full_name || "You";
      const ownerHandle = row.owner_handle || (profile as any)?.handle || "you";

      const meta = {
        name: row.title || "Untitled prompt",
        description: row.description || "",
        thumbnailUrl: row.thumbnail_url || "",
        tags: row.tags || "",
        visibility: (row.visibility || "public") as any,
        paid: row.monetisation_mode === "paywall" || row.is_paid === true,
        priceUsd: row.price_usd != null ? String(row.price_usd) : "2.99",
        demoImageUrls: Array.isArray(row.demo_images) ? row.demo_images : [],
        ownerName,
        ownerHandle,
        edgazeCode: row.edgaze_code || "",
      };

      setPromptMeta(meta);
      setPromptText(row.prompt_text || "");
      setPromptPlaceholders(parsePlaceholders(row.placeholders));
      setPromptModalOpen(true);
      return;
    }

    const row = workflowRawById.get(id);
    if (!row) return;

    setWorkflowDraft({
      id: row.id,
      title: row.title || "Untitled workflow",
      graph_json: row.graph_json ?? null,
      graph: row.graph ?? null,
      description: row.description || "",
      tags: row.tags || "",
      thumbnail_url: row.thumbnail_url || "",
      edgaze_code: row.edgaze_code || "",
      monetisation_mode: row.monetisation_mode,
      is_paid: row.is_paid,
      price_usd: row.price_usd,
      visibility: row.is_public === false ? "private" : "public",
    });

    setWorkflowModalOpen(true);
  }

  // FIX: must be `undefined` when absent (not null) and must match the modal's expected prop shape
  const ownerForWorkflowModal = useMemo<
    { name?: string; handle?: string; avatarUrl?: string | null } | undefined
  >(() => {
    if (!userId) return undefined;
    return {
      name: profile?.full_name || (profile as any)?.handle || "You",
      handle: (profile as any)?.handle || "you",
      avatarUrl: (profile as any)?.avatar_url || null,
    };
  }, [userId, profile]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Mobile header = only text + toggle */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050505]/80 backdrop-blur-md">
        <div className="px-4 sm:px-6 py-3">
          {/* Mobile */}
          <div className="sm:hidden">
            <div className="text-[14px] font-semibold text-white">Library</div>

            {/* BIG wide toggle */}
            <div className="mt-3 rounded-2xl border border-white/12 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setMobileTab("created")}
                className={cn(
                  "w-1/2 rounded-xl px-3 py-2 text-[12px] font-semibold transition",
                  mobileTab === "created" ? "bg-white text-black" : "text-white/75 hover:bg-white/5"
                )}
              >
                Created
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("purchased")}
                className={cn(
                  "w-1/2 rounded-xl px-3 py-2 text-[12px] font-semibold transition",
                  mobileTab === "purchased" ? "bg-white text-black" : "text-white/75 hover:bg-white/5"
                )}
              >
                Purchased
              </button>
            </div>
          </div>

          {/* Desktop+ */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-[26px] w-[26px]" />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-white">Library</div>
                <div className="text-[11px] text-white/45 truncate">Your created + purchased prompts & workflows</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/marketplace")}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/10"
              >
                <ShoppingBag className="h-4 w-4" />
                Marketplace
              </button>
              <ProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6">
        {/* Mobile: single column with tab */}
        <div className="sm:hidden">
          {mobileTab === "created" ? (
            <section>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-white/85">
                <Layers className="h-4 w-4" />
                Created
              </div>

              <div className="mt-3 space-y-4">
                {loadingCreated ? (
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : created.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
                    No created items yet.
                  </div>
                ) : (
                  created.map((item) => (
                    <LibraryCard key={`${item.kind}:${item.id}`} item={item} context="created" onEdit={openEdit} />
                  ))
                )}
              </div>
            </section>
          ) : (
            <section>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-white/85">
                <ShoppingBag className="h-4 w-4" />
                Purchased
              </div>

              <div className="mt-3 space-y-4">
                {loadingPurchased ? (
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : purchased.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
                    No purchases yet.
                  </div>
                ) : (
                  purchased.map((item) => (
                    <LibraryCard key={`${item.kind}:${item.id}`} item={item} context="purchased" />
                  ))
                )}
              </div>
            </section>
          )}
        </div>

        {/* Desktop: two columns */}
        <div className="hidden sm:grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-white/85">
              <Layers className="h-4 w-4" />
              Created
            </div>

            <div className="mt-3 space-y-4">
              {loadingCreated ? (
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : created.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
                  No created items yet.
                </div>
              ) : (
                created.map((item) => (
                  <LibraryCard key={`${item.kind}:${item.id}`} item={item} context="created" onEdit={openEdit} />
                ))
              )}
            </div>
          </section>

          <section className="lg:col-span-5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-white/85">
              <ShoppingBag className="h-4 w-4" />
              Purchased
            </div>

            <div className="mt-3 space-y-4">
              {loadingPurchased ? (
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : purchased.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
                  No purchases yet.
                </div>
              ) : (
                purchased.map((item) => (
                  <LibraryCard key={`${item.kind}:${item.id}`} item={item} context="purchased" />
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* PROMPT EDIT -> PublishPromptModal */}
      {promptMeta ? (
        <PublishPromptModal
          open={promptModalOpen}
          onClose={() => setPromptModalOpen(false)}
          meta={promptMeta}
          onMetaChange={(next: any) => setPromptMeta(next)}
          promptText={promptText}
          placeholders={promptPlaceholders}
          onPublished={() => {
            setPromptModalOpen(false);
            triggerRefresh();
          }}
        />
      ) : null}

      {/* WORKFLOW EDIT -> WorkflowPublishModal */}
      <WorkflowPublishModal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        draft={workflowDraft}
        owner={ownerForWorkflowModal}
        onEnsureDraftSaved={undefined}
        onPublished={() => {
          setWorkflowModalOpen(false);
          triggerRefresh();
        }}
      />
    </div>
  );
}
