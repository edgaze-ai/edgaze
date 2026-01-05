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

const DEFAULT_AVATAR_SRC = "/profile/default-avatar.png"; // /public/profile/default-avatar.png

function normalizeHandle(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 24);
}

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

  // @ts-expect-error Intl types vary in older TS libs
  return rtf.format(v, u);
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

function BlurredFallback({ text }: { text: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black/55">
      <div className="absolute inset-0 opacity-[0.92] [background-image:radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.20),transparent_46%),radial-gradient(circle_at_82%_30%,rgba(236,72,153,0.18),transparent_56%)]" />
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
        <div className="line-clamp-2 text-sm font-semibold tracking-tight text-white/85">
          {text}
        </div>
      </div>
    </div>
  );
}

function MarketplaceStyleCard({
  it,
  creator,
  onOpen,
}: {
  it: CreatorListing;
  creator: PublicProfileRow;
  onOpen: () => void;
}) {
  const { badge, glow } = badgeClassFor(it.type);
  const views =
    (typeof it.views_count === "number" ? it.views_count : null) ??
    (typeof it.view_count === "number" ? it.view_count : null) ??
    0;

  const likes =
    (typeof it.likes_count === "number" ? it.likes_count : null) ??
    (typeof it.like_count === "number" ? it.like_count : null) ??
    0;

  const desc = clampText(it.description || it.prompt_text || "", 140);
  const code = (it.edgaze_code || "").trim();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.995]"
    >
      <div className="relative overflow-hidden rounded-2xl">
        {it.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={it.thumbnail_url}
            alt={it.title || "Listing thumbnail"}
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
        ) : (
          <BlurredFallback text={it.prompt_text || it.title || "EDGAZE"} />
        )}

        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur",
              badge,
              glow
            )}
          >
            {it.type === "workflow" ? "Workflow" : "Prompt"}
          </span>

          <span className="rounded-full border border-white/12 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur">
            {priceLabelFor(it)}
          </span>
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/12 bg-black/40">
          <Image
            src={creator.avatar_url || DEFAULT_AVATAR_SRC}
            alt="Avatar"
            fill
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white/95">
            {it.title || "Untitled listing"}
          </h3>

          <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
            <span className="truncate">{creator.full_name || `@${creator.handle}`}</span>
            <span className="shrink-0 text-white/35">@{creator.handle}</span>
          </div>

          {desc ? (
            <div className="mt-2 line-clamp-2 text-[12px] leading-snug text-white/55">
              {desc}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between text-[11px] text-white/55">
            <div className="flex items-center gap-2">
              {code ? (
                <span className="rounded-md bg-white/10 px-2 py-[3px] text-[10px] font-semibold text-white/85">
                  /{code}
                </span>
              ) : (
                <span className="rounded-md bg-white/5 px-2 py-[3px] text-[10px] text-white/60">
                  No code
                </span>
              )}
              <span className="text-white/35">•</span>
              <span>{formatRelativeTime(it.created_at || null)}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-white/40" />
                {views}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-white/40" />
                {likes}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
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
      const socials: Record<string, string> = {};
      Object.entries(draftSocials || {}).forEach(([k, v]) => {
        const u = sanitizeUrl(v || "");
        if (u) socials[k] = u;
      });

      const patch = {
        full_name: (draftName || "").trim() || null,
        bio: (draftBio || "").trim() || null,
        socials,
      };

      const { error } = await supabase.from("profiles").update(patch).eq("id", creator.id);
      if (error) throw error;

      setCreator((c) => (c ? { ...c, ...patch } : c));
      setEditOpen(false);
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
    // IMPORTANT: this forces scroll back on even if parent layout uses overflow-hidden
    <div className="h-[100dvh] w-full overflow-y-auto overscroll-contain">
      {/* Banner */}
      <div className="relative w-full overflow-hidden border-b border-white/10 bg-black">
        <div className="relative h-[210px] w-full sm:h-[280px] lg:h-[320px]">
          {bannerSrc ? (
            <Image src={bannerSrc} alt="Banner" fill className="object-cover" priority />
          ) : (
            <div className="absolute inset-0 bg-[#0b0b0b]">
              <div className="absolute inset-0 opacity-[0.92] [background-image:radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.20),transparent_46%),radial-gradient(circle_at_82%_30%,rgba(236,72,153,0.18),transparent_56%)]" />
              <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
            </div>
          )}

          <div className="absolute inset-0 bg-black/30" />

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
                  "absolute right-3 top-3 z-10",
                  "h-9 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-4",
                  "text-xs font-semibold text-white/85 backdrop-blur",
                  "hover:bg-black/60 hover:border-white/20 transition active:scale-[0.98]"
                )}
                disabled={uploadBusy === "banner"}
              >
                {uploadBusy === "banner" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
                Banner
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 pb-14">
        <div className="mx-auto w-full max-w-[1320px]">
          {(errTop || uploadErr) && (
            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {uploadErr ? `Upload: ${uploadErr}` : errTop}
            </div>
          )}

          {/* Header */}
          <div
            className={cn(
              "mt-4 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur",
              "px-4 py-4 sm:px-5 sm:py-5"
            )}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/18 bg-black/40 sm:h-24 sm:w-24">
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
                            "absolute -bottom-2 -right-2",
                            "h-9 w-9 rounded-full border border-white/14 bg-black/60 backdrop-blur",
                            "flex items-center justify-center text-white/90",
                            "hover:bg-black/80 hover:border-white/25 transition active:scale-[0.98]"
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

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="truncate text-lg font-semibold text-white/95">
                        {creator.full_name || "Unnamed creator"}
                      </div>
                      <div className="shrink-0 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] text-white/70">
                        @{creator.handle}
                      </div>
                    </div>

                    {creator.bio ? (
                      <div className="mt-2 text-sm leading-relaxed text-white/70">
                        {creator.bio}
                      </div>
                    ) : isOwner ? (
                      <div className="mt-2 text-sm text-white/45">
                        Add a bio so people understand what you build.
                      </div>
                    ) : null}

                    {socials.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {socials.map(([k, v]) => (
                          <a
                            key={k}
                            href={v}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/25 px-3 py-1.5 text-[11px] text-white/75 hover:bg-black/35 hover:border-white/20 transition"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-white/45" />
                            {k}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={onFollowToggle}
                      disabled={followBusy}
                      className={cn(
                        PILL,
                        isFollowing
                          ? "border-white/18 bg-white/10 text-white hover:bg-white/12"
                          : cn("border-white/10", CTA_GRADIENT),
                        "min-w-[110px]"
                      )}
                    >
                      {followBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
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
                        setDraftBio(creator.bio || "");
                        setDraftSocials((creator.socials || {}) as any);
                        setEditOpen(true);
                      }}
                      className={cn(PILL, PILL_INACTIVE)}
                    >
                      <Pencil className="h-4 w-4 mr-2 text-white/60" />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                  {followers} followers
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                  {following} following
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

          {/* Tabs + sort */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["all", "prompts", "workflows"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(PILL, tab === t ? PILL_ACTIVE : PILL_INACTIVE)}
                >
                  {t === "all" ? "All" : t === "prompts" ? "Prompts" : "Workflows"}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {(["newest", "popular", "oldest"] as Sort[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  className={cn(
                    PILL,
                    sort === s ? "border-cyan-400/45 bg-cyan-400/10 text-white" : PILL_INACTIVE
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
          <div className="mt-4">
            {listingsLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : listings.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                No uploads found for this creator yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    <MarketplaceStyleCard
                      key={`${it.type}-${it.id}`}
                      it={it}
                      creator={creator}
                      onOpen={open}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit sheet */}
      {editOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-3xl rounded-t-3xl border border-white/12 bg-[#0b0b0b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-white">Edit profile</div>
                <div className="text-[11px] text-white/50">Handle editing disabled.</div>
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
                    className="mt-1 h-11 w-full rounded-2xl border border-white/12 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-white/60">Handle</label>
                  <input
                    value={`@${creator.handle}`}
                    disabled
                    className="mt-1 h-11 w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/50 outline-none"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-[11px] text-white/60">Bio</label>
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
                  placeholder="What do you build?"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs font-semibold text-white/80">Social links</div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {["twitter", "linkedin", "youtube", "website", "github", "instagram"].map((k) => (
                    <div key={k}>
                      <label className="text-[11px] text-white/55">{k}</label>
                      <input
                        value={draftSocials?.[k] || ""}
                        onChange={(e) =>
                          setDraftSocials((p) => ({ ...(p || {}), [k]: e.target.value }))
                        }
                        className="mt-1 h-11 w-full rounded-2xl border border-white/12 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                        placeholder="https://"
                      />
                    </div>
                  ))}
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
