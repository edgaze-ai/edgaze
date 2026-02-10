// src/app/library/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Edit3, ExternalLink, Layers, ShoppingBag, BookOpen, Zap, Sparkles, EyeOff } from "lucide-react";

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

  removed_at?: string | null;
  removed_reason?: string | null;
  removed_by?: string | null;
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

  removed_at?: string | null;
  removed_reason?: string | null;
  removed_by?: string | null;
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

  removed_at?: string | null;
  removed_reason?: string | null;
  removed_by?: string | null;
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
    removed_at: row.removed_at ?? null,
    removed_reason: row.removed_reason ?? null,
    removed_by: row.removed_by ?? null,
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
    removed_at: row.removed_at ?? null,
    removed_reason: row.removed_reason ?? null,
    removed_by: row.removed_by ?? null,
  };
}

type LibraryCardProps = {
  item: LibraryItem;
  context: "created" | "purchased";
  onEdit?: (kind: LibraryKind, id: string) => void;
  onRemoveSuccess?: () => void;
};

function LibraryCard({ item, context, onEdit, onRemoveSuccess }: LibraryCardProps) {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const [removing, setRemoving] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

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

  async function handleRemoveFromMarketplace(e: React.MouseEvent) {
    e.stopPropagation();
    setRemoveConfirmOpen(false);
    setRemoving(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/me/remove-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: item.kind, id: item.id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onRemoveSuccess?.();
      }
    } finally {
      setRemoving(false);
    }
  }

  const isRemoved = !!item.removed_at;
  const removedBannerText =
    item.removed_by === "owner"
      ? "Removed by owner"
      : item.removed_reason
        ? `Removed: ${item.removed_reason}`
        : "Removed from marketplace";

  return (
    <div
      onClick={openListing}
      className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-white/[0.01] backdrop-blur-sm transition-all duration-300 cursor-pointer hover:from-white/[0.06] hover:via-white/[0.03] hover:to-white/[0.02]"
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Content */}
      <div className="relative p-5 sm:p-6">
        {isRemoved && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <EyeOff className="h-4 w-4 shrink-0" />
            <span>{removedBannerText}</span>
          </div>
        )}
        {removeConfirmOpen && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/80 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-4 text-center shadow-xl">
              <p className="text-sm text-white/90">
                Remove this listing from the marketplace? You can still see it here as removed.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemoveConfirmOpen(false);
                  }}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFromMarketplace}
                  disabled={removing}
                  className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                >
                  {removing ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-4">
          {/* Thumbnail - larger and more prominent */}
          <div className="relative h-24 w-32 sm:h-28 sm:w-40 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/80 shrink-0 ring-1 ring-white/5 group-hover:ring-white/10 transition-all duration-300">
            {item.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={item.thumbnail_url} 
                alt={item.title || "Thumbnail"} 
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                  <div className="flex justify-center mb-1">
                  {item.kind === "workflow" ? (
                    <Zap className="h-8 w-8 text-white/30" />
                  ) : (
                    <Sparkles className="h-8 w-8 text-white/30" />
                  )}
                </div>
                  <div className="text-[10px] text-white/40">No image</div>
                </div>
              </div>
            )}
            {/* Badge overlay on thumbnail */}
            <div className="absolute top-2 left-2">
              <div className="rounded-lg bg-black/60 backdrop-blur-sm px-2 py-1 text-[10px] font-medium text-white/90">
                {badgeLabel}
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="min-w-0 flex-1 flex flex-col">
            {/* Title and price */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] sm:text-[16px] font-semibold text-white group-hover:text-white/90 transition-colors line-clamp-1">
                  {item.title || "Untitled"}
                </h3>
                {item.description && (
                  <p className="mt-1.5 text-[12px] sm:text-[13px] text-white/60 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
              
              {/* Price badge - more subtle */}
              <div
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-medium shrink-0",
                  isFree 
                    ? "bg-cyan-500/10 text-cyan-300/90" 
                    : "bg-fuchsia-500/10 text-fuchsia-300/90"
                )}
              >
                {priceLabel}
              </div>
            </div>

            {/* Stats and actions */}
            <div className="mt-auto pt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-[11px] text-white/50">
                {context === "created" && (
                  <>
                    <span className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      {item.views} views
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      {item.likes} likes
                    </span>
                  </>
                )}
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  {item.runs} runs
                </span>
              </div>

              {context === "created" && (
                <div className="flex items-center gap-2">
                  {!isRemoved && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRemoveConfirmOpen(true);
                      }}
                      disabled={removing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[11px] font-medium text-amber-200/90 hover:bg-amber-500/10 disabled:opacity-50"
                      title="Remove from marketplace"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Remove from marketplace
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(item.kind, item.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/80 transition-all duration-200 border border-white/5 hover:border-white/10"
                    title="Edit & republish"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hover indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-fuchsia-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [workflowDraft, setWorkflowDraft] = useState<any>(null);

  const [refreshNonce, setRefreshNonce] = useState(0);
  const triggerRefresh = () => setRefreshNonce((n) => n + 1);

  // Enable scrolling on library page - override body/html height restrictions
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    // Save original values
    const originalHtmlHeight = html.style.height;
    const originalHtmlOverflowY = html.style.overflowY;
    const originalBodyHeight = body.style.height;
    const originalBodyOverflowY = body.style.overflowY;
    
    // Check if mobile - use media query for reliability
    const checkAndSetScrolling = () => {
      // Use matchMedia for more reliable mobile detection (matches Tailwind sm breakpoint)
      const isMobile = window.matchMedia('(max-width: 639px)').matches;
      
      if (isMobile) {
        // Mobile: MUST allow natural scrolling - add class for CSS override
        html.classList.add('library-mobile-scroll');
        body.classList.add('library-mobile-scroll');
        
        // Also set inline styles as backup
        html.style.height = 'auto';
        html.style.minHeight = '100%';
        html.style.overflowY = 'auto';
        html.style.overflowX = 'hidden';
        
        body.style.height = 'auto';
        body.style.minHeight = '100%';
        body.style.overflowY = 'auto';
        body.style.overflowX = 'hidden';
      } else {
        // Desktop ONLY: lock height for independent section scrolling
        html.classList.remove('library-mobile-scroll');
        body.classList.remove('library-mobile-scroll');
        
        html.style.height = '100%';
        html.style.overflowY = 'hidden';
        html.style.overflowX = 'hidden';
        
        body.style.height = '100%';
        body.style.overflowY = 'hidden';
        body.style.overflowX = 'hidden';
      }
    };
    
    // Set immediately - run sync first, then async to ensure it applies
    checkAndSetScrolling();
    
    // Also run after a tiny delay to ensure it sticks
    setTimeout(() => {
      checkAndSetScrolling();
    }, 10);
    
    // Handle resize with media query listener for better reliability
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const handleMediaChange = () => {
      checkAndSetScrolling();
    };
    
    // Also listen to resize as fallback
    const handleResize = () => {
      checkAndSetScrolling();
    };
    
    // Use both media query listener and resize
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleMediaChange);
    }
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
      window.removeEventListener('resize', handleResize);
      // Remove classes
      html.classList.remove('library-mobile-scroll');
      body.classList.remove('library-mobile-scroll');
      // Restore
      html.style.height = originalHtmlHeight;
      html.style.overflowY = originalHtmlOverflowY;
      body.style.height = originalBodyHeight;
      body.style.overflowY = originalBodyOverflowY;
    };
  }, []);

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
                "removed_at",
                "removed_reason",
                "removed_by",
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
                "removed_at",
                "removed_reason",
                "removed_by",
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
                    "removed_at",
                    "removed_reason",
                    "removed_by",
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
                    "removed_at",
                    "removed_reason",
                    "removed_by",
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
      setEditingPromptId(row.id);
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
    <div className="min-h-screen bg-[#050505] text-white relative" data-library-page>
      {/* Premium background gradient */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[#050505]" />
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.08), transparent 50%), radial-gradient(circle at 80% 80%, rgba(232, 121, 249, 0.06), transparent 50%)',
          }}
        />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          {/* Mobile */}
          <div className="sm:hidden">
            <div className="text-[15px] font-semibold text-white mb-4">Library</div>

            {/* Toggle */}
            <div className="rounded-2xl bg-white/[0.03] p-1 border border-white/5">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setMobileTab("created")}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all duration-200",
                    mobileTab === "created" 
                      ? "bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 text-white shadow-lg shadow-cyan-500/10" 
                      : "text-white/60 hover:text-white/80"
                  )}
                >
                  Created
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab("purchased")}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all duration-200",
                    mobileTab === "purchased" 
                      ? "bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 text-white shadow-lg shadow-cyan-500/10" 
                      : "text-white/60 hover:text-white/80"
                  )}
                >
                  Purchased
                </button>
              </div>
            </div>
          </div>

          {/* Desktop+ */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-7 w-7" />
              <div className="min-w-0">
                <div className="text-[16px] font-semibold text-white">Library</div>
                <div className="text-[12px] text-white/50 truncate">Your created + purchased prompts & workflows</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/marketplace")}
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2 text-[12px] font-medium text-white/90 transition-all duration-200 border border-white/5 hover:border-white/10"
              >
                <ShoppingBag className="h-4 w-4" />
                Marketplace
              </button>
              <ProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        {/* Mobile: single column with tab - allow natural scrolling */}
        <div className="sm:hidden px-4 py-6 pb-20">
          {mobileTab === "created" ? (
            <section>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-white/90" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white/90">Created</div>
                  <div className="text-[11px] text-white/50">{created.length} items</div>
                </div>
              </div>

              <div className="space-y-3">
                {loadingCreated ? (
                  <div className="flex items-center justify-center gap-2 text-white/60 text-sm py-12">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading…
                  </div>
                ) : created.length === 0 ? (
                  <div className="rounded-3xl bg-white/[0.02] p-12 text-center">
                    <div className="flex justify-center mb-3">
                      <BookOpen className="h-12 w-12 text-white/50" />
                    </div>
                    <div className="text-sm text-white/60">No created items yet.</div>
                  </div>
                ) : (
                  created.map((item) => (
                    <LibraryCard key={`${item.kind}:${item.id}`} item={item} context="created" onEdit={openEdit} onRemoveSuccess={triggerRefresh} />
                  ))
                )}
              </div>
            </section>
          ) : (
            <section>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <ShoppingBag className="h-4 w-4 text-white/90" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white/90">Purchased</div>
                  <div className="text-[11px] text-white/50">{purchased.length} items</div>
                </div>
              </div>

              <div className="space-y-3">
                {loadingPurchased ? (
                  <div className="flex items-center justify-center gap-2 text-white/60 text-sm py-12">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading…
                  </div>
                ) : purchased.length === 0 ? (
                  <div className="rounded-3xl bg-white/[0.02] p-12 text-center">
                    <div className="flex justify-center mb-3">
                      <ShoppingBag className="h-12 w-12 text-white/50" />
                    </div>
                    <div className="text-sm text-white/60">No purchases yet.</div>
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

        {/* Desktop: full-width with independent scrolling zones */}
        <div className="hidden sm:flex h-[calc(100vh-73px)]">
          {/* Created section - scrollable */}
          <section className="flex-1 flex flex-col min-w-0 border-r border-white/5">
            <div className="px-6 lg:px-8 py-6 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-white/90" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white/90">Created</div>
                  <div className="text-[12px] text-white/50">{created.length} {created.length === 1 ? 'item' : 'items'}</div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
              <div className="space-y-4">
                {loadingCreated ? (
                  <div className="flex items-center justify-center gap-2 text-white/60 text-sm py-16">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading…
                  </div>
                ) : created.length === 0 ? (
                  <div className="rounded-3xl bg-white/[0.02] p-16 text-center">
                    <div className="flex justify-center mb-4">
                      <BookOpen className="h-14 w-14 text-white/50" />
                    </div>
                    <div className="text-sm text-white/60">No created items yet.</div>
                  </div>
                ) : (
                  created.map((item) => (
                    <LibraryCard key={`${item.kind}:${item.id}`} item={item} context="created" onEdit={openEdit} onRemoveSuccess={triggerRefresh} />
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Purchased section - scrollable */}
          <section className="w-[420px] lg:w-[480px] xl:w-[520px] flex flex-col min-w-0">
            <div className="px-6 lg:px-8 py-6 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-white/90" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white/90">Purchased</div>
                  <div className="text-[12px] text-white/50">{purchased.length} {purchased.length === 1 ? 'item' : 'items'}</div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
              <div className="space-y-4">
                {loadingPurchased ? (
                  <div className="flex items-center justify-center gap-2 text-white/60 text-sm py-16">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading…
                  </div>
                ) : purchased.length === 0 ? (
                  <div className="rounded-3xl bg-white/[0.02] p-12 text-center">
                    <div className="flex justify-center mb-3">
                      <ShoppingBag className="h-12 w-12 text-white/50" />
                    </div>
                    <div className="text-sm text-white/60">No purchases yet.</div>
                  </div>
                ) : (
                  purchased.map((item) => (
                    <LibraryCard key={`${item.kind}:${item.id}`} item={item} context="purchased" />
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* PROMPT EDIT -> PublishPromptModal */}
      {promptMeta ? (
        <PublishPromptModal
          open={promptModalOpen}
          onClose={() => {
            setPromptModalOpen(false);
            setEditingPromptId(null);
          }}
          meta={promptMeta}
          onMetaChange={(next: any) => setPromptMeta(next)}
          promptText={promptText}
          placeholders={promptPlaceholders}
          editId={editingPromptId}
          onPublished={() => {
            setPromptModalOpen(false);
            setEditingPromptId(null);
            triggerRefresh();
          }}
        />
      ) : null}

      {/* WORKFLOW EDIT -> WorkflowPublishModal */}
      <WorkflowPublishModal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        draft={workflowDraft}
        editId={workflowDraft?.id || null}
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
