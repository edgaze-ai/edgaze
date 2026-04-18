// src/components/profile/PublicProfileView.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, Heart, Zap } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import {
  fetchCreatorListings,
  fetchCreatorPublicListingCounts,
  type CreatorListing,
} from "./creatorListingsAdapter";
import ErrorModal from "../marketplace/ErrorModal";
import { DEFAULT_AVATAR_SRC } from "../../config/branding";
import { SHOW_PUBLIC_LIKES_AND_RUNS } from "../../lib/constants";
import { formatClientError } from "../../lib/format-client-error";
import ProfileAvatar from "../ui/ProfileAvatar";
import ProfileLink from "../ui/ProfileLink";
import VerifiedCreatorBadge from "../ui/VerifiedCreatorBadge";
import FoundingCreatorBadge from "../ui/FoundingCreatorBadge";
import ProfileEditorModal, { type ProfileEditorOpenOptions } from "./ProfileEditorModal";
import { ProfileSocialIcon } from "./ProfileSocialIcon";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PublicProfileRow = {
  id: string;
  handle: string;
  full_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  socials: Record<string, string> | null;
  created_at?: string | null;
  source?: string | null;
  claim_status?: string | null;
  is_verified_creator?: boolean | null;
  is_founding_creator?: boolean | null;
};

type Tab = "all" | "prompts" | "workflows";
type Sort = "newest" | "popular" | "oldest";

/** Row shape when selecting like count columns (workflows: likes_count; prompts: likes_count, like_count) */
type LikeCountRow = { likes_count?: number | null; like_count?: number | null };

function initialsFromName(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "EG";
  const parts = n.split(/\s+/);
  const a = parts[0]?.[0]?.toUpperCase() || "E";
  const b = parts[1]?.[0]?.toUpperCase() || parts[0]?.[1]?.toUpperCase() || "G";
  return `${a}${b}`.slice(0, 2);
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
        className,
      )}
      style={{ width: px, height: px }}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/0 text-[11px] font-semibold text-white/80">
          {initialsFromName(name)}
        </div>
      )}
    </div>
  );
}

function normalizeHandle(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 24);
}

const HANDLE_REGEX = /^[a-z0-9_]{3,24}$/;

/** Saved + editor cap; header uses flex so long names don’t mid-glyph clip. */
const PROFILE_FULL_NAME_MAX = 50;

