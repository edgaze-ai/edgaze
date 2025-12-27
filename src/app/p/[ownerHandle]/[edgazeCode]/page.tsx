// src/app/p/[ownerHandle]/[edgazeCode]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Eye,
  Heart,
  Sparkles,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/browser";
import { useAuth } from "../../../../components/auth/AuthContext";
import CommentsSection from "../../../../components/marketplace/CommentsSection";

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall" | "subscription" | "both" | null;

type PromptListing = {
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
  prompt_text: string | null;
  demo_images: string[] | null;
  output_demo_urls: string[] | null;
  visibility: Visibility | null;
  monetisation_mode: MonetisationMode;
  is_paid: boolean | null;
  price_usd: number | null;
  view_count: number | null;
  like_count: number | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "AK";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function BlurredPreview({
  text,
  kind,
}: {
  text: string;
  kind: "prompt" | "workflow";
}) {
  const snippet =
    (text || (kind === "workflow" ? "EDGAZE WORKFLOW" : "EDGAZE PROMPT"))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32)
      .toUpperCase() ||
    (kind === "workflow" ? "EDGAZE WORKFLOW" : "EDGAZE PROMPT");

  const label = kind === "workflow" ? "WORKFLOW" : "PROMPT";

  return (
    <div className="relative h-32 w-full overflow-hidden rounded-3xl bg-slate-950/90">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="scale-[1.6] blur-2xl opacity-80">
          <div className="whitespace-nowrap text-5xl font-extrabold tracking-[0.35em] text-white/30">
            {snippet}
          </div>
        </div>
      </div>
      <div className="absolute inset-3 rounded-3xl border border-white/15 bg-slate-900/60 backdrop-blur-md" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-cyan-400/90 via-cyan-400/25 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-pink-500/90 via-pink-500/25 to-transparent" />
      <div className="relative flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] tracking-[0.15em] text-white/70">
            {label}
          </div>
          <div className="text-xs text-white/55">
            The underlying {label.toLowerCase()} stays fully encrypted.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromptProductPage() {
  const params = useParams<{ ownerHandle: string; edgazeCode: string }>();
  const router = useRouter();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { requireAuth, userId, profile } = useAuth();

  const [listing, setListing] = useState<PromptListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainDemoIndex, setMainDemoIndex] = useState(0);

  const [suggestions, setSuggestions] = useState<PromptListing[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const ownerHandle = params?.ownerHandle;
  const edgazeCode = params?.edgazeCode;

  /* LOAD MAIN LISTING */
  useEffect(() => {
    if (!ownerHandle || !edgazeCode) return;

    let cancelled = false;

    async function load() {
      setLoading(true);

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
            "prompt_text",
            "demo_images",
            "output_demo_urls",
            "visibility",
            "monetisation_mode",
            "is_paid",
            "price_usd",
            "view_count",
            "like_count",
          ].join(",")
        )
        .eq("owner_handle", ownerHandle)
        .eq("edgaze_code", edgazeCode)
        .in("visibility", ["public", "unlisted"])
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Listing load error", error);
        setListing(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setListing(null);
        setLoading(false);
        return;
      }

      const record = data as PromptListing;
      setListing(record);
      setLoading(false);

      // fire-and-forget view increment
      supabase
        .from("prompts")
        .update({ view_count: (record.view_count ?? 0) + 1 })
        .eq("id", record.id)
        .then()
        .catch(() => {});
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [ownerHandle, edgazeCode, supabase]);

  /* LOAD SUGGESTIONS */
  useEffect(() => {
    if (!listing) return;

    let cancelled = false;

    async function loadSuggestions(current: PromptListing) {
      setSuggestionsLoading(true);

      const firstTag =
        (current.tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)[0] || null;

      const baseSelect = [
        "id",
        "owner_id",
        "owner_name",
        "owner_handle",
        "type",
        "edgaze_code",
        "title",
        "visibility",
        "monetisation_mode",
        "is_paid",
        "price_usd",
        "thumbnail_url",
        "tags",
        "view_count",
        "like_count",
      ].join(",");

      let primaryQuery = supabase
        .from("prompts")
        .select(baseSelect)
        .in("visibility", ["public", "unlisted"])
        .neq("id", current.id)
        .eq("type", current.type);

      if (firstTag) {
        primaryQuery = primaryQuery.ilike("tags", `%${firstTag}%`);
      }

      primaryQuery = primaryQuery
        .order("view_count", { ascending: false })
        .order("like_count", { ascending: false })
        .limit(30);

      const { data: primaryData, error: primaryError } = await primaryQuery;

      if (cancelled) return;

      if (primaryError) {
        console.error("Error loading primary suggestions", primaryError);
      }

      let combined: PromptListing[] = (primaryData ?? []) as PromptListing[];

      if (combined.length < 30) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("prompts")
          .select(baseSelect)
          .in("visibility", ["public", "unlisted"])
          .neq("id", current.id)
          .order("view_count", { ascending: false })
          .order("like_count", { ascending: false })
          .limit(60);

        if (!fallbackError && fallbackData) {
          const seen = new Set<string>(combined.map((p) => p.id));
          for (const row of fallbackData as PromptListing[]) {
            if (!seen.has(row.id)) {
              combined.push(row);
              seen.add(row.id);
            }
          }
        } else if (fallbackError) {
          console.error("Error loading fallback suggestions", fallbackError);
        }
      }

      if (cancelled) return;

      setSuggestions(combined);
      setSuggestionsLoading(false);
    }

    loadSuggestions(listing);

    return () => {
      cancelled = true;
    };
  }, [listing, supabase]);

  /* DEMO IMAGES */
  const demoImages: string[] = useMemo(() => {
    if (!listing) return [];
    if (Array.isArray(listing.demo_images) && listing.demo_images.length > 0) {
      return listing.demo_images;
    }
    if (
      Array.isArray(listing.output_demo_urls) &&
      listing.output_demo_urls.length > 0
    ) {
      return listing.output_demo_urls;
    }
    if (listing.thumbnail_url) return [listing.thumbnail_url];
    return [];
  }, [listing]);

  const activeDemo = demoImages[mainDemoIndex] || null;

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-[#050505] text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
          <p className="text-sm text-white/60">Loading listing…</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex h-full flex-col bg-[#050505] text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold">Listing not found</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:border-cyan-400 hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  const isFree = listing.monetisation_mode === "free" || listing.is_paid === false;
  const priceLabel = isFree
    ? "Free"
    : listing.price_usd != null
    ? `$${listing.price_usd.toFixed(2)}`
    : "Paid";

  const badgeLabel = listing.type === "workflow" ? "Workflow" : "Prompt";

  const currentUserId = userId ?? null;
  const currentUserName = profile?.full_name ?? null;
  const currentUserHandle = profile?.handle ?? null;

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      {/* Header / breadcrumb */}
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-cyan-400 hover:text-cyan-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Marketplace
          </button>
          <span className="text-xs text-white/40">
            edgaze.ai/@{listing.owner_handle}/{listing.edgaze_code}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-white/60">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">
            {initialsFromName(listing.owner_name || listing.owner_handle)}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-white/85">
              {listing.owner_name || "Creator"}
            </span>
            {listing.owner_handle && (
              <span className="text-[11px] text-white/50">
                @{listing.owner_handle}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-8 pb-10 pt-5">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,1.7fr)] items-stretch">
          {/* LEFT */}
          <div className="space-y-5">
            {/* Output demos */}
            <section className="rounded-3xl border border-white/12 bg-white/[0.02] px-4 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Output demos</h2>
                  <p className="text-xs text-white/55">
                    Visual examples of what this {badgeLabel.toLowerCase()} can generate.
                  </p>
                </div>
                {demoImages.length > 0 && (
                  <span className="text-[11px] text-white/45">
                    {demoImages.length} image{demoImages.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="relative h-56 w-full overflow-hidden rounded-3xl bg-black/60">
                  {activeDemo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeDemo}
                      alt={listing.title || "Demo image"}
                      className="h-full w-full cursor-pointer object-cover"
                      onClick={() => window.open(activeDemo, "_blank")}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-white/50">
                      No demo images yet. The creator can add previews from their dashboard.
                    </div>
                  )}

                  {demoImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setMainDemoIndex((prev) =>
                            prev === 0 ? demoImages.length - 1 : prev - 1
                          )
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/50 px-2 py-1 text-white hover:border-cyan-400"
                      >
                        {"<"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMainDemoIndex((prev) =>
                            prev === demoImages.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/50 px-2 py-1 text-white hover:border-cyan-400"
                      >
                        {">"}
                      </button>
                    </>
                  )}
                </div>

                {demoImages.length > 1 && (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
                    {demoImages.map((img, idx) => (
                      <button
                        key={img + idx}
                        type="button"
                        onClick={() => setMainDemoIndex(idx)}
                        className={cn(
                          "relative h-16 overflow-hidden rounded-2xl border border-white/20 bg-black/60",
                          idx === mainDemoIndex &&
                            "border-cyan-400 shadow-[0_0_16px_rgba(56,189,248,0.6)]"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Demo ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Listing + comments */}
            <section className="rounded-3xl border border-white/12 bg-white/[0.02] px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-cyan-400/20 px-2 py-[3px] text-[11px] font-medium text-cyan-200">
                  {badgeLabel}
                </span>
                {listing.edgaze_code && (
                  <span className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-2 py-[3px] text-[11px] font-semibold text-black shadow-[0_0_16px_rgba(56,189,248,0.7)]">
                    /{listing.edgaze_code}
                  </span>
                )}
              </div>

              <h1 className="mb-2 text-xl font-semibold">{listing.title || "Untitled listing"}</h1>
              <p className="text-sm text-white/75">{listing.description || "No description provided yet."}</p>

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                  {initialsFromName(listing.owner_name || listing.owner_handle)}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/90">
                    {listing.owner_name || "Creator"}
                  </span>
                  {listing.owner_handle && (
                    <span className="text-[11px] text-white/55">@{listing.owner_handle}</span>
                  )}
                </div>
              </div>

              {listing.tags && (
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/60">
                  {listing.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <span key={t} className="rounded-full bg-white/5 px-2 py-1">
                        #{t}
                      </span>
                    ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/70 md:grid-cols-4">
                <div>
                  <div className="text-[11px] text-white/45">Price</div>
                  <div className="mt-1 text-sm font-semibold">{priceLabel}</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/45">Visibility</div>
                  <div className="mt-1 text-sm font-semibold capitalize">{listing.visibility || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/45">Views</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-sm">
                    <Eye className="h-3.5 w-3.5" />
                    <span>{listing.view_count ?? 0}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-white/45">Likes</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-sm">
                    <Heart className="h-3.5 w-3.5" />
                    <span>{listing.like_count ?? 0}</span>
                  </div>
                </div>
              </div>

              <CommentsSection
                listingId={listing.id}
                listingOwnerId={listing.owner_id}
                listingOwnerName={listing.owner_name}
                listingOwnerHandle={listing.owner_handle}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserHandle={currentUserHandle}
                requireAuth={requireAuth}
              />
            </section>
          </div>

          {/* RIGHT */}
          <aside className="flex h-full flex-col">
            <section className="flex h-full flex-col rounded-3xl border border-white/12 bg-white/[0.03] px-5 py-5 shadow-[0_0_40px_rgba(15,23,42,0.8)]">
              <div>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold">Unlock this {badgeLabel.toLowerCase()}</h2>
                  <p className="text-xs text-white/55">
                    Built for creators who actually ship. Pay once, then run it from your Edgaze account.
                  </p>
                </div>

                <BlurredPreview
                  text={listing.prompt_text || listing.title || ""}
                  kind={listing.type === "workflow" ? "workflow" : "prompt"}
                />

                <div className="mt-5 flex items-baseline gap-2">
                  <div className="text-2xl font-semibold">
                    {priceLabel === "Free" ? "$0.00" : priceLabel}
                  </div>
                  {!isFree && <span className="text-xs text-white/55">one-time purchase</span>}
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!requireAuth()) return;
                      alert("Checkout flow is not wired yet in this build.");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_26px_rgba(56,189,248,0.9)]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Buy access
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!requireAuth()) return;
                      alert("Demo execution backend will be wired later. This button is a placeholder.");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-black/60 px-4 py-2.5 text-sm font-semibold text-white hover:border-cyan-400"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Try a one-time demo
                  </button>
                </div>

                <div className="mt-4 space-y-2 text-[11px] text-white/55">
                  <div className="flex items-start gap-2">
                    <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <p>Access is handled via a protected backend. Source prompts and workflows never load in your browser.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <p>Run it from your Edgaze account in your own projects.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <p>Support the creator directly through this purchase.</p>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/10 pt-3 text-[10px] text-white/45">
                  By buying or running a demo, you agree to Edgaze&apos;s usage guidelines and policies.
                </div>
              </div>

              <div className="mt-5 flex-1 border-t border-white/10 pt-4 min-h-[220px]">
                <h3 className="mb-3 text-xs font-semibold text-white/80">You might also like</h3>

                {suggestionsLoading ? (
                  <div className="flex items-center gap-2 text-[11px] text-white/60">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Loading similar listings…</span>
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="text-[11px] text-white/50">
                    More listings will appear here as creators publish them.
                  </p>
                ) : (
                  <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
                    {suggestions.map((s) => {
                      const suggestionFree = s.monetisation_mode === "free" || s.is_paid === false;
                      const href =
                        s.owner_handle && s.edgaze_code ? `/p/${s.owner_handle}/${s.edgaze_code}` : null;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!href}
                          onClick={() => href && router.push(href)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border border-white/14 bg-white/[0.03] px-3.5 py-3 text-left transition-colors hover:border-cyan-400/80 hover:bg-white/[0.06]",
                            !href && "cursor-not-allowed opacity-60"
                          )}
                        >
                          <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-900/80">
                            {s.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={s.thumbnail_url}
                                alt={s.title || "Listing thumbnail"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-white/40">
                                {s.type === "workflow" ? "Workflow" : "Prompt"}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-semibold text-white">
                                {s.title || "Untitled listing"}
                              </p>
                              <span className="text-[11px] font-semibold text-white/85">
                                {suggestionFree
                                  ? "Free"
                                  : s.price_usd != null
                                  ? `$${s.price_usd.toFixed(2)}`
                                  : "$—"}
                              </span>
                            </div>

                            <p className="mt-[2px] truncate text-[11px] text-white/55">
                              @{s.owner_handle || s.owner_name || "creator"}
                            </p>

                            {s.tags && (
                              <p className="mt-[2px] truncate text-[10px] text-white/40">
                                {s.tags
                                  .split(",")
                                  .map((t) => t.trim())
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((t) => `#${t}`)
                                  .join("  ")}
                              </p>
                            )}
                          </div>

                          <ExternalLink className="h-3.5 w-3.5 text-white/40" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
