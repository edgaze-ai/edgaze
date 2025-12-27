"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  Loader2,
  ChevronDown,
  LogOut,
  User,
  Heart,
} from "lucide-react";

import { useAuth } from "../../components/auth/AuthContext";
import { createSupabasePublicBrowserClient } from "../../lib/supabase/public";

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall" | "subscription" | "both" | null;

type MarketplacePrompt = {
  id: string;
  type: "prompt" | "workflow" | null;
  edgaze_code: string | null;
  title: string | null;
  description: string | null;
  prompt_text: string | null;
  thumbnail_url: string | null;

  owner_name: string | null;
  owner_handle: string | null;

  tags: string | null;
  visibility: Visibility | null;
  monetisation_mode: MonetisationMode;
  is_paid: boolean | null;
  price_usd: number | null;
  view_count: number | null;
  like_count: number | null;
  created_at?: string | null;
};

type CodeSuggestion = {
  id: string;
  owner_handle: string | null;
  edgaze_code: string | null;
  title: string | null;
  type: "prompt" | "workflow" | null;
};

type ProfileMini = {
  handle: string;
  full_name: string | null;
  avatar_url: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsFromName(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "EG";
  const parts = n.split(/\s+/);
  const a = parts[0]?.[0]?.toUpperCase() || "E";
  const b = parts[1]?.[0]?.toUpperCase() || (parts[0]?.[1]?.toUpperCase() || "G");
  return `${a}${b}`.slice(0, 2);
}

function clampText(s: string | null | undefined, max = 140) {
  const t = (s || "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max).trim()}…` : t;
}

function Avatar({
  name,
  url,
  size = 36,
  className,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const px = `${size}px`;
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]",
        className
      )}
      style={{ width: px, height: px }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/0 text-[11px] font-semibold text-white/80">
          {initialsFromName(name)}
        </div>
      )}
    </div>
  );
}

function BlurredPromptThumbnail({ text }: { text: string }) {
  const snippet =
    (text || "EDGAZE")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 28)
      .toUpperCase() || "EDGAZE";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950/80">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="scale-[1.35] blur-2xl opacity-80">
          <div className="whitespace-nowrap text-6xl font-extrabold tracking-[0.35em] text-white/25">
            {snippet}
          </div>
        </div>
      </div>

      <div className="absolute inset-3 rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur-md" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-cyan-400/55 via-cyan-400/8 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-pink-500/55 via-pink-500/8 to-transparent" />
    </div>
  );
}