function sanitizeUrl(url: string) {
  const v = (url || "").trim();
  if (!v) return "";
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`);
    if (!["http:", "https:"].includes(u.protocol)) return "";
    return u.toString();
  } catch {
    return "";
  }
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

function formatMemberSince(iso: string | null | undefined): string | null {
  const ms = safeDateMs(iso);
  if (!ms) return null;
  try {
    return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(ms));
  } catch {
    return null;
  }
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
  if (!rtf) {
    const n = Math.abs(v);
    const suffix = diff < 0 ? "ago" : "from now";
    return `${n} ${u}${n === 1 ? "" : "s"} ${suffix}`;
  }

  return rtf.format(v, u as Intl.RelativeTimeFormatUnit);
}

function priceLabelFor(it: CreatorListing) {
  const isPaid = !!it.is_paid || it.monetisation_mode === "paywall";
  if (!isPaid) return "Free";
  if (typeof it.price_usd === "number") return `$${it.price_usd.toFixed(2)}`;
  return "Paid";
}

function badgeClassFor(type: "prompt" | "workflow") {
  return type === "workflow"
    ? {
        badge: "border-pink-400/25 bg-pink-500/10 text-pink-100",
        glow: "shadow-[0_0_18px_rgba(236,72,153,0.22)]",
      }
    : {
        badge: "border-cyan-300/25 bg-cyan-400/10 text-cyan-50",
        glow: "shadow-[0_0_18px_rgba(56,189,248,0.22)]",
      };
}

/** Matches marketplace `PromptCard` routes: workflows `/:handle/:code`, prompts `/p/:handle/:code`. */
function listingDetailPathFromProfile(
  listing: { type: "prompt" | "workflow"; edgaze_code?: string | null },
  profile: { id: string; handle: string },
  viewerWorkspaceId: string | null,
  viewerHandle: string | null | undefined,
): string | null {
  const code = (listing.edgaze_code || "").trim();
  if (!code) return null;
  const profileHandleNorm = normalizeHandle(profile.handle);
  const viewerH = viewerHandle ? normalizeHandle(viewerHandle) : "";
  const displayHandle =
    viewerWorkspaceId && String(viewerWorkspaceId) === String(profile.id) && viewerH
      ? viewerH
      : profileHandleNorm;
  if (!displayHandle) return null;
  return listing.type === "workflow" ? `/${displayHandle}/${code}` : `/p/${displayHandle}/${code}`;
}

function BlurredPromptThumbnail({ text }: { text: string }) {
  const snippet =
    (text || "EDGAZE").replace(/\s+/g, " ").trim().slice(0, 28).toUpperCase() || "EDGAZE";

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
  creator,
  currentUserId,
  requireAuth,
  getAccessToken,
  supabase,
  onOpen,
}: {
  prompt: CreatorListing;
  creator: PublicProfileRow;
  currentUserId: string | null;
  requireAuth: () => boolean;
  getAccessToken: () => Promise<string | null>;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  onOpen: () => void;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [likeCount, setLikeCount] = useState(
    (typeof prompt.likes_count === "number" ? prompt.likes_count : null) ??
      (typeof prompt.like_count === "number" ? prompt.like_count : null) ??
      0,
  );
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    details?: string;
    hint?: string;
  }>({
    open: false,
    title: "",
    message: "",
  });

  const isFree = prompt.monetisation_mode === "free" || prompt.is_paid === false;
  const publishedLabel = formatRelativeTime(prompt.created_at || null);

  const runs = typeof prompt.runs_count === "number" ? prompt.runs_count : 0;

  const likeKind: "prompt" | "workflow" =
    prompt.likeItemType ?? (prompt.type === "workflow" ? "workflow" : "prompt");

  // Check if user has liked this item and refresh count
  useEffect(() => {
    const checkLikeStatus = async () => {
      try {
        const itemsTable = likeKind === "workflow" ? "workflows" : "prompts";
        const likeCountCols = likeKind === "workflow" ? "likes_count" : "likes_count, like_count";

        // Refresh count from database first
        const { data: itemData } = await supabase
          .from(itemsTable)
          .select(likeCountCols)
          .eq("id", prompt.id)
          .single();

        if (itemData) {
          const raw = itemData as LikeCountRow;
          const actualCount = raw.likes_count ?? raw.like_count ?? 0;
          setLikeCount(actualCount);
        }

        if (!currentUserId) {
          setIsLiked(false);
          return;
        }

        const token = await getAccessToken();
        const res = await fetch(
          `/api/marketplace/like?itemId=${encodeURIComponent(prompt.id)}&itemType=${likeKind}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
          },
        );
        const j = (await res.json().catch(() => ({}))) as { isLiked?: boolean };
        setIsLiked(Boolean(j.isLiked));
      } catch (error) {
        console.error("Error checking like status:", error);
        setIsLiked(false);
      }
    };

    checkLikeStatus();
  }, [prompt.id, likeKind, currentUserId, supabase, getAccessToken]);

  const creatorName = creator.full_name || (creator.handle ? `@${creator.handle}` : "Unknown");
  const creatorHandle = creator.handle ? `@${creator.handle}` : "";

  const priceLabel = isFree
    ? "Free"
    : prompt.price_usd != null
      ? `$${prompt.price_usd.toFixed(2)}`
      : "Paid";

  const badgeLabel = prompt.type === "workflow" ? "Workflow" : "Prompt";
  const desc = clampText(prompt.description || prompt.prompt_text || "", 140);

  const badgeClass =
    prompt.type === "workflow"
      ? "border-pink-400/25 bg-pink-500/10 text-pink-100"
      : "border-cyan-300/25 bg-cyan-400/10 text-cyan-50";

  const badgeGlow =
    prompt.type === "workflow"
      ? "shadow-[0_0_18px_rgba(236,72,153,0.22)]"
      : "shadow-[0_0_18px_rgba(56,189,248,0.22)]";

  const handleCardClick = () => {
    onOpen();
  };

  const handleLikeClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.stopPropagation();
    if (!requireAuth()) return;
    if (!currentUserId) return;

    const wasLiked = isLiked;

    // Optimistic update
    setIsLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));

    try {
      setLikeLoading(true);

      const token = await getAccessToken();
      const res = await fetch("/api/marketplace/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ itemId: prompt.id, itemType: likeKind }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
        likesCount?: number;
        isLiked?: boolean;
      };
      if (!res.ok) {
        throw new Error(j.details || j.error || `Request failed (${res.status})`);
      }
      if (typeof j.likesCount === "number") {
        setLikeCount(j.likesCount);
        setIsLiked(Boolean(j.isLiked));
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      setIsLiked(wasLiked);
      setLikeCount((prev) => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));

      const errorMessage = formatClientError(error);
      const looksLikeAuth =
        !currentUserId ||
        /\b401\b/.test(errorMessage) ||
        /not authenticated/i.test(errorMessage) ||
        /jwt expired/i.test(errorMessage) ||
        /invalid jwt/i.test(errorMessage) ||
        /refresh token/i.test(errorMessage) ||
        (/session/i.test(errorMessage) && /expired|invalid|missing/i.test(errorMessage));

      if (looksLikeAuth) {
        setErrorModal({
          open: true,
          title: "Authentication Required",
          message: "Please sign in to like items.",
          details: errorMessage,
          hint: "Try signing in again.",
        });
      } else {
        setErrorModal({
          open: true,
          title: "Failed to toggle like",
          message: "An error occurred while trying to like this item.",
          details: errorMessage,
          hint: "Please try again.",
        });
      }
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className="group w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]"
      >
        <div className="relative overflow-hidden rounded-2xl">
          {prompt.thumbnail_url ? (
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
                badgeGlow,
              )}
            >
              {badgeLabel}
            </span>

            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold tabular-nums backdrop-blur",
                isFree
                  ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-300"
                  : "border-white/12 bg-black/55 text-white/85",
              )}
            >
              {priceLabel}
            </span>
          </div>
        </div>

        <div className="mt-3 flex gap-3">
          <ProfileAvatar
            name={creatorName}
            avatarUrl={creator.avatar_url || null}
            size={36}
            handle={creator.handle}
            className="mt-0.5"
          />

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white/95">
              {prompt.title || "Untitled listing"}
            </h3>

            <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
              <ProfileLink
                name={creatorName}
                handle={creator.handle}
                verified={!!creator.is_verified_creator}
                verifiedSize="sm"
                className="truncate"
              />
              {creatorHandle && (
                <ProfileLink
                  name={creatorHandle}
                  handle={creator.handle}
                  className="shrink-0 text-white/35"
                />
              )}
            </div>

            {desc && (
              <div className="mt-2 line-clamp-2 text-[12px] leading-snug text-white/55">{desc}</div>
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

                {SHOW_PUBLIC_LIKES_AND_RUNS && (
                  <>
                    <span className="text-white/25">•</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Zap className="h-3 w-3 text-cyan-300/90" />
                      <span>{runs}</span>
                    </span>
                    <span className="text-white/25">•</span>
                  </>
                )}

                <span className="truncate">{publishedLabel}</span>
              </div>

              <button
                type="button"
                onClick={handleLikeClick}
                disabled={likeLoading}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-[4px] text-[11px] transition-colors",
                  isLiked
                    ? prompt.type === "workflow"
                      ? "border-pink-400/40 bg-pink-500/20 text-pink-200"
                      : "border-cyan-300/40 bg-cyan-400/20 text-cyan-100"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white/90",
                  prompt.type === "workflow"
                    ? "hover:border-pink-400 hover:text-pink-200"
                    : "hover:border-cyan-300 hover:text-cyan-100",
                )}
              >
                {likeLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Heart className="h-3.5 w-3.5" fill={isLiked ? "currentColor" : "none"} />
                )}
                {SHOW_PUBLIC_LIKES_AND_RUNS && <span>{likeCount ?? 0}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ErrorModal
        open={errorModal.open}
        onClose={() => setErrorModal({ ...errorModal, open: false })}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
        hint={errorModal.hint}
      />
    </>
  );
}

