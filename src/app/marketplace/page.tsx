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
  published_at?: string | null;
};

type CodeSuggestion = {
  id: string;
  owner_handle: string | null;
  edgaze_code: string | null;
  title: string | null;
  type: "prompt" | "workflow" | null;
  created_at?: string | null;
  thumbnail_url?: string | null;
};

type ProfileMini = {
  handle: string;
  full_name: string | null;
  avatar_url: string | null;
};

type ProfileSuggestion = {
  handle: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  runs_count: number | null;
  remixes_count: number | null;
};

type CursorState = {
  promptsOffset: number;
  workflowsOffset: number;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsFromName(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "EG";
  const parts = n.split(/\s+/);
  const a = parts[0]?.[0]?.toUpperCase() || "E";
  const b =
    parts[1]?.[0]?.toUpperCase() || (parts[0]?.[1]?.toUpperCase() || "G");
  return `${a}${b}`.slice(0, 2);
}

function clampText(s: string | null | undefined, max = 140) {
  const t = (s || "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max).trim()}…` : t;
}

function safeDateMs(s?: string | null) {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : 0;
}

function formatRelativeTime(iso: string | null | undefined) {
  const ms = safeDateMs(iso);
  if (!ms) return "—";
  const diff = ms - Date.now();
  const abs = Math.abs(diff);

  const rtf =
    typeof Intl !== "undefined" && (Intl as any).RelativeTimeFormat
      ? new Intl.RelativeTimeFormat("en", { numeric: "always" })
      : null;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  const pick = () => {
    if (abs < minute) return { v: Math.round(diff / 1000), u: "second" as const };
    if (abs < hour) return { v: Math.round(diff / minute), u: "minute" as const };
    if (abs < day) return { v: Math.round(diff / hour), u: "hour" as const };
    if (abs < month) return { v: Math.round(diff / day), u: "day" as const };
    if (abs < year) return { v: Math.round(diff / month), u: "month" as const };
    return { v: Math.round(diff / year), u: "year" as const };
  };

  const { v, u } = pick();
  if (rtf) return rtf.format(v, u);
  const n = Math.abs(v);
  const unit = n === 1 ? u : `${u}s`;
  return diff < 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
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

/* -----------------------------
   Marketplace algorithm layer
------------------------------ */

type MarketplaceEventName =
  | "impression"
  | "click_card"
  | "open_code"
  | "like"
  | "search"
  | "load_page";

type MarketplaceEvent = {
  name: MarketplaceEventName;
  ts: number;
  user_id: string | null;
  session_id: string;
  item_id?: string | null;
  item_type?: "prompt" | "workflow" | null;
  owner_handle?: string | null;
  tags?: string[] | null;
  meta?: Record<string, any> | null;
};

type MarketplaceUserProfile = {
  tag_w: Record<string, number>;
  creator_w: Record<string, number>;
  type_w: { prompt: number; workflow: number };
  prefers_free: number;
  last_ts: number;
  events_seen: number;
};

const LS_PROFILE_KEY = "eg_marketplace_profile_v1";
const LS_SESSION_KEY = "eg_marketplace_session_v1";
const LS_EVENTS_KEY = "eg_marketplace_events_v1";
const MAX_LOCAL_EVENTS = 500;

function nowMs() {
  return Date.now();
}

function getOrCreateSessionId() {
  if (typeof window === "undefined") return "server";
  const existing = window.sessionStorage.getItem(LS_SESSION_KEY);
  if (existing) return existing;
  const id = `ms_${Math.random().toString(16).slice(2)}_${Date.now().toString(
    16
  )}`;
  window.sessionStorage.setItem(LS_SESSION_KEY, id);
  return id;
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const t = String(raw).trim();
  if (!t) return [];
  if (t.startsWith("[") && t.endsWith("]")) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr))
        return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch {}
  }
  return t
    .split(/[,#\n]/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function safeLoadProfile(): MarketplaceUserProfile {
  if (typeof window === "undefined") {
    return {
      tag_w: {},
      creator_w: {},
      type_w: { prompt: 0, workflow: 0 },
      prefers_free: 0,
      last_ts: 0,
      events_seen: 0,
    };
  }
  try {
    const raw = window.localStorage.getItem(LS_PROFILE_KEY);
    if (!raw) throw new Error("no profile");
    const p = JSON.parse(raw);
    return {
      tag_w: (p?.tag_w && typeof p.tag_w === "object" ? p.tag_w : {}) as any,
      creator_w:
        (p?.creator_w && typeof p.creator_w === "object"
          ? p.creator_w
          : {}) as any,
      type_w: {
        prompt: Number(p?.type_w?.prompt ?? 0) || 0,
        workflow: Number(p?.type_w?.workflow ?? 0) || 0,
      },
      prefers_free: Number(p?.prefers_free ?? 0) || 0,
      last_ts: Number(p?.last_ts ?? 0) || 0,
      events_seen: Number(p?.events_seen ?? 0) || 0,
    };
  } catch {
    return {
      tag_w: {},
      creator_w: {},
      type_w: { prompt: 0, workflow: 0 },
      prefers_free: 0,
      last_ts: 0,
      events_seen: 0,
    };
  }
}

function saveProfile(p: MarketplaceUserProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(p));
  } catch {}
}

function pushLocalEvent(evt: MarketplaceEvent) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LS_EVENTS_KEY);
    const arr = raw ? (JSON.parse(raw) as MarketplaceEvent[]) : [];
    arr.push(evt);
    const trimmed =
      arr.length > MAX_LOCAL_EVENTS
        ? arr.slice(arr.length - MAX_LOCAL_EVENTS)
        : arr;
    window.localStorage.setItem(LS_EVENTS_KEY, JSON.stringify(trimmed));
  } catch {}
}

function applyEventToProfile(
  p: MarketplaceUserProfile,
  evt: MarketplaceEvent
): MarketplaceUserProfile {
  const out: MarketplaceUserProfile = {
    tag_w: { ...(p.tag_w || {}) },
    creator_w: { ...(p.creator_w || {}) },
    type_w: { prompt: p.type_w.prompt, workflow: p.type_w.workflow },
    prefers_free: p.prefers_free,
    last_ts: Math.max(p.last_ts, evt.ts),
    events_seen: (p.events_seen || 0) + 1,
  };

  const weight =
    evt.name === "like"
      ? 3.2
      : evt.name === "click_card"
      ? 2.0
      : evt.name === "open_code"
      ? 2.5
      : evt.name === "impression"
      ? 0.25
      : evt.name === "search"
      ? 0.4
      : 0.2;

  const type = (evt.item_type as any) === "workflow" ? "workflow" : "prompt";
  out.type_w[type] += weight * 0.15;

  const handle = (evt.owner_handle || "").toLowerCase();
  if (handle)
    out.creator_w[handle] = (out.creator_w[handle] || 0) + weight * 0.35;

  const tags = (evt.tags || [])
    .map((t) => String(t).toLowerCase())
    .filter(Boolean);
  for (const tag of tags) {
    out.tag_w[tag] = (out.tag_w[tag] || 0) + weight * 0.22;
  }

  const isFree = (evt.meta as any)?.is_free;
  if (typeof isFree === "boolean")
    out.prefers_free += isFree ? weight * 0.12 : -weight * 0.12;

  const DECAY = 0.995;
  if (out.events_seen % 40 === 0) {
    for (const k of Object.keys(out.tag_w)) out.tag_w[k] *= DECAY;
    for (const k of Object.keys(out.creator_w)) out.creator_w[k] *= DECAY;
    out.type_w.prompt *= DECAY;
    out.type_w.workflow *= DECAY;
    out.prefers_free *= DECAY;
  }

  return out;
}