function PromptCard({
  prompt,
  currentUserId,
  requireAuth,
  supabase,
  ownerProfiles,
}: {
  prompt: MarketplacePrompt;
  currentUserId: string | null;
  requireAuth: () => boolean;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  ownerProfiles: Record<string, ProfileMini | undefined>;
}) {
  const router = useRouter();
  const [likeCount, setLikeCount] = useState(prompt.like_count ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);

  const isFree = prompt.monetisation_mode === "free" || prompt.is_paid === false;

  const detailPath =
    prompt.edgaze_code && prompt.owner_handle
      ? `/p/${prompt.owner_handle}/${prompt.edgaze_code}`
      : undefined;

  const ownerHandleKey = (prompt.owner_handle || "").toLowerCase();
  const ownerProfile = ownerHandleKey ? ownerProfiles[ownerHandleKey] : undefined;

  const creatorName =
    ownerProfile?.full_name ||
    prompt.owner_name ||
    (prompt.owner_handle ? `@${prompt.owner_handle}` : "Unknown");

  const creatorHandle = prompt.owner_handle ? `@${prompt.owner_handle}` : "";

  const priceLabel = isFree
    ? "Free"
    : prompt.price_usd != null
    ? `$${prompt.price_usd.toFixed(2)}`
    : "Paid";

  const badgeLabel = prompt.type === "workflow" ? "Workflow" : "Prompt";
  const desc = clampText(prompt.description, 140);

  const handleCardClick = () => {
    if (!detailPath) return;
    router.push(detailPath);
  };

  const handleLikeClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.stopPropagation();
    if (!requireAuth()) return;
    if (!currentUserId) return;

    try {
      setLikeLoading(true);
      const next = (likeCount ?? 0) + 1;

      const { data } = await supabase
        .from("prompts")
        .update({ like_count: next })
        .eq("id", prompt.id)
        .select("like_count")
        .single();

      setLikeCount(data?.like_count ?? next);
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
      {/* Thumbnail (YouTube-style) */}
      <div className="relative overflow-hidden rounded-2xl">
        {prompt.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prompt.thumbnail_url}
            alt={prompt.title || "Listing thumbnail"}
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
        ) : (
          <BlurredPromptThumbnail text={prompt.prompt_text || prompt.title || "EDGAZE"} />
        )}

        {/* Top-right badge overlay */}
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-2">
          <span className="rounded-full border border-white/12 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur">
            {badgeLabel}
          </span>
          <span className="rounded-full border border-white/12 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur">
            {priceLabel}
          </span>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex gap-3">
        {/* Creator avatar should be next to name (always left, always visible) */}
        <Avatar
          name={creatorName}
          url={ownerProfile?.avatar_url || null}
          size={36}
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white/95">
            {prompt.title || "Untitled listing"}
          </h3>

          <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
            <span className="truncate">{creatorName}</span>
            {creatorHandle && <span className="shrink-0 text-white/35">{creatorHandle}</span>}
          </div>

          {desc && (
            <div className="mt-2 line-clamp-2 text-[12px] leading-snug text-white/55">
              {desc}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[11px] text-white/55">
            <div className="flex items-center gap-2">
              {prompt.edgaze_code ? (
                <span className="rounded-md bg-white/10 px-2 py-[3px] text-[10px] font-semibold text-white/85">
                  /{prompt.edgaze_code}
                </span>
              ) : (
                <span className="rounded-md bg-white/5 px-2 py-[3px] text-[10px] text-white/60">
                  No code
                </span>
              )}

              <span className="flex items-center gap-1">
                <span className="text-white/35">views</span>
                <span>{prompt.view_count ?? 0}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleLikeClick}
              disabled={likeLoading}
              className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-[4px] text-[11px] text-white/70 hover:border-pink-400 hover:text-pink-200"
            >
              {likeLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Heart className="h-3.5 w-3.5" />
              )}
              <span>{likeCount ?? 0}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function MarketplacePage() {
  const supabase = useMemo(() => createSupabasePublicBrowserClient(), []);
  const { requireAuth, userId, profile, openSignIn, signOut } = useAuth();
  const router = useRouter();

  // IMPORTANT: we never load the whole DB. This is hard-limited pagination.
  const PAGE_SIZE = 9;

  const [items, setItems] = useState<MarketplacePrompt[]>([]);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const [codeQuery, setCodeQuery] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeSuggestions, setCodeSuggestions] = useState<CodeSuggestion[]>([]);
  const [codeSugLoading, setCodeSugLoading] = useState(false);

  // owner handle -> mini profile
  const [ownerProfiles, setOwnerProfiles] = useState<Record<string, ProfileMini | undefined>>({});

  const [menuOpen, setMenuOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchOwnerProfiles = async (prompts: MarketplacePrompt[]) => {
    const handles = Array.from(
      new Set(
        (prompts || [])
          .map((p) => (p.owner_handle || "").toLowerCase())
          .filter(Boolean)
      )
    );

    const missing = handles.filter((h) => !ownerProfiles[h]);
    if (missing.length === 0) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("handle, full_name, avatar_url")
      .in("handle", missing)
      .limit(200);

    if (error) {
      console.error("profiles batch fetch failed", error);
      return;
    }

    const map: Record<string, ProfileMini> = {};
    (data || []).forEach((p: any) => {
      if (p?.handle) {
        map[String(p.handle).toLowerCase()] = {
          handle: String(p.handle),
          full_name: p.full_name ?? null,
          avatar_url: p.avatar_url ?? null,
        };
      }
    });

    setOwnerProfiles((prev) => ({ ...prev, ...map }));
  };

  const loadPage = async ({
    offset,
    replace,
  }: {
    offset: number;
    replace: boolean;
  }): Promise<boolean> => {
    try {
      const q = debouncedQuery;

      let builder = supabase
        .from("prompts")
        .select(
          [
            "id",
            "type",
            "edgaze_code",
            "title",
            "description",
            "prompt_text",
            "thumbnail_url",
            "owner_name",
            "owner_handle",
            "tags",
            "visibility",
            "monetisation_mode",
            "is_paid",
            "price_usd",
            "view_count",
            "like_count",
            "created_at",
          ].join(",")
        )
        .in("type", ["prompt", "workflow"])
        .in("visibility", ["public", "unlisted"])
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (q) {
        builder = builder.or(
          [
            `title.ilike.%${q}%`,
            `description.ilike.%${q}%`,
            `tags.ilike.%${q}%`,
            `owner_name.ilike.%${q}%`,
            `owner_handle.ilike.%${q}%`,
            `edgaze_code.ilike.%${q}%`,
          ].join(",")
        );
      }

      const { data, error } = await builder;

      if (error) {
        console.error("Marketplace load error", error);
        setErrorMsg("Failed to load marketplace. Refresh and try again.");
        return false;
      }

      const next = (data ?? []) as MarketplacePrompt[];
      setItems((prev) => (replace ? next : [...prev, ...next]));

      // fetch creator avatars immediately (batched)
      fetchOwnerProfiles(next).catch(() => {});

      const more = next.length === PAGE_SIZE;
      setHasMore(more);
      setCursor(offset + next.length);

      return more;
    } catch (err) {
      console.error("Marketplace unexpected load error", err);
      setErrorMsg("Failed to load marketplace. Refresh and try again.");
      return false;
    }
  };

  const resetAndLoad = async () => {
    setErrorMsg(null);
    setHasMore(true);
    setCursor(0);
    setItems([]);
    setLoadingFirst(true);

    const ok = await loadPage({ offset: 0, replace: true });
    setLoadingFirst(false);
    if (!ok) setHasMore(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await resetAndLoad();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;

    const obs = new IntersectionObserver(
      async (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (loadingFirst || loadingMore) return;
        if (!hasMore) return;

        setLoadingMore(true);
        const more = await loadPage({ offset: cursor, replace: false });
        setLoadingMore(false);
        if (!more) setHasMore(false);
      },
      // big rootMargin so it preloads before the user hits bottom
      { root: null, rootMargin: "900px 0px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, hasMore, loadingFirst, loadingMore]); // intentional

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (pillRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = codeQuery.trim().toLowerCase();

    (async () => {
      if (!q) {
        setCodeSuggestions([]);
        return;
      }

      setCodeSugLoading(true);
      try {
        const { data, error } = await supabase
          .from("prompts")
          .select("id, owner_handle, edgaze_code, title, type")
          .in("visibility", ["public", "unlisted"])
          .in("type", ["prompt", "workflow"])
          .or([`edgaze_code.ilike.%${q}%`, `owner_handle.ilike.%${q}%`].join(","))
          .order("created_at", { ascending: false })
          .limit(6);

        if (cancelled) return;

        if (error) {
          console.error("Code suggestions error", error);
          setCodeSuggestions([]);
          return;
        }

        const list = (data ?? []) as CodeSuggestion[];

        const filtered = list.filter((p) => {
          const h = (p.owner_handle ?? "").toLowerCase();
          const c = (p.edgaze_code ?? "").toLowerCase();
          const combo = h && c ? `${h}/${c}` : "";
          return c.includes(q) || h.includes(q) || (combo && combo.includes(q));
        });

        setCodeSuggestions(filtered.slice(0, 6));
      } finally {
        if (!cancelled) setCodeSugLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [codeQuery, supabase]);

  const handleCodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const qRaw = codeQuery.trim();
    if (!qRaw) return;

    let handlePart: string | null = null;
    let codePart: string | null = null;

    if (qRaw.includes("/")) {
      const [h, c] = qRaw.split("/");
      handlePart = h.replace(/^@/, "").trim() || null;
      codePart = c?.trim() || null;
    } else if (qRaw.startsWith("/")) {
      codePart = qRaw.slice(1).trim();
    } else {
      codePart = qRaw;
    }

    if (!codePart) return;

    setCodeSubmitting(true);
    try {
      let listing: CodeSuggestion | null = null;

      if (handlePart) {
        const { data } = await supabase
          .from("prompts")
          .select("id, owner_handle, edgaze_code, title, type")
          .eq("owner_handle", handlePart)
          .eq("edgaze_code", codePart)
          .in("visibility", ["public", "unlisted"])
          .maybeSingle();

        if (data) listing = data as CodeSuggestion;
      } else {
        const { data } = await supabase
          .from("prompts")
          .select("id, owner_handle, edgaze_code, title, type")
          .eq("edgaze_code", codePart)
          .in("visibility", ["public", "unlisted"])
          .order("created_at", { ascending: false })
          .limit(1);

        if (data && data.length > 0) listing = data[0] as CodeSuggestion;
      }

      if (!listing?.owner_handle || !listing?.edgaze_code) return;
      router.push(`/p/${listing.owner_handle}/${listing.edgaze_code}`);
    } finally {
      setCodeSubmitting(false);
    }
  };

  const topRight =
    userId && profile ? (
      <div className="relative">
        <button
          ref={pillRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
        >
          {/* IMPORTANT: do not show Edgaze mark as fallback avatar; show initials */}
          <Avatar
            name={profile.full_name || `@${profile.handle}` || "Profile"}
            url={profile.avatar_url || null}
            size={28}
          />
          <span className="max-w-[160px] truncate">
            {profile.full_name || `@${profile.handle}`}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
            {profile.plan || "Free"}
          </span>
          <ChevronDown className="h-4 w-4 text-white/50" />
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 mt-2 z-[80] w-52 overflow-hidden rounded-2xl border border-white/12 bg-black/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/profile");
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5"
            >
              <User className="h-4 w-4 text-white/60" />
              View profile
            </button>

            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false);
                await signOut();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5"
            >
              <LogOut className="h-4 w-4 text-white/60" />
              Sign out
            </button>
          </div>
        )}
      </div>
    ) : (
      <button
        type="button"
        onClick={openSignIn}
        className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_22px_rgba(56,189,248,0.55)]"
      >
        Sign in
      </button>
    );

  return (
    <>
      <div className="flex h-full flex-col bg-[#050505] text-white">
        {/* Top bar */}
        <header className="sticky top-0 z-[70] flex items-center justify-between border-b border-white/10 bg-[#050505]/80 backdrop-blur px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/5 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold">Marketplace</div>
              <div className="hidden text-xs text-white/55 sm:block">
                Find prompts and workflows.
              </div>
            </div>
          </div>

          <div className="mx-6 hidden max-w-2xl flex-1 md:block">
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">
              <Search className="h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Search listings, creators, tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">{topRight}</div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
          {/* Mobile search */}
          <div className="mb-4 md:hidden">
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">
              <Search className="h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              />
            </div>
          </div>

          {/* Edgaze Code bar (duller background) */}
          <section className="mb-6">
            <form
              onSubmit={handleCodeSubmit}
              className="relative w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-4 sm:px-6 sm:py-5 shadow-[0_0_40px_rgba(15,23,42,0.7)]"
            >
              <div className="pointer-events-none absolute inset-[1px] rounded-[23px] opacity-40 edgaze-gradient" />

              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="relative h-6 w-6 rounded-lg bg-black/60 p-[3px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/brand/edgaze-mark.png"
                        alt="Edgaze"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="text-sm font-semibold">Edgaze Codes</div>
                  </div>

                  <div className="hidden text-xs text-white/55 sm:block">
                    edgaze.ai/@handle/code
                  </div>
                </div>

                <div className="relative mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <div className="flex items-center rounded-full border border-white/25 bg-black/70 px-4 py-2 text-sm">
                      <span className="mr-1 text-[11px] text-white/45">edgaze.ai/@</span>
                      <input
                        type="text"
                        value={codeQuery}
                        onChange={(e) => setCodeQuery(e.target.value)}
                        placeholder="handle/code"
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                      />
                    </div>

                    {(codeSugLoading || codeSuggestions.length > 0) && (
                      <div className="absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl border border-white/12 bg-black/95 shadow-xl">
                        {codeSugLoading ? (
                          <div className="flex items-center gap-2 px-4 py-3 text-sm text-white/70">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching…
                          </div>
                        ) : (
                          <ul className="max-h-64 overflow-y-auto text-sm">
                            {codeSuggestions.map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!p.owner_handle || !p.edgaze_code) return;
                                    router.push(`/p/${p.owner_handle}/${p.edgaze_code}`);
                                  }}
                                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-white/85 hover:bg-white/5"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs text-white/55">@{p.owner_handle}</div>
                                    <div className="truncate text-sm font-medium">/{p.edgaze_code}</div>
                                  </div>
                                  <div className="shrink-0 text-[11px] text-white/45">
                                    {p.title || (p.type === "workflow" ? "Workflow" : "Prompt")}
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={codeSubmitting || !codeQuery.trim()}
                    className={cn(
                      "inline-flex items-center justify-center gap-1 rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_18px_rgba(56,189,248,0.55)]",
                      (codeSubmitting || !codeQuery.trim()) && "cursor-not-allowed opacity-70"
                    )}
                  >
                    {codeSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Opening…
                      </>
                    ) : (
                      <>
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </section>

          {errorMsg && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          {loadingFirst ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/5" />
                  <div className="mt-3 flex gap-3">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-white/5" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
                      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-white/5" />
                      <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-white/5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-white/60">No listings found.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <PromptCard
                    key={p.id}
                    prompt={p}
                    currentUserId={userId}
                    requireAuth={requireAuth}
                    supabase={supabase}
                    ownerProfiles={ownerProfiles}
                  />
                ))}
              </div>

              <div ref={sentinelRef} className="h-10" />

              {loadingMore && (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more…
                </div>
              )}

              {!hasMore && (
                <div className="mt-6 text-center text-xs text-white/45">You’re caught up.</div>
              )}
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        @keyframes edgazeFlow {
          0% {
            background-position: 0% 0%, 100% 0%;
          }
          25% {
            background-position: 20% 40%, 80% 15%;
          }
          50% {
            background-position: 40% 90%, 60% 10%;
          }
          75% {
            background-position: 10% 70%, 90% 85%;
          }
          100% {
            background-position: 0% 0%, 100% 0%;
          }
        }

        .edgaze-gradient {
          background-image: radial-gradient(
              circle at 0% 0%,
              rgba(56, 189, 248, 0.45),
              transparent 55%
            ),
            radial-gradient(
              circle at 100% 0%,
              rgba(236, 72, 153, 0.45),
              transparent 55%
            );
          background-size: 180% 180%, 180% 180%;
          background-repeat: no-repeat;
          animation: edgazeFlow 22s ease-in-out infinite;
          mix-blend-mode: screen;
        }
      `}</style>
    </>
  );
}