export default function PublicProfileView({ handle, debug }: { handle: string; debug?: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const auth = useAuth();

  const viewerId = auth.userId;
  const workspaceViewerId = auth.workspaceUserId;

  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState<PublicProfileRow | null>(null);

  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [lifetimeRuns, setLifetimeRuns] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [errTop, setErrTop] = useState<string | null>(null);

  const isOwner = !!workspaceViewerId && !!creator?.id && creator.id === workspaceViewerId;

  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorOptions, setProfileEditorOptions] = useState<ProfileEditorOpenOptions>({});

  // Listings
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsErr, setListingsErr] = useState<string | null>(null);
  const [listings, setListings] = useState<CreatorListing[]>([]);
  const [publicListingCounts, setPublicListingCounts] = useState<{
    prompts: number;
    workflows: number;
  } | null>(null);

  const lastFollowAtRef = useRef<number>(0);

  const profileMainMaxClass = "mx-auto w-full max-w-full lg:max-w-5xl xl:max-w-6xl";

  // Force enable scrolling - override all global CSS
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    // Save original values
    const originalHtmlHeight = html.style.height;
    const originalHtmlOverflowY = html.style.overflowY;
    const originalHtmlOverflowX = html.style.overflowX;
    const originalBodyHeight = body.style.height;
    const originalBodyOverflowY = body.style.overflowY;
    const originalBodyOverflowX = body.style.overflowX;

    // Force enable scrolling - override everything
    html.style.setProperty("height", "auto", "important");
    html.style.setProperty("overflow-y", "auto", "important");
    html.style.setProperty("overflow-x", "hidden", "important");
    html.style.setProperty("min-height", "100%", "important");

    body.style.setProperty("height", "auto", "important");
    body.style.setProperty("overflow-y", "auto", "important");
    body.style.setProperty("overflow-x", "hidden", "important");
    body.style.setProperty("min-height", "100%", "important");

    // Also override any parent containers
    const rootElement = document.getElementById("__next");
    if (rootElement) {
      rootElement.style.setProperty("height", "auto", "important");
      rootElement.style.setProperty("overflow-y", "auto", "important");
      rootElement.style.setProperty("min-height", "100%", "important");
    }

    return () => {
      html.style.height = originalHtmlHeight;
      html.style.overflowY = originalHtmlOverflowY;
      html.style.overflowX = originalHtmlOverflowX;
      body.style.height = originalBodyHeight;
      body.style.overflowY = originalBodyOverflowY;
      body.style.overflowX = originalBodyOverflowX;
      if (rootElement) {
        rootElement.style.removeProperty("height");
        rootElement.style.removeProperty("overflow-y");
        rootElement.style.removeProperty("min-height");
      }
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);
      setCreator(null);
      setErrTop(null);

      const normalized = normalizeHandle(handle);
      if (!normalized) {
        if (!alive) return;
        setErrTop("Invalid profile link.");
        setLoading(false);
        return;
      }

      try {
        const base = "id, handle, full_name, avatar_url, banner_url, bio, socials, created_at";
        const provNoFlags = `${base}, source, claim_status`;
        const withFoundingOnly = `${provNoFlags}, is_founding_creator`;
        const withVerifiedOnly = `${provNoFlags}, is_verified_creator`;
        const withProv = `${provNoFlags}, is_verified_creator, is_founding_creator`;

        /** Try selects in order so we never drop OG/verified flags just because one column is missing. */
        const selectAttempts = [withProv, withFoundingOnly, withVerifiedOnly, provNoFlags, base];

        let row: PublicProfileRow | null = null;
        let lastError: Error | null = null;

        for (const sel of selectAttempts) {
          const { data, error } = await supabase
            .from("profiles")
            .select(sel)
            .eq("handle", normalized)
            .maybeSingle();

          const candidate = data;
          const hasId =
            candidate !== null &&
            typeof candidate === "object" &&
            "id" in (candidate as Record<string, unknown>);
          if (!error && hasId) {
            const matchedRow = candidate as unknown as PublicProfileRow;
            row = matchedRow;
            lastError = null;
            break;
          }
          if (error) lastError = new Error(error.message || "Query failed");
        }

        if (!alive) return;

        if (lastError && !row) throw lastError; // e.g. permission / network
        if (!row) {
          setErrTop("Profile not found.");
          setLoading(false);
          return;
        }

        setCreator(row);
      } catch (e: any) {
        if (!alive) return;
        setErrTop(e?.message || "Failed to load profile.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [handle, supabase]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!creator?.id) return;

      const followersRes = await supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", creator.id);

      const isProfileOwner =
        !!workspaceViewerId && String(workspaceViewerId) === String(creator.id);
      const followingRes = isProfileOwner
        ? await supabase
            .from("follows")
            .select("following_id", { count: "exact", head: true })
            .eq("follower_id", creator.id)
        : { count: 0 as number | null };

      if (!alive) return;

      setFollowers(followersRes.count ?? 0);
      setFollowing(isProfileOwner ? (followingRes.count ?? 0) : 0);

      if (viewerId) {
        const viewerFollowRes = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewerId)
          .eq("following_id", creator.id)
          .maybeSingle();

        if (!alive) return;
        setIsFollowing(!!viewerFollowRes.data);
      } else {
        setIsFollowing(false);
      }

      try {
        const r = await fetch(
          `/api/profile/creator-lifetime-runs?creator_id=${encodeURIComponent(creator.id)}`,
        );
        const j = (await r.json().catch(() => ({}))) as { totalRuns?: number };
        if (!alive) return;
        setLifetimeRuns(typeof j.totalRuns === "number" ? j.totalRuns : 0);
      } catch {
        if (!alive) return;
        setLifetimeRuns(null);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [creator?.id, supabase, viewerId, workspaceViewerId]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!creator?.id) return;
      try {
        const c = await fetchCreatorPublicListingCounts(creator.id);
        if (!alive) return;
        setPublicListingCounts(c);
      } catch {
        if (!alive) return;
        setPublicListingCounts(null);
      }
    };

    setPublicListingCounts(null);
    run();
    return () => {
      alive = false;
    };
  }, [creator?.id]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!creator?.id) return;

      setListingsLoading(true);
      setListingsErr(null);

      try {
        const data = await fetchCreatorListings({
          creatorId: creator.id,
          tab,
          sort: sort as any,
        });

        if (!alive) return;
        setListings((data || []) as any);
      } catch (e: any) {
        if (!alive) return;
        setListings([]);
        setListingsErr(e?.message || "Failed to load uploads");
      } finally {
        if (!alive) return;
        setListingsLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [creator?.id, tab, sort]);

  const onFollowToggle = async () => {
    if (!creator?.id) return;
    if (!auth.requireAuth()) return;
    if (!auth.userId) return;

    const now = Date.now();
    if (now - lastFollowAtRef.current < 1200) return;
    lastFollowAtRef.current = now;

    setFollowBusy(true);
    setErrTop(null);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", auth.userId)
          .eq("following_id", creator.id);

        if (error) throw error;
        setIsFollowing(false);
        setFollowers((n) => Math.max(0, n - 1));
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: auth.userId,
          following_id: creator.id,
        });

        if (error) throw error;
        setIsFollowing(true);
        setFollowers((n) => n + 1);
      }
    } catch (e: any) {
      setErrTop(e?.message || "Follow failed");
    } finally {
      setFollowBusy(false);
    }
  };

  const avatarSrc = creator?.avatar_url || DEFAULT_AVATAR_SRC;
  const bannerSrc = creator?.banner_url || "";

  const openProfileEditor = (opts?: ProfileEditorOpenOptions) => {
    setProfileEditorOptions(opts ?? {});
    setProfileEditorOpen(true);
  };

  const socials = Object.entries(creator?.socials || {})
    .map(([k, v]) => [k, sanitizeUrl(v || "")] as const)
    .filter(([_, v]) => !!v)
    .slice(0, 6);

  const memberSinceLabel = formatMemberSince(creator?.created_at);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="w-full px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/75">
          {errTop || "Invalid profile link."}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col bg-[#050505] text-white"
      style={{ height: "100vh", overflow: "hidden" }}
    >
      {/* Scrollable content */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}
      >
        {/* Banner — inset frame so desktop isn’t an edge-to-edge slab */}
        <div className="w-full bg-[#050505] px-4 pt-5 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
          <div className={profileMainMaxClass}>
            <div
              className={cn(
                "rounded-[28px] bg-white/[0.03] p-3 sm:p-4",
                "ring-1 ring-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
              )}
            >
              <div className="relative aspect-[5/2] w-full overflow-hidden rounded-2xl sm:aspect-[3/1] sm:rounded-[22px]">
                {bannerSrc ? (
                  <Image
                    src={bannerSrc}
                    alt="Banner"
                    fill
                    sizes="(max-width: 1152px) 100vw, 1152px"
                    className="object-cover object-center"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#0b0b0b]">
                    <div className="absolute inset-0 opacity-[0.92] [background-image:radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.20),transparent_46%),radial-gradient(circle_at_82%_30%,rgba(236,72,153,0.18),transparent_56%)]" />
                    <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/55" />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-6 pb-6 sm:px-6 sm:pt-8 sm:pb-8">
          <div className={profileMainMaxClass}>
            {errTop && (
              <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                {errTop}
              </div>
            )}

            {/* Header */}
            <div
              className={cn(
                "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md",
                "px-6 py-8 sm:px-10 sm:py-10 shadow-[0_8px_48px_rgba(0,0,0,0.6)]",
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-pink-500/8 pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.12),transparent_50%)] pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.08),transparent_50%)] pointer-events-none" />

              <div className="relative flex flex-col gap-5">
                <div className="flex flex-row items-start gap-5 sm:gap-8">
                  <div className="relative shrink-0">
                    <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-white/25 bg-black/50 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-4 ring-white/5 sm:h-32 sm:w-32">
                      <Image
                        src={avatarSrc}
                        alt="Avatar"
                        fill
                        sizes="128px"
                        className="object-cover object-center"
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex min-w-0 w-full max-w-full items-center gap-2.5">
                      <h1
                        className="min-w-0 max-w-full truncate text-lg font-bold tracking-tight text-white sm:text-2xl lg:text-3xl"
                        title={
                          (creator.full_name || "").trim().length > PROFILE_FULL_NAME_MAX
                            ? (creator.full_name || "").trim()
                            : undefined
                        }
                      >
                        {(() => {
                          const raw = (creator.full_name || "").trim();
                          if (raw) return raw.slice(0, PROFILE_FULL_NAME_MAX);
                          return creator.handle ? `@${creator.handle}` : "Creator";
                        })()}
                      </h1>
                      {creator.is_verified_creator ? (
                        <VerifiedCreatorBadge variant="mark" size="md" className="shrink-0" />
                      ) : null}
                    </div>

                    <p className="mt-1.5 text-sm font-medium tracking-tight text-white/45">
                      @{creator.handle}
                    </p>

                    {creator.is_founding_creator ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <FoundingCreatorBadge className="shrink-0" />
                      </div>
                    ) : null}

                    {creator.source === "admin_provisioned" &&
                      creator.claim_status === "unclaimed" && (
                        <div className="mt-3 flex justify-start">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/10",
                              "px-3 py-1.5 text-[13px] font-medium leading-snug text-cyan-100/95",
                              "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                            )}
                          >
                            Created for you by Edgaze
                          </span>
                        </div>
                      )}

                    {creator.bio?.trim() ? (
                      <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
                        {creator.bio.trim()}
                      </p>
                    ) : null}

                    {socials.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {socials.map(([k, v]) => {
                          const displayLabel =
                            k.toLowerCase() === "twitter"
                              ? "X"
                              : k.charAt(0).toUpperCase() + k.slice(1);
                          return (
                            <a
                              key={k}
                              href={v}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/75 transition hover:border-white/18 hover:bg-white/[0.07] hover:text-white/90"
                            >
                              <ProfileSocialIcon
                                kind={k}
                                className="h-3.5 w-3.5 text-white/55 group-hover:text-white/75"
                              />
                              <span>{displayLabel}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {(publicListingCounts || memberSinceLabel) && (
                      <div className="mt-4 sm:mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 sm:px-5">
                        <div className="flex flex-col gap-2 text-[13px] leading-snug text-white/55 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                          {publicListingCounts ? (
                            <p className="text-white/60">
                              <span className="font-semibold text-white/85">
                                {publicListingCounts.prompts + publicListingCounts.workflows}
                              </span>{" "}
                              public{" "}
                              {publicListingCounts.prompts + publicListingCounts.workflows === 1
                                ? "listing"
                                : "listings"}{" "}
                              on Edgaze
                              <span className="text-white/35"> · </span>
                              {publicListingCounts.prompts} prompt
                              {publicListingCounts.prompts === 1 ? "" : "s"},{" "}
                              {publicListingCounts.workflows} workflow
                              {publicListingCounts.workflows === 1 ? "" : "s"}
                            </p>
                          ) : null}
                          {memberSinceLabel ? (
                            <p
                              className={cn(
                                publicListingCounts ? "sm:border-l sm:border-white/10 sm:pl-4" : "",
                              )}
                            >
                              Member since{" "}
                              <span className="font-medium text-white/80">{memberSinceLabel}</span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => openProfileEditor({})}
                      className={cn(
                        "order-first h-10 w-full shrink-0 rounded-full border px-5 text-sm font-semibold transition-all active:scale-[0.98] sm:order-none sm:w-auto sm:min-w-[128px]",
                        "border-white/18 bg-white text-black hover:bg-white/90",
                      )}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Pencil className="h-4 w-4" />
                        Edit profile
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onFollowToggle}
                      disabled={followBusy}
                      className={cn(
                        "order-first h-10 w-full shrink-0 rounded-full border px-5 text-sm font-semibold transition-all active:scale-[0.98] sm:order-none sm:w-auto sm:min-w-[128px]",
                        isFollowing
                          ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                          : "border-white/18 bg-white text-black hover:bg-white/90",
                      )}
                    >
                      {followBusy ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : isFollowing ? (
                        "Following"
                      ) : (
                        "Follow"
                      )}
                    </button>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.05] px-5 text-sm font-medium text-white/90 shadow-sm backdrop-blur-sm">
                      <span className="inline-flex items-baseline gap-1.5 leading-none">
                        <span className="font-bold tabular-nums text-white">{followers}</span>
                        <span className="font-medium text-white/70">followers</span>
                      </span>
                    </div>
                    {isOwner ? (
                      <div className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.05] px-5 text-sm font-medium text-white/90 shadow-sm backdrop-blur-sm">
                        <span className="inline-flex items-baseline gap-1.5 leading-none">
                          <span className="font-bold tabular-nums text-white">{following}</span>
                          <span className="font-medium text-white/70">following</span>
                        </span>
                      </div>
                    ) : null}
                    {lifetimeRuns != null && (
                      <div
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-cyan-400/25 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-pink-500/10 px-5 text-sm shadow-[0_0_20px_-8px_rgba(56,189,248,0.4)] backdrop-blur-sm"
                        title="Total completed runs across all public workflows and prompts"
                      >
                        <Zap
                          className="h-4 w-4 shrink-0 text-cyan-200"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span className="inline-flex items-center gap-1.5 leading-none">
                          <span className="font-bold tabular-nums text-white">
                            {lifetimeRuns.toLocaleString()}
                          </span>
                          <span className="font-medium text-white/70">total runs</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {debug ? (
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/70">
                    <div>viewerId: {viewerId || "(none)"}</div>
                    <div>creatorId: {creator.id}</div>
                    <div>isOwner: {String(isOwner)}</div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Tabs + sort — single row on all sizes */}
            <div className="mt-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:justify-between">
              <div className="flex shrink-0 items-center gap-1.5">
                {(["all", "prompts", "workflows"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "h-7 shrink-0 rounded-full border px-3 text-xs font-medium transition-all duration-200 active:scale-[0.97]",
                      tab === t
                        ? "border-white/30 bg-white text-black shadow-[0_2px_10px_rgba(255,255,255,0.12)]"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:border-white/15 hover:text-white/85",
                    )}
                  >
                    {t === "all" ? "All" : t === "prompts" ? "Prompts" : "Workflows"}
                  </button>
                ))}
              </div>
              <div className="mx-1 hidden h-4 w-px shrink-0 bg-white/15 sm:block" aria-hidden />
              <div className="flex shrink-0 items-center gap-1.5">
                {(["newest", "popular", "oldest"] as Sort[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSort(s)}
                    className={cn(
                      "h-7 shrink-0 rounded-full border px-3 text-xs font-medium transition-all duration-200 active:scale-[0.97]",
                      sort === s
                        ? "border-white/30 bg-white/[0.08] text-white shadow-[0_2px_10px_rgba(255,255,255,0.06)]"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:border-white/15 hover:text-white/85",
                    )}
                  >
                    {s === "newest" ? "Newest" : s === "popular" ? "Popular" : "Oldest"}
                  </button>
                ))}
              </div>
            </div>

            {listingsErr && (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                {listingsErr}
              </div>
            )}

            {/* Listings */}
            <div className="mt-8">
              {listingsLoading ? (
                <div className="flex items-center justify-center gap-3 py-16 text-sm text-white/60">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading listings…</span>
                </div>
              ) : listings.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center backdrop-blur-sm">
                  <p className="text-sm text-white/70">No uploads found for this creator yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map((it) => {
                    const path = listingDetailPathFromProfile(
                      it,
                      creator,
                      workspaceViewerId,
                      auth.user?.handle,
                    );
                    const open = path ? () => router.push(path) : () => {};

                    return (
                      <PromptCard
                        key={`${it.type}-${it.id}`}
                        prompt={it}
                        creator={creator}
                        currentUserId={viewerId}
                        requireAuth={auth.requireAuth}
                        getAccessToken={auth.getAccessToken}
                        supabase={supabase}
                        onOpen={open}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <footer
              className="mt-16 border-t border-white/[0.06] pt-10 pb-16 text-center sm:mt-20 sm:pt-12 sm:pb-24"
              aria-label="Copyright"
            >
              <p className="text-[11px] leading-relaxed text-white/40 sm:text-xs sm:text-white/45">
                © {new Date().getFullYear()} Edge Platforms, Inc. All rights reserved.
              </p>
            </footer>
          </div>
        </div>
      </main>

      {creator && isOwner && (
        <ProfileEditorModal
          open={profileEditorOpen}
          onClose={() => setProfileEditorOpen(false)}
          openOptions={profileEditorOptions}
          creator={{
            id: creator.id,
            full_name: creator.full_name,
            handle: creator.handle,
            bio: creator.bio,
            socials: creator.socials,
            avatar_url: creator.avatar_url,
            banner_url: creator.banner_url,
          }}
          workspaceViewerId={workspaceViewerId}
          profileFullNameMax={PROFILE_FULL_NAME_MAX}
          normalizeHandle={normalizeHandle}
          sanitizeUrl={sanitizeUrl}
          handleRegex={HANDLE_REGEX}
          router={router}
          onPublished={(updates) =>
            setCreator((current) => (current ? { ...current, ...updates } : current))
          }
        />
      )}
    </div>
  );
}