function log1pSafe(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.log(1 + x);
}

function scoreItemForUser(
  item: MarketplacePrompt,
  profile: MarketplaceUserProfile,
  sessionSalt: string
) {
  const tags = parseTags(item.tags).map((t) => t.toLowerCase());
  const owner = (item.owner_handle || "").toLowerCase();
  const isWorkflow = item.type === "workflow";
  const isFree = item.monetisation_mode === "free" || item.is_paid === false;

  const ageDays = Math.max(
    0,
    (nowMs() - safeDateMs(item.created_at)) / (1000 * 60 * 60 * 24)
  );
  const recency = 1 / (1 + ageDays / 2.5);

  const popularity =
    0.12 * log1pSafe(item.view_count ?? 0) +
    0.22 * log1pSafe(item.like_count ?? 0);

  let affinity = 0;
  for (const t of tags) affinity += (profile.tag_w[t] || 0) * 0.035;
  if (owner) affinity += (profile.creator_w[owner] || 0) * 0.06;
  affinity += (isWorkflow ? profile.type_w.workflow : profile.type_w.prompt) * 0.18;

  const freePref = profile.prefers_free * (isFree ? 0.12 : -0.08);

  const stable = `${sessionSalt}|${item.id}|${item.type ?? ""}|${owner}|${
    item.edgaze_code ?? ""
  }`.toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < stable.length; i++) h = (h ^ stable.charCodeAt(i)) * 16777619;
  const noise = ((h >>> 0) % 1000) / 1000;
  const explore = (noise - 0.5) * 0.06;

  const qualityPenalty = item.title ? 0 : -0.12;

  return 0.52 * recency + popularity + affinity + freePref + explore + qualityPenalty;
}

function pickDiversifiedPage(
  pool: MarketplacePrompt[],
  pageSize: number,
  profile: MarketplaceUserProfile,
  sessionSalt: string
) {
  const scored = pool
    .map((it) => ({ it, s: scoreItemForUser(it, profile, sessionSalt) }))
    .sort((a, b) => b.s - a.s);

  const out: MarketplacePrompt[] = [];
  const used = new Set<string>();

  let lastType: "prompt" | "workflow" | null = null;
  let streak = 0;

  const ownerRecent: string[] = [];
  const ownerWindow = 6;

  const wantWorkflow =
    profile.type_w.workflow - profile.type_w.prompt > 0.35
      ? 1
      : profile.type_w.prompt - profile.type_w.workflow > 0.35
      ? 0
      : 0.5;

  const hardPreferMix = true;

  for (let i = 0; i < scored.length && out.length < pageSize; i++) {
    const cand = scored[i].it;
    const key = `${cand.type ?? "x"}:${cand.id}`;
    if (used.has(key)) continue;

    const type = cand.type === "workflow" ? "workflow" : "prompt";
    const owner = (cand.owner_handle || "").toLowerCase();

    if (owner && ownerRecent.includes(owner)) continue;
    if (hardPreferMix && lastType && lastType === type && streak >= 2) continue;

    if (hardPreferMix && out.length >= 2) {
      const hasBothInPool =
        pool.some((p) => p.type === "workflow") &&
        pool.some((p) => p.type !== "workflow");
      if (hasBothInPool && wantWorkflow !== 0.5) {
        const fracW =
          out.filter((x) => x.type === "workflow").length / Math.max(1, out.length);
        if (wantWorkflow === 1 && type !== "workflow" && fracW < 0.35) {
          if ((out.length + 1) % 3 !== 0) continue;
        }
        if (wantWorkflow === 0 && type === "workflow" && fracW > 0.65) {
          if ((out.length + 1) % 3 !== 0) continue;
        }
      }
    }

    out.push(cand);
    used.add(key);

    if (type === lastType) streak += 1;
    else {
      streak = 1;
      lastType = type;
    }

    if (owner) {
      ownerRecent.push(owner);
      while (ownerRecent.length > ownerWindow) ownerRecent.shift();
    }
  }

  if (out.length < pageSize) {
    for (const row of scored) {
      if (out.length >= pageSize) break;
      const cand = row.it;
      const key = `${cand.type ?? "x"}:${cand.id}`;
      if (used.has(key)) continue;
      out.push(cand);
      used.add(key);
    }
  }

  const selectedKeys = new Set(out.map((x) => `${x.type ?? "x"}:${x.id}`));
  const rest = scored
    .map((x) => x.it)
    .filter((x) => !selectedKeys.has(`${x.type ?? "x"}:${x.id}`));

  return { page: out, rest };
}

async function safeInsertAnalyticsEvent(
  supabase: ReturnType<typeof createSupabasePublicBrowserClient>,
  evt: MarketplaceEvent
) {
  try {
    const { error } = await supabase.from("marketplace_events").insert([
      {
        ts: new Date(evt.ts).toISOString(),
        user_id: evt.user_id,
        session_id: evt.session_id,
        name: evt.name,
        item_id: evt.item_id ?? null,
        item_type: evt.item_type ?? null,
        owner_handle: evt.owner_handle ?? null,
        tags: evt.tags ?? null,
        meta: evt.meta ?? null,
      },
    ]);
    if (error) {
      const msg = String((error as any)?.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("permission")) return;
      return;
    }
  } catch {}
}

/* -----------------------------
   Card
------------------------------ */

