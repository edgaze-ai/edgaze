// src/components/profile/PublicProfileView.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Loader2,
  Camera,
  Heart,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { fetchCreatorListings } from "./creatorListingsAdapter";
import ErrorModal from "../marketplace/ErrorModal";
import { DEFAULT_AVATAR_SRC } from "../../config/branding";
import { SHOW_VIEWS_AND_LIKES_PUBLICLY } from "../../lib/constants";
import ProfileAvatar from "../ui/ProfileAvatar";
import ProfileLink from "../ui/ProfileLink";
import FoundingCreatorBadge from "../ui/FoundingCreatorBadge";

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
};

type Tab = "all" | "prompts" | "workflows";
type Sort = "newest" | "popular" | "oldest";

type CreatorListing = {
  id: string;
  type: "prompt" | "workflow";
  title?: string | null;
  description?: string | null;
  prompt_text?: string | null;
  thumbnail_url?: string | null;
  edgaze_code?: string | null;
  created_at?: string | null;

  // counts (varies by table / adapter)
  views_count?: number | null;
  view_count?: number | null;
  likes_count?: number | null;
  like_count?: number | null;

  // pricing (optional)
  is_paid?: boolean | null;
  price_usd?: number | null;
  monetisation_mode?: string | null;

  popularityLabel?: string;
};

