"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Pencil, Loader2, Camera } from "lucide-react";
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

function extFromName(name: string) {
  const p = name.split(".").pop();
  return (p || "jpg").toLowerCase();
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

type Tab = "all" | "prompts" | "workflows";
type Sort = "newest" | "popular" | "oldest";

const DEFAULT_AVATAR_SRC = "/profile/default-avatar.png"; // /public/profile/default-avatar.png

export default function PublicProfileView({ handle }: { handle: string }) {
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
  const [listings, setListings] = useState<
    Array<{ id: string; title: string; type: "prompt" | "workflow"; popularityLabel?: string }>
  >([]);

  // Upload state
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadBusy, setUploadBusy] = useState<"avatar" | "banner" | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const lastFollowAtRef = useRef<number>(0);

  // Tighter system
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

      const res = await supabase
        .from("profiles")
        .select("id,handle,full_name,avatar_url,banner_url,bio,socials")
        .eq("handle", normalized)
        .maybeSingle();

      if (!alive) return;

      if (res.error) {
        setErrTop(res.error.message || "Failed to fetch profile");
        setLoading(false);
        return;
      }

      if (!res.data) {
        setErrTop("Profile not found.");
        setLoading(false);
        return;
      }

      const row = res.data as PublicProfileRow;
      setCreator(row);

      setDraftName(row.full_name || "");
      setDraftBio(row.bio || "");
      setDraftSocials(row.socials || {});

      setLoading(false);
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
        setFollowers((v) => Math.max(0, v - 1));
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: auth.userId,
          following_id: creator.id,
        });

        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (msg.includes("duplicate") || msg.includes("unique")) {
            setIsFollowing(true);
          } else {
            throw error;
          }
        } else {
          setIsFollowing(true);
          setFollowers((v) => v + 1);
        }
      }
    } catch (e: any) {
      setErrTop(e?.message || "Follow failed");
    } finally {
      setFollowBusy(false);
    }
  };

  const saveEdits = async () => {
    if (!isOwner) return;

    setSaving(true);
    setSaveErr(null);

    const socials: Record<string, string> = {};
    for (const [k, v] of Object.entries(draftSocials || {})) {
      const url = sanitizeUrl(v || "");
      if (url) socials[k] = url;
    }

    const res = await auth.updateProfile({
      full_name: draftName || null,
      bio: draftBio || null,
      socials: Object.keys(socials).length ? socials : null,
    } as any);

    if (!res.ok) {
      setSaveErr(res.error || "Failed to save");
      setSaving(false);
      return;
    }

    const refetch = await supabase
      .from("profiles")
      .select("id,handle,full_name,avatar_url,banner_url,bio,socials")
      .eq("id", auth.userId!)
      .maybeSingle();

    if (refetch.data) setCreator(refetch.data as PublicProfileRow);

    setEditOpen(false);
    setSaving(false);
  };

  const uploadProfileMedia = async (kind: "avatar" | "banner", file: File) => {
    setUploadErr(null);
    if (!isOwner) return;
    if (!auth.userId) return;
    if (!isImage(file)) {
      setUploadErr("Only image files are allowed.");
      return;
    }

    const maxBytes = kind === "avatar" ? 4 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadErr(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB.`);
      return;
    }

    setUploadBusy(kind);
    try {
      const bucket = "profile-media";
      const ext = extFromName(file.name);
      const path =
        kind === "avatar"
          ? `avatars/${auth.userId}/${crypto.randomUUID()}.${ext}`
          : `banners/${auth.userId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const patch = kind === "avatar" ? { avatar_url: publicUrl } : { banner_url: publicUrl };
      const res = await auth.updateProfile(patch as any);
      if (!res.ok) throw new Error(res.error || "Failed to update profile");

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
    <div className="w-full">
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
      <div className="w-full px-4 sm:px-6">
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
              {/* Top row: avatar + name + edit */}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">
                        {creator.full_name || creator.handle}
                      </h1>
                      <span className="h-8 inline-flex items-center rounded-full border border-white/12 bg-white/5 px-3 text-[11px] text-white/70">
                        @{creator.handle}
                      </span>
                    </div>

                    {creator.bio ? (
                      <p className="mt-1 text-sm text-white/80 leading-relaxed">
                        {creator.bio}
                      </p>
                    ) : isOwner ? (
                      <p className="mt-1 text-sm text-white/45">
                        Add a bio so people understand what you build.
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-2">
                      {socials.map(([k, v]) => (
                        <a
                          key={k}
                          href={v}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(PILL, PILL_INACTIVE)}
                        >
                          <span className="capitalize">{k}</span>
                        </a>
                      ))}

                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => setEditOpen(true)}
                          className={cn(PILL, PILL_INACTIVE)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop metrics (compact) */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center">
                    <div className="text-base font-semibold text-white">{followers}</div>
                    <div className="text-[10px] text-white/55">Followers</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center">
                    <div className="text-base font-semibold text-white">{following}</div>
                    <div className="text-[10px] text-white/55">Following</div>
                  </div>
                </div>
              </div>

              {/* Full-width Follow button (UI width) */}
              {!isOwner && (
                <button
                  type="button"
                  disabled={followBusy}
                  onClick={onFollowToggle}
                  className={cn(
                    "h-11 w-full rounded-full px-6 text-sm font-semibold transition active:scale-[0.99]",
                    isFollowing
                      ? "border border-white/14 bg-black text-white hover:bg-black/80"
                      : cn("border border-white/0", CTA_GRADIENT),
                    followBusy && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {followBusy ? "..." : isFollowing ? "Following" : "Follow"}
                </button>
              )}

              {/* Mobile metrics */}
              <div className="sm:hidden grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center">
                  <div className="text-base font-semibold text-white">{followers}</div>
                  <div className="text-[10px] text-white/55">Followers</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center">
                  <div className="text-base font-semibold text-white">{following}</div>
                  <div className="text-[10px] text-white/55">Following</div>
                </div>
              </div>
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
          <div className="mt-4 pb-10">
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
                {listings.map((it) => (
                  <a
                    key={`${it.type}-${it.id}`}
                    href={`/${it.type === "prompt" ? "prompts" : "workflows"}/${it.id}`}
                    className={cn(
                      "group overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition",
                      "hover:border-white/20 hover:bg-white/10",
                      "active:scale-[0.995]"
                    )}
                  >
                    <div className="relative aspect-[16/10] w-full bg-black/40">
                      <div className="absolute inset-0 opacity-[0.14] [background-image:radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.16),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.14),transparent_50%)]" />
                      <div className="absolute inset-0 opacity-[0.20] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
                      <div className="absolute inset-0 bg-black/15 group-hover:bg-black/10 transition" />
                    </div>

                    <div className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-[11px] text-white/75">
                          {it.type === "prompt" ? "Prompt" : "Workflow"}
                        </span>
                        {it.popularityLabel && (
                          <span className="text-[11px] text-white/55">{it.popularityLabel}</span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-white/90 line-clamp-2">
                        {it.title || "Untitled"}
                      </div>
                      <div className="mt-2 text-xs text-white/55">@{creator.handle}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit sheet (mobile-friendly, not giant) */}
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
                  className="mt-1 min-h-[96px] w-full rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                  placeholder="What do you make on Edgaze?"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white/85">Social links</p>
                  <p className="text-[10px] text-white/45">Valid links only</p>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["website", "Website"],
                    ["instagram", "Instagram"],
                    ["x", "X"],
                    ["youtube", "YouTube"],
                    ["linkedin", "LinkedIn"],
                    ["github", "GitHub"],
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-[11px] text-white/55">{label}</label>
                      <input
                        value={draftSocials[k] || ""}
                        onChange={(e) => setDraftSocials((s) => ({ ...s, [k]: e.target.value }))}
                        className="mt-1 h-11 w-full rounded-2xl border border-white/12 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                        placeholder="https://"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className={cn(PILL, PILL_INACTIVE)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdits}
                disabled={saving}
                className={cn(
                  "h-11 rounded-full px-6 text-sm font-semibold transition active:scale-[0.99]",
                  CTA_GRADIENT,
                  saving && "opacity-70 cursor-not-allowed"
                )}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