function PromptCard({
  prompt,
  currentUserId,
  requireAuth,
  supabase,
  ownerProfiles,
  onEvent,
}: {
  prompt: MarketplacePrompt;
  currentUserId: string | null;
  requireAuth: () => boolean;
  supabase: ReturnType<typeof createSupabasePublicBrowserClient>;
  ownerProfiles: Record<string, ProfileMini | undefined>;
  onEvent: (evt: Omit<MarketplaceEvent, "ts" | "session_id" | "user_id">) => void;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const didImpress = useRef(false);
  const [likeCount, setLikeCount] = useState(prompt.like_count ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);

  const isFree = prompt.monetisation_mode === "free" || prompt.is_paid === false;
  const publishedLabel = formatRelativeTime((prompt.published_at ?? prompt.created_at) ?? null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || didImpress.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (didImpress.current) return;
        didImpress.current = true;
        onEvent({
          name: "impression",
          item_id: prompt.id,
          item_type: prompt.type,
          owner_handle: prompt.owner_handle ?? null,
          tags: parseTags(prompt.tags),
          meta: { is_free: isFree },
        });
        obs.disconnect();
      },
      { root: null, rootMargin: "120px 0px", threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.id]);

  const detailPath =
  prompt.edgaze_code && prompt.owner_handle
    ? prompt.type === "workflow"
      ? `/${prompt.owner_handle}/${prompt.edgaze_code}`
      : `/p/${prompt.owner_handle}/${prompt.edgaze_code}`
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

  const badgeClass =
    prompt.type === "workflow"
      ? "border-pink-400/25 bg-pink-500/10 text-pink-100"
      : "border-cyan-300/25 bg-cyan-400/10 text-cyan-50";

  const badgeGlow =
    prompt.type === "workflow"
      ? "shadow-[0_0_18px_rgba(236,72,153,0.22)]"
      : "shadow-[0_0_18px_rgba(56,189,248,0.22)]";

  const handleCardClick = () => {
    if (!detailPath) return;
    onEvent({
      name: "click_card",
      item_id: prompt.id,
      item_type: prompt.type,
      owner_handle: prompt.owner_handle ?? null,
      tags: parseTags(prompt.tags),
      meta: { is_free: isFree },
    });
    router.push(detailPath);
  };

  const handleLikeClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.stopPropagation();
    if (!requireAuth()) return;
    if (!currentUserId) return;

    onEvent({
      name: "like",
      item_id: prompt.id,
      item_type: prompt.type,
      owner_handle: prompt.owner_handle ?? null,
      tags: parseTags(prompt.tags),
      meta: { is_free: isFree },
    });

    try {
      setLikeLoading(true);
      const next = (likeCount ?? 0) + 1;

      if (prompt.type === "workflow") {
        const { data } = await supabase
          .from("workflows")
          .update({ likes_count: next })
          .eq("id", prompt.id)
          .select("likes_count")
          .single();

        setLikeCount((data as any)?.likes_count ?? next);
      } else {
        const { data } = await supabase
          .from("prompts")
          .update({ likes_count: next })
          .eq("id", prompt.id)
          .select("likes_count")
          .single();

        setLikeCount((data as any)?.likes_count ?? next);
      }
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className="group w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
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

        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur",
              badgeClass,
              badgeGlow
            )}
          >
            {badgeLabel}
          </span>

          <span className="rounded-full border border-white/12 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur">
            {priceLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 flex gap-3">
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
            {creatorHandle && (
              <span className="shrink-0 text-white/35">{creatorHandle}</span>
            )}
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

              <span className="text-white/25">•</span>

              <span className="flex items-center gap-1">
                <span className="text-white/35">views</span>
                <span>{prompt.view_count ?? 0}</span>
              </span>

              <span className="text-white/25">•</span>

              <span className="truncate">{publishedLabel}</span>
            </div>

            <button
              type="button"
              onClick={handleLikeClick}
              disabled={likeLoading}
              className={cn(
                "flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-[4px] text-[11px] text-white/70 hover:border-white/25 hover:text-white/90",
                prompt.type === "workflow"
                  ? "hover:border-pink-400 hover:text-pink-200"
                  : "hover:border-cyan-300 hover:text-cyan-100"
              )}
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

/* -----------------------------
   Unified search predictor
------------------------------ */

type UnifiedSearchResult =
  | { kind: "prompt" | "workflow"; item: CodeSuggestion; score: number }
  | { kind: "profile"; item: ProfileSuggestion; score: number };

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function rankTextMatch(q: string, hay: string) {
  const Q = norm(q);
  const H = norm(hay);
  if (!Q || !H) return 0;
  if (H === Q) return 12;
  if (H.startsWith(Q)) return 9;
  if (H.includes(Q)) return 5;
  return 0;
}

function scoreSuggestion(q: string, s: UnifiedSearchResult) {
  const Q = norm(q);
  if (!Q) return 0;

  if (s.kind === "profile") {
    const p = s.item;
    const handle = norm(p.handle);
    const name = norm(p.full_name || "");
    const bio = norm(p.bio || "");

    let sc =
      rankTextMatch(Q, handle) * 2.2 +
      rankTextMatch(Q, name) * 1.6 +
      rankTextMatch(Q, bio) * 0.35;

    const pops =
      0.08 * log1pSafe(p.runs_count ?? 0) +
      0.1 * log1pSafe(p.remixes_count ?? 0);

    return sc + pops;
  }

  const it = s.item;
  const handle = norm(it.owner_handle || "");
  const code = norm(it.edgaze_code || "");
  const title = norm(it.title || "");

  let sc =
    rankTextMatch(Q, `${handle}/${code}`) * 2.4 +
    rankTextMatch(Q, code) * 2.2 +
    rankTextMatch(Q, handle) * 1.5 +
    rankTextMatch(Q, title) * 1.2;

  // light recency bias
  const age = Math.max(0, (nowMs() - safeDateMs(it.created_at)) / (1000 * 60 * 60 * 24));
  sc += 1 / (1 + age / 7);

  // small type separation: keep both present
  sc += s.kind === "workflow" ? 0.2 : 0.0;

  return sc;
}


type SearchBarProps = {
  compact?: boolean;
  query: string;
  setQuery: (v: string) => void;
  debouncedQuery: string;
  activeQuery: string;
  searchRefreshing: boolean;

  // Predictor state
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  predictOpen: boolean;
  setPredictOpen: (v: boolean) => void;
  predictLoading: boolean;
  predictResults: Array<{
    kind: "profile" | "prompt" | "workflow";
    item: any;
  }>;
  activePredictIndex: number;
  setActivePredictIndex: (fn: (i: number) => number) => void;
  setActivePredictIndexValue: (v: number) => void;

  handlePredictSelect: (r: { kind: "profile" | "prompt" | "workflow"; item: any }) => void;

  // refs/timers
  predictBoxRef: React.RefObject<HTMLDivElement>;
  predictBlurTimer: React.MutableRefObject<number | null>;
  inputRef: React.RefObject<HTMLInputElement>;
};

function MarketplaceSearchBar({
  compact,
  query,
  setQuery,
  debouncedQuery,
  activeQuery,
  searchRefreshing,
  searchFocused,
  setSearchFocused,
  predictOpen,
  setPredictOpen,
  predictLoading,
  predictResults,
  activePredictIndex,
  setActivePredictIndex,
  setActivePredictIndexValue,
  handlePredictSelect,
  predictBoxRef,
  predictBlurTimer,
  inputRef,
}: SearchBarProps) {
  const showPredict =
    searchFocused &&
    predictOpen &&
    query.trim().length > 0 &&
    (predictLoading || predictResults.length > 0);

  const firstProfileIdx = predictResults.findIndex((x) => x.kind === "profile");
  const firstWorkflowIdx = predictResults.findIndex((x) => x.kind === "workflow");
  const firstPromptIdx = predictResults.findIndex((x) => x.kind === "prompt");

  return (
    <div ref={predictBoxRef} className="relative z-[30]">
      <div
        className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm focus-within:border-white/35 focus-within:bg-white/[0.07]"
        onMouseDown={(e) => {
          // Focus input even when user clicks padding/icon. Do NOT steal focus when they click the actual input.
          if ((e.target as HTMLElement)?.tagName?.toLowerCase() === "input") return;
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <Search className="relative z-10 h-4 w-4 text-white/45" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search prompts, workflows, creators…"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setActivePredictIndexValue(-1);
            // YouTube-like: keep dropdown open while typing, never interrupt caret.
            setPredictOpen(true);
          }}
          onFocus={() => {
            if (predictBlurTimer.current) window.clearTimeout(predictBlurTimer.current);
            setSearchFocused(true);
            setPredictOpen(true);
          }}
          onBlur={() => {
            if (predictBlurTimer.current) window.clearTimeout(predictBlurTimer.current);
            predictBlurTimer.current = window.setTimeout(() => {
              setPredictOpen(false);
              setSearchFocused(false);
            }, 180);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setPredictOpen(false);
              setActivePredictIndexValue(-1);
              return;
            }

            if (e.key === "ArrowDown") {
              if (!showPredict || predictResults.length === 0) return;
              e.preventDefault();
              setPredictOpen(true);
              setActivePredictIndex((i) => {
                const next = i < 0 ? 0 : Math.min(i + 1, predictResults.length - 1);
                return next;
              });
              return;
            }

            if (e.key === "ArrowUp") {
              if (!showPredict || predictResults.length === 0) return;
              e.preventDefault();
              setActivePredictIndex((i) => Math.max(-1, i - 1));
              return;
            }

            if (e.key === "Enter") {
              if (
                showPredict &&
                activePredictIndex >= 0 &&
                activePredictIndex < predictResults.length
              ) {
                e.preventDefault();
                handlePredictSelect(predictResults[activePredictIndex]);
                setPredictOpen(false);
                setActivePredictIndexValue(-1);
                return;
              }
              // Keep caret; results refresh via debounce.
              setPredictOpen(false);
              setActivePredictIndexValue(-1);
            }
          }}
          className="relative z-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
        />

        {(searchRefreshing ||
          (query.trim().length > 0 && debouncedQuery !== activeQuery)) && (
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        )}
      </div>

      {showPredict && (
        <div
          className="predict-panel absolute left-0 right-0 top-full z-[40] mt-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0b0b10] shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="predict-top flex items-center justify-between gap-2 px-4 py-3">
            <div className="text-xs font-semibold text-white/80">Top matches</div>
            <div className="text-[10px] text-white/35">
              prompts • workflows • creators
            </div>
          </div>

          {predictLoading ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Predicting…
            </div>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto">
              {predictResults.map((r, idx) => {
                if (r.kind === "profile") {
                  const p = r.item as ProfileSuggestion;
                  return (
                    <React.Fragment key={`predict-${r.kind}-${p?.handle ?? "x"}-${idx}`}>
                      {idx === firstProfileIdx && (
                        <li
                          key={`hdr-profiles-${idx}`}
                          className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40"
                        >
                          Profiles
                        </li>
                      )}
                      <li key={`prof-${p.handle}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => handlePredictSelect(r)}
                          className={cn(
                            "group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5",
                            idx === activePredictIndex && "bg-white/10"
                          )}
                        >
                          <Avatar
                            name={p.full_name || `@${p.handle}` || "Creator"}
                            url={p.avatar_url || null}
                            size={26}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white/85">
                              {p.full_name || `@${p.handle}`}
                            </div>
                            <div className="truncate text-xs text-white/45">@{p.handle}</div>
                          </div>
                          <span className="rounded-full border border-white/12 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/70">
                            Creator
                          </span>
                        </button>
                      </li>
                    </React.Fragment>
                  );
                }

                if (r.kind === "workflow") {
                  const w = r.item as WorkflowSuggestion;
                  return (
                    <React.Fragment key={`predict-${r.kind}-${w?.id ?? "x"}-${idx}`}>
                      {idx === firstWorkflowIdx && (
                        <li
                          key={`hdr-workflows-${idx}`}
                          className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40"
                        >
                          Workflows
                        </li>
                      )}
                      <li key={`wf-${w.id}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => handlePredictSelect(r)}
                          className={cn(
                            "group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5",
                            idx === activePredictIndex && "bg-white/10"
                          )}
                        >
                          <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            {w.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={w.thumbnail_url}
                                alt={w.title || "Workflow"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-pink-500/20 via-fuchsia-500/10 to-cyan-400/10" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white/85">
                              {w.title || "Untitled workflow"}
                            </div>
                            <div className="truncate text-xs text-white/45">@{w.owner_handle}</div>
                          </div>

                          <span className="rounded-full border border-pink-400/25 bg-pink-500/10 px-2 py-1 text-[10px] font-semibold text-pink-100">
                            Workflow
                          </span>
                        </button>
                      </li>
                    </React.Fragment>
                  );
                }

                // prompt
                const p = r.item as PromptSuggestion;
                return (
                  <React.Fragment key={`predict-prompt-${p?.id ?? "x"}-${idx}`}>
                    {idx === firstPromptIdx && (
                      <li
                        key={`hdr-prompts-${idx}`}
                        className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40"
                      >
                        Prompts
                      </li>
                    )}
                    <li key={`pr-${p.id}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handlePredictSelect(r)}
                        className={cn(
                          "group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5",
                          idx === activePredictIndex && "bg-white/10"
                        )}
                      >
                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          {p.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.thumbnail_url}
                              alt={p.title || "Prompt"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-cyan-400/20 via-sky-500/10 to-fuchsia-500/10" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white/85">
                            {p.title || "Untitled prompt"}
                          </div>
                          <div className="truncate text-xs text-white/45">@{p.owner_handle}</div>
                        </div>

                        <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-50">
                          Prompt
                        </span>
                      </button>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  const supabase = useMemo(() => createSupabasePublicBrowserClient(), []);
  const { requireAuth, userId, profile, openSignIn, signOut } = useAuth();
  const router = useRouter();

  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [userProfile, setUserProfile] = useState<MarketplaceUserProfile>(() =>
    safeLoadProfile()
  );

  const emitEvent = useMemo(() => {
    return (evt: Omit<MarketplaceEvent, "ts" | "session_id" | "user_id">) => {
      const full: MarketplaceEvent = {
        ...evt,
        ts: nowMs(),
        session_id: sessionId,
        user_id: userId ?? null,
      };

      setUserProfile((prev) => {
        const next = applyEventToProfile(prev, full);
        saveProfile(next);
        return next;
      });

      pushLocalEvent(full);
      safeInsertAnalyticsEvent(supabase, full).catch(() => {});
    };
  }, [sessionId, supabase, userId]);

  const PAGE_SIZE = 9;

  const [items, setItems] = useState<MarketplacePrompt[]>([]);

  const dedupedItems = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((p) => {
      const k = `${p.type ?? "x"}-${p.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [items]);
  const [pending, setPending] = useState<MarketplacePrompt[]>([]);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<CursorState>({
    promptsOffset: 0,
    workflowsOffset: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // search input (unified across prompts/workflows/profiles)
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 220);
  
  const [activeQuery, setActiveQuery] = useState("");
const committedDebouncedQuery = useDebouncedValue(query.trim(), 3000);

  // predictor
  const [predictOpen, setPredictOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const predictBlurTimer = useRef<number | null>(null);
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictResults, setPredictResults] = useState<UnifiedSearchResult[]>([]);
  const predictDebounced = useDebouncedValue(query.trim(), 160);
  const predictBoxRef = useRef<HTMLDivElement | null>(null);

  const [activePredictIndex, setActivePredictIndex] = useState(-1);
  const searchRefreshing = query.trim().length > 0 && query.trim() !== activeQuery;

  useEffect(() => {
    if (!predictOpen) {
      setActivePredictIndex(-1);
      return;
    }
    // Clamp highlight if result size changes
    setActivePredictIndex((v) => {
      const max = predictResults.length - 1;
      if (max < 0) return -1;
      if (v < -1) return -1;
      if (v > max) return max;
      return v;
    });
  }, [predictOpen, predictResults.length]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRefMobile = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop) return;
    // Defer to ensure the input is mounted
    const id = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
const [codeQuery, setCodeQuery] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeSuggestions, setCodeSuggestions] = useState<CodeSuggestion[]>([]);
  const [codeSugLoading, setCodeSugLoading] = useState(false);

  const [ownerProfiles, setOwnerProfiles] = useState<
    Record<string, ProfileMini | undefined>
  >({});

  const [menuOpen, setMenuOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [sparkleOn, setSparkleOn] = useState(false);
  const sparkleTimer = useRef<number | null>(null);

  const burstSparkle = () => {
    setSparkleOn(true);
    if (sparkleTimer.current) window.clearTimeout(sparkleTimer.current);
    sparkleTimer.current = window.setTimeout(() => setSparkleOn(false), 850);
  };

  useEffect(() => {
    return () => {
      if (sparkleTimer.current) window.clearTimeout(sparkleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!committedDebouncedQuery) return;
    emitEvent({ name: "search", meta: { q: committedDebouncedQuery } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedDebouncedQuery]);

  // close predictor when clicking outside
  
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

  const fetchPrompts = async (offset: number, q: string) => {
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
          "views_count",
          "likes_count",
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
    if (error) throw error;

    const mapped: MarketplacePrompt[] = (data ?? []).map((p: any) => ({
      id: String(p.id),
      type: (p.type as any) ?? "prompt",
      edgaze_code: p.edgaze_code ?? null,
      title: p.title ?? null,
      description: p.description ?? null,
      prompt_text: p.prompt_text ?? null,
      thumbnail_url: p.thumbnail_url ?? null,
      owner_name: p.owner_name ?? null,
      owner_handle: p.owner_handle ?? null,
      tags: p.tags ?? null,
      visibility: (p.visibility as any) ?? null,
      monetisation_mode: (p.monetisation_mode as any) ?? null,
      is_paid: p.is_paid ?? null,
      price_usd: p.price_usd != null ? Number(p.price_usd) : null,
      view_count:
        p.views_count != null ? Number(p.views_count) : p.view_count != null ? Number(p.view_count) : null,
      like_count:
        p.likes_count != null ? Number(p.likes_count) : p.like_count != null ? Number(p.like_count) : null,
      created_at: p.created_at ?? null,
    }));

    return mapped;
  };

  const fetchWorkflows = async (offset: number, q: string) => {
    const baseSelect = [
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
      "views_count",
      "likes_count",
      "created_at",
      "published_at",
      "is_published",
      "is_public",
    ].join(",");

    const runQuery = async (mode: "visibility" | "is_public") => {
      let builder = supabase
        .from("workflows")
        .select(baseSelect)
        .eq("is_published", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (mode === "visibility") builder = builder.in("visibility", ["public", "unlisted"]);
      else builder = builder.eq("is_public", true);

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

      return await builder;
    };

    let res = await runQuery("visibility");
    if (res.error) {
      const msg = String((res.error as any)?.message || "");
      if (msg.toLowerCase().includes("visibility") && msg.toLowerCase().includes("does not exist")) {
        res = await runQuery("is_public");
      }
    }
    if (res.error) throw res.error;

    const mapped: MarketplacePrompt[] = (res.data ?? []).map((w: any) => ({
      id: String(w.id),
      type: (w.type as any) ?? "workflow",
      edgaze_code: w.edgaze_code ?? null,
      title: w.title ?? null,
      description: w.description ?? null,
      prompt_text: w.prompt_text ?? null,
      // IMPORTANT: use workflows.thumbnail_url (per your request)
      thumbnail_url: w.thumbnail_url ?? null,
      owner_name: w.owner_name ?? null,
      owner_handle: w.owner_handle ?? null,
      tags: w.tags ?? null,
      visibility: (w.visibility as any) ?? (w.is_public ? "public" : null),
      monetisation_mode: (w.monetisation_mode as any) ?? null,
      is_paid: w.is_paid ?? null,
      price_usd: w.price_usd != null ? Number(w.price_usd) : null,
      view_count: w.views_count != null ? Number(w.views_count) : null,
      like_count: w.likes_count != null ? Number(w.likes_count) : null,
      created_at: w.published_at ?? w.created_at ?? null,
      published_at: w.published_at ?? null,
    }));

    return mapped;
  };

  const loadPage = async ({
    cursorState,
    replace,
  }: {
    cursorState: CursorState;
    replace: boolean;
  }): Promise<boolean> => {
    try {
      const q = debouncedQuery;

      const [promptsRes, workflowsRes] = await Promise.allSettled([
        fetchPrompts(cursorState.promptsOffset, q),
        fetchWorkflows(cursorState.workflowsOffset, q),
      ]);

      const prompts =
        promptsRes.status === "fulfilled"
          ? promptsRes.value
          : (() => {
              console.error("Marketplace prompts load error", promptsRes.reason);
              return [] as MarketplacePrompt[];
            })();

      const workflows =
        workflowsRes.status === "fulfilled"
          ? workflowsRes.value
          : (() => {
              console.error("Marketplace workflows load error", workflowsRes.reason);
              return [] as MarketplacePrompt[];
            })();

      if (promptsRes.status === "rejected" && workflowsRes.status === "rejected") {
        setErrorMsg("Failed to load marketplace. Refresh and try again.");
        return false;
      }

      const mergedPool = [...(replace ? [] : pending), ...prompts, ...workflows].sort(
        (a, b) => safeDateMs(b.created_at) - safeDateMs(a.created_at)
      );

      emitEvent({ name: "load_page", meta: { replace, q } });

      const { page: nextPage, rest: nextPending } = pickDiversifiedPage(
        mergedPool,
        PAGE_SIZE,
        userProfile,
        sessionId
      );

      setItems((prev) => (replace ? nextPage : [...prev, ...nextPage]));
      setPending(nextPending);

      fetchOwnerProfiles(nextPage).catch(() => {});
      fetchOwnerProfiles(nextPending.slice(0, 24)).catch(() => {});

      const promptsMore = prompts.length === PAGE_SIZE;
      const workflowsMore = workflows.length === PAGE_SIZE;

      setCursor({
        promptsOffset: cursorState.promptsOffset + prompts.length,
        workflowsOffset: cursorState.workflowsOffset + workflows.length,
      });

      const more = nextPending.length > 0 || promptsMore || workflowsMore;
      setHasMore(more);

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
    setItems([]);
    setPending([]);
    setCursor({ promptsOffset: 0, workflowsOffset: 0 });
    setLoadingFirst(true);

    const ok = await loadPage({
      cursorState: { promptsOffset: 0, workflowsOffset: 0 },
      replace: true,
    });

    setLoadingFirst(false);
    setActiveQuery(committedDebouncedQuery);

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
  }, [committedDebouncedQuery]);

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
        const more = await loadPage({ cursorState: cursor, replace: false });
        setLoadingMore(false);
        if (!more) setHasMore(false);
      },
      { root: null, rootMargin: "900px 0px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, hasMore, loadingFirst, loadingMore]);

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

  // --- unified predictor: queries prompts + workflows + profiles concurrently ---
  useEffect(() => {
    let cancelled = false;
    const q = predictDebounced.trim();
    const qLower = q.toLowerCase();

    (async () => {
      if (!qLower) {
        setPredictResults([]);
        setPredictLoading(false);
        return;
      }

      setPredictLoading(true);

      const [pRes, wRes, profRes] = await Promise.allSettled([
        supabase
          .from("prompts")
          .select("id, owner_handle, edgaze_code, title, type, created_at, thumbnail_url")
          .in("visibility", ["public", "unlisted"])
          .in("type", ["prompt", "workflow"])
          .or(
            [
              `edgaze_code.ilike.%${qLower}%`,
              `owner_handle.ilike.%${qLower}%`,
              `title.ilike.%${qLower}%`,
              `tags.ilike.%${qLower}%`,
            ].join(",")
          )
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("workflows")
          .select("id, owner_handle, edgaze_code, title, type, created_at, published_at, is_published, thumbnail_url")
          .eq("is_published", true)
          .or(
            [
              `edgaze_code.ilike.%${qLower}%`,
              `owner_handle.ilike.%${qLower}%`,
              `title.ilike.%${qLower}%`,
              `tags.ilike.%${qLower}%`,
            ].join(",")
          )
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("profiles")
          .select("handle, full_name, avatar_url, bio, runs_count, remixes_count")
          .or(
            [
              `handle.ilike.%${qLower}%`,
              `full_name.ilike.%${qLower}%`,
              `bio.ilike.%${qLower}%`,
            ].join(",")
          )
          .order("runs_count", { ascending: false })
          .limit(6),
      ]);

      if (cancelled) return;

      const promptsData =
        pRes.status === "fulfilled" && !(pRes.value as any).error
          ? (((pRes.value as any).data ?? []) as any[])
          : [];

      const workflowsData =
        wRes.status === "fulfilled" && !(wRes.value as any).error
          ? (((wRes.value as any).data ?? []) as any[])
          : [];

      const profilesData =
        profRes.status === "fulfilled" && !(profRes.value as any).error
          ? (((profRes.value as any).data ?? []) as any[])
          : [];

      const results: UnifiedSearchResult[] = [];

      for (const p of promptsData) {
        results.push({
          kind: (p.type as any) === "workflow" ? "workflow" : "prompt",
          item: {
            id: String(p.id),
            owner_handle: p.owner_handle ?? null,
            edgaze_code: p.edgaze_code ?? null,
            title: p.title ?? null,
            type: (p.type as any) ?? "prompt",
            created_at: p.created_at ?? null,
            thumbnail_url: p.thumbnail_url ?? null,
          },
          score: 0,
        });
      }

      for (const w of workflowsData) {
        results.push({
          kind: "workflow",
          item: {
            id: String(w.id),
            owner_handle: w.owner_handle ?? null,
            edgaze_code: w.edgaze_code ?? null,
            title: w.title ?? null,
            type: (w.type as any) ?? "workflow",
            created_at: w.published_at ?? w.created_at ?? null,
            thumbnail_url: w.thumbnail_url ?? null,
          },
          score: 0,
        });
      }

      for (const pr of profilesData) {
        results.push({
          kind: "profile",
          item: {
            handle: String(pr.handle || ""),
            full_name: pr.full_name ?? null,
            avatar_url: pr.avatar_url ?? null,
            bio: pr.bio ?? null,
            runs_count: pr.runs_count != null ? Number(pr.runs_count) : null,
            remixes_count: pr.remixes_count != null ? Number(pr.remixes_count) : null,
          },
          score: 0,
        });
      }

      // score + dedupe + keep mix
      const scored = results
        .map((r) => ({ ...r, score: scoreSuggestion(qLower, r) }))
        .filter((r) => r.score > 0.6)
        .sort((a, b) => b.score - a.score);

      const seen = new Set<string>();
      const picked: UnifiedSearchResult[] = [];
      let haveProfile = false;
      let havePrompt = false;
      let haveWorkflow = false;

      for (const r of scored) {
        const key =
          r.kind === "profile"
            ? `profile:${norm((r.item as ProfileSuggestion).handle)}`
            : `${r.kind}:${(r.item as CodeSuggestion).id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (picked.length < 8) {
          picked.push(r);
          if (r.kind === "profile") haveProfile = true;
          if (r.kind === "prompt") havePrompt = true;
          if (r.kind === "workflow") haveWorkflow = true;
        }
      }

      // soft guarantee diversity if available
      if (picked.length > 0) {
        const poolProfiles = scored.filter((x) => x.kind === "profile");
        const poolPrompts = scored.filter((x) => x.kind === "prompt");
        const poolWorkflows = scored.filter((x) => x.kind === "workflow");

        if (!haveProfile && poolProfiles[0]) picked.splice(0, 0, poolProfiles[0]);
        if (!haveWorkflow && poolWorkflows[0]) picked.push(poolWorkflows[0]);
        if (!havePrompt && poolPrompts[0]) picked.push(poolPrompts[0]);
      }

      setPredictResults(picked.slice(0, 9));
      setPredictLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [predictDebounced, supabase]);

  
  const openWithMagic = async (path: string, meta?: Record<string, any>) => {
    burstSparkle();
    emitEvent({ name: "open_code", meta: meta ?? null });
    await new Promise((r) => setTimeout(r, 420));
    router.push(path);
  };

  const fetchCodeSuggestions = async (q: string) => {
    const qLower = q.trim().toLowerCase();
    if (!qLower) return [];

    const [promptsRes, workflowsRes] = await Promise.allSettled([
      supabase
        .from("prompts")
        .select("id, owner_handle, edgaze_code, title, type, created_at")
        .in("visibility", ["public", "unlisted"])
        .in("type", ["prompt", "workflow"])
        .or(
          [`edgaze_code.ilike.%${qLower}%`, `owner_handle.ilike.%${qLower}%`].join(
            ","
          )
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("workflows")
        .select("id, owner_handle, edgaze_code, title, type, created_at, published_at, is_published")
        .eq("is_published", true)
        .or(
          [`edgaze_code.ilike.%${qLower}%`, `owner_handle.ilike.%${qLower}%`].join(
            ","
          )
        )
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const promptsData =
      promptsRes.status === "fulfilled" && !(promptsRes.value as any).error
        ? (((promptsRes.value as any).data ?? []) as any[])
        : [];

    const workflowsData =
      workflowsRes.status === "fulfilled" && !(workflowsRes.value as any).error
        ? (((workflowsRes.value as any).data ?? []) as any[])
        : [];

    const mappedPrompts: CodeSuggestion[] = promptsData.map((p) => ({
      id: String(p.id),
      owner_handle: p.owner_handle ?? null,
      edgaze_code: p.edgaze_code ?? null,
      title: p.title ?? null,
      type: (p.type as any) ?? "prompt",
      created_at: p.created_at ?? null,
    }));

    const mappedWorkflows: CodeSuggestion[] = workflowsData.map((w) => ({
      id: String(w.id),
      owner_handle: w.owner_handle ?? null,
      edgaze_code: w.edgaze_code ?? null,
      title: w.title ?? null,
      type: ((w.type as any) ?? "workflow") as any,
      created_at: w.published_at ?? w.created_at ?? null,
    }));

    const merged = [...mappedPrompts, ...mappedWorkflows]
      .filter((p) => {
        const h = (p.owner_handle ?? "").toLowerCase();
        const c = (p.edgaze_code ?? "").toLowerCase();
        const combo = h && c ? `${h}/${c}` : "";
        return (
          c.includes(qLower) ||
          h.includes(qLower) ||
          (combo && combo.includes(qLower))
        );
      })
      .sort((a, b) => safeDateMs(b.created_at) - safeDateMs(a.created_at));

    const seen = new Set<string>();
    const deduped: CodeSuggestion[] = [];
    for (const it of merged) {
      const key = `${(it.owner_handle ?? "").toLowerCase()}/${(
        it.edgaze_code ?? ""
      ).toLowerCase()}/${it.type ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(it);
      if (deduped.length >= 6) break;
    }

    return deduped;
  };

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
        const list = await fetchCodeSuggestions(q);
        if (cancelled) return;
        setCodeSuggestions(list);
      } finally {
        if (!cancelled) setCodeSugLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [codeQuery, supabase]);

  const findListingByCode = async (handlePart: string | null, codePart: string) => {
    if (handlePart) {
      const { data } = await supabase
        .from("prompts")
        .select("id, owner_handle, edgaze_code, title, type")
        .eq("owner_handle", handlePart)
        .eq("edgaze_code", codePart)
        .in("visibility", ["public", "unlisted"])
        .maybeSingle();

      if (data?.owner_handle && data?.edgaze_code) return data as CodeSuggestion;

      const wfTry1 = await supabase
        .from("workflows")
        .select("id, owner_handle, edgaze_code, title, type")
        .eq("owner_handle", handlePart)
        .eq("edgaze_code", codePart)
        .eq("is_published", true)
        .maybeSingle();

      if (wfTry1.data?.owner_handle && wfTry1.data?.edgaze_code) return wfTry1.data as any;

      return null;
    }

    const { data } = await supabase
      .from("prompts")
      .select("id, owner_handle, edgaze_code, title, type")
      .eq("edgaze_code", codePart)
      .in("visibility", ["public", "unlisted"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0]?.owner_handle && data[0]?.edgaze_code) {
      return data[0] as CodeSuggestion;
    }

    const wfTry2 = await supabase
      .from("workflows")
      .select("id, owner_handle, edgaze_code, title, type, published_at, created_at")
      .eq("edgaze_code", codePart)
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (
      wfTry2.data &&
      wfTry2.data.length > 0 &&
      wfTry2.data[0]?.owner_handle &&
      wfTry2.data[0]?.edgaze_code
    ) {
      return wfTry2.data[0] as any;
    }

    return null;
  };

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
      codePart = qRaw.trim();
    }

    if (!codePart) return;

    setCodeSubmitting(true);
    try {
      const listing = await findListingByCode(handlePart, codePart);
      if (!listing?.owner_handle || !listing?.edgaze_code) return;

      await openWithMagic(`/p/${listing.owner_handle}/${listing.edgaze_code}`, {
        owner_handle: listing.owner_handle,
        edgaze_code: listing.edgaze_code,
        type: listing.type,
      });
    } finally {
      setCodeSubmitting(false);
    }
  };

  const topRightDesktop =
    userId && profile ? (
      <div className="relative">
        <button
          ref={pillRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
        >
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
            className="absolute right-0 mt-2 z-[80] w-52 overflow-hidden rounded-2xl border border-white/12 bg-[#0b0b10] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
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

// MOBILE: no profile icon, no sign in button (use hamburger menu instead)
const topRightMobile = null;

  const handlePredictSelect = async (r: UnifiedSearchResult) => {
    setPredictOpen(false);
  
    if (r.kind === "profile") {
      const h = (r.item as ProfileSuggestion).handle;
      if (!h) return;
      router.push(`/profile/${h}`);
      return;
    }
  
    const it = r.item as CodeSuggestion;
    if (!it.owner_handle || !it.edgaze_code) return;
  
    const path = r.kind === "workflow" 
      ? `/${it.owner_handle}/${it.edgaze_code}`
      : `/p/${it.owner_handle}/${it.edgaze_code}`;
  
    await openWithMagic(path, {
      owner_handle: it.owner_handle,
      edgaze_code: it.edgaze_code,
      type: it.type,
    });
  };
  

  return (
    <>
      <div className="flex h-screen flex-col bg-[#050505] text-white">
      <header className="sticky top-0 z-[50] flex flex-col gap-3 bg-[#050505]/85 backdrop-blur px-4 py-3 sm:px-6 sm:py-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex items-center justify-between sm:justify-start">
    <div className="hidden sm:block leading-tight">
  <div className="flex items-center gap-2">
    <div className="text-base font-semibold">Marketplace</div>
    <span className="flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      BETA
    </span>
  </div>
  <div className="text-xs text-white/55">
    Prompts, workflows, and creators — intelligently mixed.
  </div>
</div>
          </div>

          <div className="mx-6 hidden max-w-2xl flex-1 md:block">
            <MarketplaceSearchBar
              query={query}
              setQuery={setQuery}
              debouncedQuery={debouncedQuery}
              activeQuery={activeQuery}
              searchRefreshing={searchRefreshing}
              searchFocused={searchFocused}
              setSearchFocused={setSearchFocused}
              predictOpen={predictOpen}
              setPredictOpen={setPredictOpen}
              predictLoading={predictLoading}
              predictResults={predictResults}
              activePredictIndex={activePredictIndex}
              setActivePredictIndex={(fn) => setActivePredictIndex(fn)}
              setActivePredictIndexValue={(v) => setActivePredictIndex(v)}
              handlePredictSelect={handlePredictSelect}
              predictBoxRef={predictBoxRef}
              predictBlurTimer={predictBlurTimer}
              inputRef={searchInputRef}
            />
          </div>

          <div className="w-full md:hidden">
            <MarketplaceSearchBar
              compact
              query={query}
              setQuery={setQuery}
              debouncedQuery={debouncedQuery}
              activeQuery={activeQuery}
              searchRefreshing={searchRefreshing}
              searchFocused={searchFocused}
              setSearchFocused={setSearchFocused}
              predictOpen={predictOpen}
              setPredictOpen={setPredictOpen}
              predictLoading={predictLoading}
              predictResults={predictResults}
              activePredictIndex={activePredictIndex}
              setActivePredictIndex={(fn) => setActivePredictIndex(fn)}
              setActivePredictIndexValue={(v) => setActivePredictIndex(v)}
              handlePredictSelect={handlePredictSelect}
              predictBoxRef={predictBoxRef}
              predictBlurTimer={predictBlurTimer}
              inputRef={searchInputRefMobile}
            />
          </div>

          <div className="flex items-center gap-3">
  <div className="hidden sm:block">{topRightDesktop}</div>
</div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
{/* Code box (unchanged from your current file) */}
          <section className="mb-6">
            <form
              onSubmit={handleCodeSubmit}
              className="relative w-full overflow-visible rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-4 sm:px-6 sm:py-5 shadow-[0_0_40px_rgba(15,23,42,0.7)]"
            >
              <div className="pointer-events-none absolute inset-[1px] rounded-[23px] opacity-70 edgaze-gradient" />
              <div className="pointer-events-none absolute inset-[1px] rounded-[23px] opacity-55 edgaze-gradient-2" />

              <div
                className={cn(
                  "pointer-events-none absolute inset-0 overflow-hidden rounded-3xl transition-opacity duration-300",
                  sparkleOn ? "opacity-100" : "opacity-0"
                )}
                aria-hidden="true"
              >
                <div className="sparkle-layer" />
                <div className="sparkle-layer sparkle-layer-2" />
              </div>

              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/edgaze-mark.png"
                      alt="Edgaze"
                      className="h-5 w-5 rounded-md"
                    />
                    <div className="text-sm font-semibold">Edgaze Codes</div>
                  </div>
                </div>

                <div className="relative mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <div className="flex items-center rounded-full border border-white/25 bg-black/70 px-4 py-2 text-sm">
                      <input
                        type="text"
                        value={codeQuery}
                        onChange={(e) => setCodeQuery(e.target.value)}
                        placeholder="@handle/code or /code"
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                      />
                    </div>

                    {(codeSugLoading || codeSuggestions.length > 0) && (
                      <div className="absolute left-0 right-0 top-full z-[120] mt-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0b0b10] shadow-xl">
                        {codeSugLoading ? (
                          <div className="flex items-center gap-2 px-4 py-3 text-sm text-white/70">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching…
                          </div>
                        ) : (
                          <ul className="max-h-64 overflow-y-auto text-sm">
                            {codeSuggestions.map((p) => (
                              <li key={`${p.id}-${p.type ?? ""}`}>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!p.owner_handle || !p.edgaze_code) return;
                                    await openWithMagic(`/p/${p.owner_handle}/${p.edgaze_code}`, {
                                      owner_handle: p.owner_handle,
                                      edgaze_code: p.edgaze_code,
                                      type: p.type,
                                    });
                                  }}
                                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-white/85 hover:bg-white/5"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs text-white/55">@{p.owner_handle}</div>
                                    <div className="truncate text-sm font-medium">
                                      /{p.edgaze_code}
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    <span
                                      className={cn(
                                        "rounded-full border px-2 py-1 text-[10px] font-semibold",
                                        p.type === "workflow"
                                          ? "border-pink-400/25 bg-pink-500/10 text-pink-100"
                                          : "border-cyan-300/25 bg-cyan-400/10 text-cyan-50"
                                      )}
                                    >
                                      {p.type === "workflow" ? "Workflow" : "Prompt"}
                                    </span>
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
                      (codeSubmitting || !codeQuery.trim()) &&
                        "cursor-not-allowed opacity-70"
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
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
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
                {dedupedItems.map((p) => (
                  <PromptCard
                    key={`${p.type ?? "x"}-${p.id}`}
                    prompt={p}
                    currentUserId={userId}
                    requireAuth={requireAuth}
                    supabase={supabase}
                    ownerProfiles={ownerProfiles}
                    onEvent={emitEvent}
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
        @keyframes edgazeFlowA {
          0% {
            background-position: 0% 0%, 100% 20%, 20% 100%;
          }
          18% {
            background-position: 30% 40%, 70% 10%, 10% 80%;
          }
          45% {
            background-position: 60% 10%, 40% 90%, 80% 60%;
          }
          72% {
            background-position: 10% 70%, 90% 35%, 50% 0%;
          }
          100% {
            background-position: 0% 0%, 100% 20%, 20% 100%;
          }
        }

        @keyframes edgazeFlowB {
          0% {
            background-position: 10% 10%, 90% 30%, 30% 90%;
          }
          22% {
            background-position: 55% 20%, 65% 0%, 0% 80%;
          }
          50% {
            background-position: 90% 60%, 20% 95%, 60% 40%;
          }
          78% {
            background-position: 25% 85%, 100% 45%, 45% 10%;
          }
          100% {
            background-position: 10% 10%, 90% 30%, 30% 90%;
          }
        }

        .edgaze-gradient {
          background-image: radial-gradient(
              800px circle at 15% 10%,
              rgba(56, 189, 248, 0.22),
              transparent 60%
            ),
            radial-gradient(
              700px circle at 85% 20%,
              rgba(236, 72, 153, 0.18),
              transparent 60%
            ),
            linear-gradient(
              120deg,
              rgba(56, 189, 248, 0.18),
              rgba(236, 72, 153, 0.16),
              rgba(56, 189, 248, 0.12)
            );
          background-size: 150% 150%, 150% 150%, 220% 220%;
          animation: edgazeFlowA 10.5s ease-in-out infinite;
          filter: saturate(1.15);
        }

        .edgaze-gradient-2 {
          background-image: radial-gradient(
              900px circle at 20% 90%,
              rgba(56, 189, 248, 0.16),
              transparent 62%
            ),
            radial-gradient(
              700px circle at 90% 70%,
              rgba(236, 72, 153, 0.14),
              transparent 62%
            ),
            linear-gradient(
              40deg,
              rgba(236, 72, 153, 0.12),
              rgba(56, 189, 248, 0.12),
              rgba(236, 72, 153, 0.09)
            );
          background-size: 170% 170%, 170% 170%, 240% 240%;
          animation: edgazeFlowB 12.5s ease-in-out infinite;
          mix-blend-mode: screen;
          filter: saturate(1.2) blur(0.2px);
        }

        .sparkle-layer {
          position: absolute;
          inset: -40%;
          background-image: radial-gradient(
            rgba(255, 255, 255, 0.7) 0.8px,
            transparent 1px
          );
          background-size: 18px 18px;
          opacity: 0.22;
          transform: rotate(12deg);
          animation: sparkleDrift 0.85s ease-out 1;
        }

        .sparkle-layer-2 {
          background-size: 24px 24px;
          opacity: 0.14;
          transform: rotate(-8deg);
          animation-duration: 0.95s;
        }

        @keyframes sparkleDrift {
          0% {
            transform: translate3d(-10px, 10px, 0) rotate(10deg);
            opacity: 0;
          }
          20% {
            opacity: 0.22;
          }
          100% {
            transform: translate3d(30px, -20px, 0) rotate(10deg);
            opacity: 0;
          }
        }

        .predict-panel {
          transform-origin: top;
          animation: dropIn 160ms ease-out 1;
        }

        @keyframes dropIn {
          0% {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .predict-top {
          background: linear-gradient(
            90deg,
            rgba(56, 189, 248, 0.08),
            rgba(236, 72, 153, 0.06),
            rgba(255, 255, 255, 0.02)
          );
        }
      `}</style>
    </>
  );
}