function initialsFromName(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "EG";
  const parts = n.split(/\s+/);
  const a = parts[0]?.[0]?.toUpperCase() || "E";
  const b =
    parts[1]?.[0]?.toUpperCase() || (parts[0]?.[1]?.toUpperCase() || "G");
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
  creator,
  currentUserId,
  requireAuth,
  supabase,
  onOpen,
}: {
  prompt: CreatorListing;
  creator: PublicProfileRow;
  currentUserId: string | null;
  requireAuth: () => boolean;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  onOpen: () => void;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [likeCount, setLikeCount] = useState(
    (typeof prompt.likes_count === "number" ? prompt.likes_count : null) ??
    (typeof prompt.like_count === "number" ? prompt.like_count : null) ??
    0
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

  const views =
    (typeof prompt.views_count === "number" ? prompt.views_count : null) ??
    (typeof prompt.view_count === "number" ? prompt.view_count : null) ??
    0;

  // Check if user has liked this item and refresh count
  useEffect(() => {
    const checkLikeStatus = async () => {
      try {
        const itemsTable = prompt.type === "workflow" ? "workflows" : "prompts";
        
        // Refresh count from database first
        const { data: itemData } = await supabase
          .from(itemsTable)
          .select("likes_count, like_count")
          .eq("id", prompt.id)
          .single();
        
        if (itemData) {
          const actualCount = itemData.likes_count ?? itemData.like_count ?? 0;
          setLikeCount(actualCount);
        }
        
        // Check if user has liked
        if (!currentUserId) {
          setIsLiked(false);
          return;
        }

        const likesTable = prompt.type === "workflow" ? "workflow_likes" : "prompt_likes";
        const itemIdColumn = prompt.type === "workflow" ? "workflow_id" : "prompt_id";
        
        const { data, error } = await supabase
          .from(likesTable)
          .select("id")
          .eq("user_id", currentUserId)
          .eq(itemIdColumn, prompt.id)
          .maybeSingle();
        
        if (error && !error.message.includes("permission") && !error.message.includes("JWT")) {
          console.error("Error checking like status:", error);
        }
        
        setIsLiked(!!data);
      } catch (error) {
        console.error("Error checking like status:", error);
        setIsLiked(false);
      }
    };

    checkLikeStatus();
  }, [prompt.id, prompt.type, currentUserId, supabase]);

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
    setLikeCount((prev) => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      setLikeLoading(true);
      
      const likesTable = prompt.type === "workflow" ? "workflow_likes" : "prompt_likes";
      const itemsTable = prompt.type === "workflow" ? "workflows" : "prompts";
      const itemIdColumn = prompt.type === "workflow" ? "workflow_id" : "prompt_id";
      
      if (wasLiked) {
        // Remove like
        const { error: deleteError } = await supabase
          .from(likesTable)
          .delete()
          .eq("user_id", currentUserId)
          .eq(itemIdColumn, prompt.id);
        
        if (deleteError) {
          throw deleteError;
        }
        
        setIsLiked(false);
        
        // Small delay to ensure triggers have updated the count
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Refresh count from database (triggers update it)
        const { data: itemData } = await supabase
          .from(itemsTable)
          .select("likes_count, like_count")
          .eq("id", prompt.id)
          .single();
        
        if (itemData) {
          const actualCount = itemData.likes_count ?? itemData.like_count ?? 0;
          setLikeCount(actualCount);
        } else {
          setLikeCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        // Add like
        const insertData = prompt.type === "workflow"
          ? { user_id: currentUserId, workflow_id: prompt.id }
          : { user_id: currentUserId, prompt_id: prompt.id };
        
        const { error: insertError } = await supabase
          .from(likesTable)
          .insert(insertData);
        
        if (insertError) {
          if (insertError.message.includes("unique") || insertError.message.includes("duplicate")) {
            setIsLiked(true);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const { data: itemData } = await supabase
              .from(itemsTable)
              .select("likes_count, like_count")
              .eq("id", prompt.id)
              .single();
            
            if (itemData) {
              const actualCount = itemData.likes_count ?? itemData.like_count ?? 0;
              setLikeCount(actualCount);
            } else {
              setLikeCount((prev) => prev + 1);
            }
            return;
          }
          throw insertError;
        }
        
        setIsLiked(true);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: itemData } = await supabase
          .from(itemsTable)
          .select("likes_count, like_count")
          .eq("id", prompt.id)
          .single();
        
        if (itemData) {
          const actualCount = itemData.likes_count ?? itemData.like_count ?? 0;
          setLikeCount(actualCount);
        } else {
          setLikeCount((prev) => prev + 1);
        }
      }
      
    } catch (error) {
      console.error("Error toggling like:", error);
      setIsLiked(wasLiked);
      setLikeCount((prev) => wasLiked ? prev + 1 : Math.max(0, prev - 1));
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("JWT") || errorMessage.includes("session") || errorMessage.includes("auth") || errorMessage.includes("permission") || errorMessage.includes("row-level security")) {
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

                {SHOW_VIEWS_AND_LIKES_PUBLICLY && (
                  <>
                    <span className="text-white/25">•</span>
                    <span className="flex items-center gap-1">
                      <span className="text-white/35">views</span>
                      <span>{views}</span>
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
                    : "hover:border-cyan-300 hover:text-cyan-100"
                )}
              >
                {likeLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Heart className="h-3.5 w-3.5" fill={isLiked ? "currentColor" : "none"} />
                )}
                {SHOW_VIEWS_AND_LIKES_PUBLICLY && <span>{likeCount ?? 0}</span>}
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

export default function PublicProfileView({
  handle,
  debug,
}: {
  handle: string;
  debug?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const auth = useAuth();

  const viewerId = auth.userId;

  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState<PublicProfileRow | null>(null);

  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [errTop, setErrTop] = useState<string | null>(null);

  const isOwner = !!viewerId && !!creator?.id && creator.id === viewerId;

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [draftName, setDraftName] = useState("");
  const [draftHandle, setDraftHandle] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftSocials, setDraftSocials] = useState<Record<string, string>>({});

  // Listings
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsErr, setListingsErr] = useState<string | null>(null);
  const [listings, setListings] = useState<CreatorListing[]>([]);

  // Upload state
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadBusy, setUploadBusy] = useState<"avatar" | "banner" | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const lastFollowAtRef = useRef<number>(0);

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

  // Pills
  const PILL =
    "h-9 inline-flex items-center justify-center rounded-full border px-4 text-xs font-medium transition active:scale-[0.99]";
  const PILL_ACTIVE = "border-white/20 bg-white text-black";
  const PILL_INACTIVE =
    "border-white/12 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/18";
  const CTA_GRADIENT =
    "bg-gradient-to-r from-cyan-300 via-cyan-200 to-pink-300 text-black hover:brightness-110";

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
        const { data, error } = await supabase
          .from("profiles")
          .select("id, handle, full_name, avatar_url, banner_url, bio, socials")
          .eq("handle", normalized)
          .maybeSingle();

        if (!alive) return;

        if (error) throw error;
        if (!data) {
          setErrTop("Profile not found.");
          setLoading(false);
          return;
        }

        setCreator(data as any);
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

      const followingRes = await supabase
        .from("follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", creator.id);

      if (!alive) return;

      setFollowers(followersRes.count ?? 0);
      setFollowing(followingRes.count ?? 0);

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
    };

    run();
    return () => {
      alive = false;
    };
  }, [creator?.id, supabase, viewerId]);

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

  const uploadProfileMedia = async (kind: "avatar" | "banner", file: File) => {
    if (!creator?.id) return;
    if (!isOwner) return;

    if (!file.type.startsWith("image/")) {
      setUploadErr("Please upload an image file.");
      return;
    }

    setUploadErr(null);
    setUploadBusy(kind);

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `profiles/${creator.id}/${kind}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("profile-media")
        .upload(path, file, { upsert: true });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("profile-media").getPublicUrl(path);
      const publicUrl = pub?.publicUrl || null;
      if (!publicUrl) throw new Error("Failed to get public URL");

      const patch = kind === "avatar" ? { avatar_url: publicUrl } : { banner_url: publicUrl };

      const { error: dbErr } = await supabase.from("profiles").update(patch).eq("id", creator.id);
      if (dbErr) throw dbErr;

      setCreator((c) => {
        if (!c) return c;
        return kind === "avatar" ? { ...c, avatar_url: publicUrl } : { ...c, banner_url: publicUrl };
      });
    } catch (e: any) {
      setUploadErr(e?.message || "Upload failed");
    } finally {
      setUploadBusy(null);
    }
  };

  const saveProfile = async () => {
    if (!creator?.id) return;
    if (!isOwner) return;

    setSaving(true);
    setSaveErr(null);

    try {
      const normalizedHandle = normalizeHandle(draftHandle);
      const handleChanged = normalizedHandle && normalizedHandle !== (creator.handle || "").toLowerCase();

      if (handleChanged) {
        if (!HANDLE_REGEX.test(normalizedHandle)) {
          setSaveErr("Handle must be 3–24 characters, only letters, numbers, and underscores.");
          setSaving(false);
          return;
        }
        const res = await fetch(
          `/api/handle-available?handle=${encodeURIComponent(normalizedHandle)}&exclude_user_id=${encodeURIComponent(viewerId ?? "")}`
        );
        const data = await res.json();
        if (!data.available) {
          setSaveErr(data.reason === "invalid" ? "Invalid handle format." : "That handle is already taken.");
          setSaving(false);
          return;
        }
        const result = await auth.updateProfile({ handle: normalizedHandle });
        if (!result.ok) {
          setSaveErr(result.error ?? "Failed to update handle.");
          setSaving(false);
          return;
        }
      }

      const socials: Record<string, string> = {};
      Object.entries(draftSocials || {}).forEach(([k, v]) => {
        const u = sanitizeUrl(v || "");
        if (u) socials[k] = u;
      });

      const patch: Record<string, unknown> = {
        full_name: (draftName || "").trim() || null,
        bio: (draftBio || "").trim() || null,
        socials,
      };

      const { error } = await supabase.from("profiles").update(patch).eq("id", creator.id);
      if (error) throw error;

      setCreator((c) => (c ? { ...c, ...patch, ...(handleChanged && normalizedHandle ? { handle: normalizedHandle } : {}) } : c));
      setEditOpen(false);
      if (handleChanged && normalizedHandle) {
        router.replace(`/profile/${encodeURIComponent(normalizedHandle)}`);
      }
    } catch (e: any) {
      setSaveErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = creator?.avatar_url || DEFAULT_AVATAR_SRC;
  const bannerSrc = creator?.banner_url || "";

  const socials = Object.entries(creator?.socials || {})
    .map(([k, v]) => [k, sanitizeUrl(v || "")] as const)
    .filter(([_, v]) => !!v)
    .slice(0, 6);

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
    <div className="flex h-screen flex-col bg-[#050505] text-white" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* Banner */}
        <div className="relative w-full overflow-hidden border-b border-white/10 bg-black">
          <div className="relative h-[240px] w-full sm:h-[300px] lg:h-[360px]">
            {bannerSrc ? (
              <Image src={bannerSrc} alt="Banner" fill className="object-cover" priority />
            ) : (
              <div className="absolute inset-0 bg-[#0b0b0b]">
                <div className="absolute inset-0 opacity-[0.92] [background-image:radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.20),transparent_46%),radial-gradient(circle_at_82%_30%,rgba(236,72,153,0.18),transparent_56%)]" />
                <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

            {isOwner && (
              <>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadProfileMedia("banner", f);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className={cn(
                    "absolute right-4 top-4 z-10",
                    "h-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4",
                    "text-xs font-semibold text-white/90 backdrop-blur-md",
                    "hover:bg-black/75 hover:border-white/25 transition-all active:scale-[0.98] shadow-lg"
                  )}
                  disabled={uploadBusy === "banner"}
                >
                  {uploadBusy === "banner" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pencil className="h-4 w-4" />
                  )}
                  Edit Banner
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <div className="mx-auto w-full max-w-[1320px]">
          {(errTop || uploadErr) && (
            <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {uploadErr ? `Upload: ${uploadErr}` : errTop}
            </div>
          )}

          {/* Header */}
          <div
            className={cn(
              "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md",
              "px-6 py-8 sm:px-10 sm:py-10 shadow-[0_8px_48px_rgba(0,0,0,0.6)]"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-pink-500/8 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.12),transparent_50%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.08),transparent_50%)] pointer-events-none" />
            
            <div className="relative flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-white/25 bg-black/50 shadow-[0_8px_32px_rgba(0,0,0,0.6)] sm:h-32 sm:w-32 ring-4 ring-white/5">
                      <Image src={avatarSrc} alt="Avatar" fill className="object-cover" />
                    </div>

                    {isOwner && (
                      <>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadProfileMedia("avatar", f);
                            e.currentTarget.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          className={cn(
                            "absolute -bottom-1 -right-1",
                            "h-10 w-10 rounded-full border-2 border-white/20 bg-black/70 backdrop-blur-md",
                            "flex items-center justify-center text-white/90 shadow-lg",
                            "hover:bg-black/85 hover:border-white/30 transition-all active:scale-[0.95]"
                          )}
                          disabled={uploadBusy === "avatar"}
                          title="Change avatar"
                        >
                          {uploadBusy === "avatar" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 min-w-0 mb-3">
                      <h1 className="flex flex-wrap items-center gap-2 min-w-0 text-2xl font-bold text-white sm:text-3xl tracking-tight">
                        <span className="min-w-0 truncate">{creator.full_name || "Unnamed creator"}</span>
                        <FoundingCreatorBadge size="lg" className="shrink-0" />
                      </h1>
                      <div className="shrink-0 rounded-full border border-white/20 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
                        @{creator.handle}
                      </div>
                    </div>

                    {creator.bio ? (
                      <p className="mt-2 text-sm leading-relaxed text-white/70 sm:text-base">
                        {creator.bio}
                      </p>
                    ) : isOwner ? (
                      <p className="mt-2 text-sm text-white/45 italic">
                        Add a bio so people understand what you build.
                      </p>
                    ) : null}

                    {socials.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-3">
                        {socials.map(([k, v]) => {
                          const displayName = k.toLowerCase() === "twitter" ? "X" : k;
                          return (
                            <a
                              key={k}
                              href={v}
                              target="_blank"
                              rel="noreferrer"
                              className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10 hover:border-white/25 hover:text-white transition-all duration-200 backdrop-blur-sm shadow-sm hover:shadow-md"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-white/60 group-hover:text-white/80 transition-colors" />
                              <span>{displayName}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={onFollowToggle}
                      disabled={followBusy}
                      className={cn(
                        "h-10 px-5 rounded-full border text-sm font-semibold transition-all active:scale-[0.98]",
                        isFollowing
                          ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                          : "border-white/10 bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black hover:brightness-110 shadow-[0_0_20px_rgba(56,189,248,0.4)]",
                        "min-w-[120px]"
                      )}
                    >
                      {followBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : isFollowing ? (
                        "Following"
                      ) : (
                        "Follow"
                      )}
                    </button>
                  )}

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftName(creator.full_name || "");
                        setDraftHandle(creator.handle || "");
                        setDraftBio(creator.bio || "");
                        setDraftSocials((creator.socials || {}) as any);
                        setEditOpen(true);
                      }}
                      className={cn(
                        PILL,
                        "border-white/15 bg-white/5 text-white/85 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="rounded-full border border-white/15 bg-white/[0.05] px-6 py-2.5 font-medium text-white/90 backdrop-blur-sm shadow-sm">
                  <span className="font-bold text-white">{followers}</span>{" "}
                  <span className="text-white/70">followers</span>
                </div>
                <div className="rounded-full border border-white/15 bg-white/[0.05] px-6 py-2.5 font-medium text-white/90 backdrop-blur-sm shadow-sm">
                  <span className="font-bold text-white">{following}</span>{" "}
                  <span className="text-white/70">following</span>
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
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:border-white/15 hover:text-white/85"
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
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:border-white/15 hover:text-white/85"
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
                  // Prefer edgaze code route when available (matches marketplace UX)
                  const code = (it.edgaze_code || "").trim();
                  const open =
                    code && creator.handle
                      ? () => router.push(`/p/${creator.handle}/${code}`)
                      : () =>
                          router.push(
                            `/${it.type === "prompt" ? "prompts" : "workflows"}/${it.id}`
                          );

                  return (
                    <PromptCard
                      key={`${it.type}-${it.id}`}
                      prompt={it}
                      creator={creator}
                      currentUserId={viewerId}
                      requireAuth={auth.requireAuth}
                      supabase={supabase}
                      onOpen={open}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>
      </main>

      {/* Edit sheet */}
      {editOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-3xl rounded-t-3xl border border-gray-600/50 bg-[#0b0b0b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-600/50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-white">Edit profile</div>
                <div className="text-[11px] text-white/50">Name, handle, bio, and social links</div>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className={cn(PILL, PILL_INACTIVE)}
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
              {saveErr && (
                <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                  {saveErr}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] text-white/60">Name</label>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="mt-1 h-11 w-full rounded-2xl border border-gray-600/50 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-white/60">Handle</label>
                  <input
                    value={draftHandle}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().slice(0, 24);
                      setDraftHandle(v);
                    }}
                    placeholder="handle"
                    className="mt-1 h-11 w-full rounded-2xl border border-gray-600/50 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-[11px] text-white/60">Bio</label>
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-gray-600/50 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
                  placeholder="What do you build?"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-gray-600/50 bg-white/[0.03] p-4">
                <div className="text-xs font-semibold text-white/80">Social links</div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {["twitter", "linkedin", "youtube", "website", "github", "instagram"].map((k) => {
                    const displayLabel = k.toLowerCase() === "twitter" ? "X" : k.charAt(0).toUpperCase() + k.slice(1);
                    return (
                      <div key={k}>
                        <label className="text-[11px] text-white/55">{displayLabel}</label>
                        <input
                          value={draftSocials?.[k] || ""}
                          onChange={(e) =>
                            setDraftSocials((p) => ({ ...(p || {}), [k]: e.target.value }))
                          }
                          className="mt-1 h-11 w-full rounded-2xl border border-gray-600/50 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                          placeholder="https://"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className={cn(PILL, PILL_INACTIVE)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveProfile}
                  className={cn(PILL, CTA_GRADIENT, "min-w-[120px]")}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
