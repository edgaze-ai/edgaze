// src/app/library/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Edit3, ExternalLink, Layers, ShoppingBag } from "lucide-react";

import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../../components/auth/AuthContext";
import ProfileMenu from "../../components/auth/ProfileMenu";

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall" | "subscription" | "both" | null;

type PromptRow = {
  id: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_handle: string | null;
  type: "prompt" | "workflow" | null;
  edgaze_code: string | null;
  title: string | null;
  description: string | null;
  tags: string | null;
  thumbnail_url: string | null;
  visibility: Visibility | null;
  monetisation_mode: MonetisationMode;
  is_paid: boolean | null;
  price_usd: number | null;
  view_count: number | null;
  like_count: number | null;
};

type PurchaseRow = {
  id: string;
  prompt_id: string;
  buyer_id: string;
  created_at: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsFromName(name?: string | null) {
  if (!name) return "AK";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

type LibraryCardProps = {
  prompt: PromptRow;
  context: "created" | "purchased";
};

function LibraryCard({ prompt, context }: LibraryCardProps) {
  const router = useRouter();

  const isFree =
    prompt.monetisation_mode === "free" || prompt.is_paid === false;
  const priceLabel =
    isFree || prompt.price_usd == null
      ? isFree
        ? "Free"
        : "Paid"
      : `$${prompt.price_usd.toFixed(2)}`;

  const badgeLabel = prompt.type === "workflow" ? "Workflow" : "Prompt";

  const openListing = () => {
    if (!prompt.owner_handle || !prompt.edgaze_code) return;
    router.push(`/p/${prompt.owner_handle}/${prompt.edgaze_code}`);
  };

  const openEditor = () => {
    router.push(`/studio/prompt/${prompt.id}`);
  };

  return (
    <div className="flex flex-col rounded-3xl border border-white/12 bg-white/[0.03] p-4 text-sm shadow-[0_0_30px_rgba(15,23,42,0.7)]">
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-28 overflow-hidden rounded-2xl bg-slate-900/80">
          {prompt.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prompt.thumbnail_url}
              alt={prompt.title || "Thumbnail"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-white/55">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">
              {prompt.title || "Untitled"}
            </h3>
            <span className="rounded-full bg-cyan-400/20 px-2 py-[2px] text-[10px] font-medium text-cyan-200">
              {badgeLabel}
            </span>
          </div>

          <p className="line-clamp-2 text-xs text-white/65">
            {prompt.description || "No description yet."}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/55">
            {prompt.owner_handle && (
              <span className="inline-flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                  {initialsFromName(prompt.owner_name || prompt.owner_handle)}
                </span>
                <span>@{prompt.owner_handle}</span>
              </span>
            )}
            {prompt.edgaze_code && (
              <span className="rounded-full bg-white/5 px-2 py-[2px] text-[10px] text-white/70">
                /{prompt.edgaze_code}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-[11px]">
          <span className="text-xs font-semibold text-white/90">
            {priceLabel}
          </span>

          {context === "created" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-[2px] text-[10px] text-white/65">
              <Layers className="h-3 w-3" />
              Created
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-[2px] text-[10px] text-white/65">
              <ShoppingBag className="h-3 w-3" />
              Purchased
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex gap-3 text-white/55">
          <span>👁 {prompt.view_count ?? 0}</span>
          <span>♥ {prompt.like_count ?? 0}</span>
        </div>

        <div className="flex gap-2">
          {context === "created" && (
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-white hover:border-cyan-400 hover:text-cyan-200"
            >
              <Edit3 className="h-3 w-3" />
              Edit
            </button>
          )}

          <button
            type="button"
            onClick={openListing}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-3 py-1 text-[11px] font-semibold text-black shadow-[0_0_16px_rgba(56,189,248,0.9)]"
          >
            <ExternalLink className="h-3 w-3" />
            Open listing
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  // NEW AUTH SHAPE:
  // - userId: string | null
  // - requireAuth(): boolean
  const { userId, requireAuth } = useAuth();

  // Browser-only Supabase client (same pattern as your migrated pages)
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [activeTab, setActiveTab] = useState<"created" | "purchased">("created");
  const [created, setCreated] = useState<PromptRow[]>([]);
  const [purchased, setPurchased] = useState<PromptRow[]>([]);
  const [loadingCreated, setLoadingCreated] = useState(true);
  const [loadingPurchased, setLoadingPurchased] = useState(true);

  // Kick auth if not logged in
  useEffect(() => {
    if (!userId) requireAuth();
  }, [userId, requireAuth]);

  /* ----- LOAD CREATED ----- */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadCreated() {
      setLoadingCreated(true);

      const { data, error } = await supabase
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
            "view_count",
            "like_count",
          ].join(",")
        )
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.warn?.("Error loading created prompts", error);
        setCreated([]);
      } else {
        setCreated((data ?? []) as PromptRow[]);
      }

      setLoadingCreated(false);
    }

    loadCreated();

    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  /* ----- LOAD PURCHASED ----- */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadPurchased() {
      setLoadingPurchased(true);

      try {
        const { data: purchases, error: purchaseErr } = await supabase
          .from("prompt_purchases")
          .select("id, prompt_id, buyer_id, created_at")
          .eq("buyer_id", userId)
          .order("created_at", { ascending: false });

        if (cancelled) return;

        if (purchaseErr || !purchases || purchases.length === 0) {
          if (purchaseErr) console.warn?.("Error loading purchases", purchaseErr);
          setPurchased([]);
          setLoadingPurchased(false);
          return;
        }

        const promptIds = (purchases as PurchaseRow[]).map((p) => p.prompt_id);

        const { data: promptsData, error: promptErr } = await supabase
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
              "view_count",
              "like_count",
            ].join(",")
          )
          .in("id", promptIds);

        if (cancelled) return;

        if (promptErr) {
          console.warn?.("Error loading purchased prompts", promptErr);
          setPurchased([]);
        } else {
          const map = new Map(
            (promptsData ?? []).map((p) => [p.id as string, p as PromptRow])
          );
          const ordered: PromptRow[] = [];
          (purchases as PurchaseRow[]).forEach((p) => {
            const row = map.get(p.prompt_id);
            if (row) ordered.push(row);
          });
          setPurchased(ordered);
        }
      } catch (err) {
        console.warn?.("Unexpected error loading purchases", err);
        setPurchased([]);
      } finally {
        if (!cancelled) setLoadingPurchased(false);
      }
    }

    loadPurchased();

    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  const activeList = useMemo(
    () => (activeTab === "created" ? created : purchased),
    [activeTab, created, purchased]
  );

  const loading = activeTab === "created" ? loadingCreated : loadingPurchased;

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-8 pt-6 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Library</h1>
          <p className="text-sm text-white/55">
            Everything you&apos;ve created and purchased on Edgaze, in one place.
          </p>
        </div>
        <ProfileMenu />
      </header>

      <main className="flex-1 overflow-y-auto px-8 pb-10 pt-6">
        <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("created")}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5",
              activeTab === "created"
                ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black font-semibold shadow-[0_0_18px_rgba(56,189,248,0.8)]"
                : "text-white/65 hover:text-white"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            My creations
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("purchased")}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5",
              activeTab === "purchased"
                ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black font-semibold shadow-[0_0_18px_rgba(56,189,248,0.8)]"
                : "text-white/65 hover:text-white"
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Purchased
          </button>
        </div>

        {loading ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-sm text-white/60">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            Loading your library…
          </div>
        ) : activeList.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-6 text-sm text-white/65">
            {activeTab === "created" ? (
              <>
                You haven&apos;t created any listings yet. Build in Prompt Studio
                or Workflow Studio, publish to Edgaze, and your listings will show
                up here.
              </>
            ) : (
              <>
                You haven&apos;t purchased anything yet. When you buy prompts or
                workflows, they&apos;ll appear here for quick access.
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {activeList.map((p) => (
              <LibraryCard key={p.id} prompt={p} context={activeTab} />
            ))}
          </div>
        )}

        <p className="mt-6 text-[11px] text-white/40">
          Editing a creation from your library will update the live marketplace
          listing once you republish from Prompt Studio or Workflow Studio.
        </p>
      </main>
    </div>
  );
}
