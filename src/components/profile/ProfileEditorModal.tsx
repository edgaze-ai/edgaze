"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { DEFAULT_AVATAR_SRC } from "../../config/branding";
import { useAuth, type Profile } from "../auth/AuthContext";
import {
  ACCEPTED_TYPES,
  MEDIA_CONFIG,
  measureImage,
  normalizeMimeType,
  type LocalAsset,
  type MediaKind,
  uploadPreparedProfileMedia,
} from "./profileMediaCore";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function revokeObjectUrl(url?: string | null) {
  if (!url) return;
  if (!url.startsWith("blob:")) return;
  URL.revokeObjectURL(url);
}

type CreatorSnapshot = {
  id: string;
  full_name: string | null;
  handle: string;
  bio: string | null;
  socials: Record<string, string> | null;
  avatar_url: string | null;
  banner_url: string | null;
};

export type ProfileEditorOpenOptions = {
  /** Scroll to banner or avatar section when opening */
  focusMedia?: MediaKind | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Call when opening from profile page (e.g. banner vs generic edit). */
  openOptions?: ProfileEditorOpenOptions;
  creator: CreatorSnapshot;
  workspaceViewerId: string | null;
  /** Max display name length (must match profile / PublicProfileView). */
  profileFullNameMax: number;
  normalizeHandle: (s: string) => string;
  sanitizeUrl: (s: string) => string;
  handleRegex: RegExp;
  onPublished: (updates: Partial<CreatorSnapshot>) => void;
  router: { replace: (path: string) => void };
};

export default function ProfileEditorModal({
  open,
  onClose,
  openOptions,
  creator,
  workspaceViewerId,
  profileFullNameMax,
  normalizeHandle,
  sanitizeUrl,
  handleRegex,
  onPublished,
  router,
}: Props) {
  const auth = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const bannerSectionRef = useRef<HTMLDivElement | null>(null);
  const avatarSectionRef = useRef<HTMLDivElement | null>(null);

  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const editorOpenInitializedRef = useRef(false);

  const [publishing, setPublishing] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [draftName, setDraftName] = useState("");
  const [draftHandle, setDraftHandle] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftSocials, setDraftSocials] = useState<Record<string, string>>({});

  const [selectingKind, setSelectingKind] = useState<MediaKind | null>(null);
  const [bannerAsset, setBannerAsset] = useState<LocalAsset | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<LocalAsset | null>(null);
  const [bannerCrop, setBannerCrop] = useState({ x: 0, y: 0 });
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0 });
  const [bannerZoom, setBannerZoom] = useState(1);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [bannerAreaPixels, setBannerAreaPixels] = useState<Area | null>(null);
  const [avatarAreaPixels, setAvatarAreaPixels] = useState<Area | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setPublishing(false);
    setSaveErr(null);
    setSelectingKind(null);
    setBannerAsset((p) => {
      if (p?.objectUrl) revokeObjectUrl(p.objectUrl);
      return null;
    });
    setAvatarAsset((p) => {
      if (p?.objectUrl) revokeObjectUrl(p.objectUrl);
      return null;
    });
    setBannerCrop({ x: 0, y: 0 });
    setAvatarCrop({ x: 0, y: 0 });
    setBannerZoom(1);
    setAvatarZoom(1);
    setBannerAreaPixels(null);
    setAvatarAreaPixels(null);
    setBannerNotice(null);
    setAvatarNotice(null);
  }, []);

  useEffect(() => {
    if (!open) {
      editorOpenInitializedRef.current = false;
      return;
    }
    if (editorOpenInitializedRef.current) return;
    editorOpenInitializedRef.current = true;
    resetAll();
    setDraftName((creator.full_name || "").slice(0, profileFullNameMax));
    setDraftHandle(creator.handle || "");
    setDraftBio(creator.bio || "");
    setDraftSocials({ ...(creator.socials || {}) });
  }, [open, creator, profileFullNameMax, resetAll]);

  useEffect(() => {
    if (open) return;
    setBannerAsset((prev) => {
      if (prev?.objectUrl) revokeObjectUrl(prev.objectUrl);
      return null;
    });
    setAvatarAsset((prev) => {
      if (prev?.objectUrl) revokeObjectUrl(prev.objectUrl);
      return null;
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const focus = openOptions?.focusMedia;
    const id = window.setTimeout(() => {
      if (focus === "banner")
        bannerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (focus === "avatar")
        avatarSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(id);
  }, [open, openOptions?.focusMedia]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !publishing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, publishing]);

  const handleSelectFile = useCallback(async (kind: MediaKind, file: File) => {
    const config = MEDIA_CONFIG[kind];
    const mimeType = normalizeMimeType(file);

    if (!ACCEPTED_TYPES.has(file.type)) {
      setSaveErr(`${config.title} must be PNG or JPG.`);
      return;
    }

    setSaveErr(null);
    setSelectingKind(kind);
    const objectUrl = URL.createObjectURL(file);

    try {
      const dimensions = await measureImage(objectUrl);

      if (kind === "avatar" && (dimensions.width < 400 || dimensions.height < 400)) {
        revokeObjectUrl(objectUrl);
        setSaveErr("Profile photo must be at least 400 × 400 px.");
        return;
      }

      let notice: string | null = null;
      if (kind === "banner" && (dimensions.width < 1500 || dimensions.height < 500)) {
        notice = "This banner is smaller than 1500 × 500 px and may look softer on large screens.";
      }
      if (kind === "avatar" && (dimensions.width < 1024 || dimensions.height < 1024)) {
        notice = "This photo is smaller than 1024 × 1024 px and may look softer on sharp displays.";
      }

      const asset: LocalAsset = {
        file: new File([file], file.name, { type: mimeType }),
        objectUrl,
      };

      if (kind === "banner") {
        setBannerAsset((prev) => {
          if (prev?.objectUrl) revokeObjectUrl(prev.objectUrl);
          return asset;
        });
        setBannerCrop({ x: 0, y: 0 });
        setBannerZoom(1);
        setBannerAreaPixels(null);
        setBannerNotice(notice);
      } else {
        setAvatarAsset((prev) => {
          if (prev?.objectUrl) revokeObjectUrl(prev.objectUrl);
          return asset;
        });
        setAvatarCrop({ x: 0, y: 0 });
        setAvatarZoom(1);
        setAvatarAreaPixels(null);
        setAvatarNotice(notice);
      }
    } catch (e: unknown) {
      revokeObjectUrl(objectUrl);
      setSaveErr(e instanceof Error ? e.message : "Unable to load that image.");
    } finally {
      setSelectingKind(null);
    }
  }, []);

  const socialsDirty = useMemo(() => {
    const a = draftSocials || {};
    const b = creator.socials || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (sanitizeUrl(a[k] || "") !== sanitizeUrl(b[k] || "")) return true;
    }
    return false;
  }, [creator.socials, draftSocials, sanitizeUrl]);

  const textDirty =
    (draftName || "").trim() !== (creator.full_name || "").trim() ||
    normalizeHandle(draftHandle) !== normalizeHandle(creator.handle || "") ||
    (draftBio || "").trim() !== (creator.bio || "").trim() ||
    socialsDirty;

  const mediaDirty = Boolean(bannerAsset || avatarAsset);

  const canPublish = textDirty || mediaDirty || false;

  const clearBanner = () => {
    setBannerAsset((prev) => {
      if (prev?.objectUrl) revokeObjectUrl(prev.objectUrl);
      return null;
    });
    setBannerAreaPixels(null);
    setBannerNotice(null);
  };

  const clearAvatar = () => {
    setAvatarAsset((prev) => {
      if (prev?.objectUrl) revokeObjectUrl(prev.objectUrl);
      return null;
    });
    setAvatarAreaPixels(null);
    setAvatarNotice(null);
  };

  const publish = async () => {
    if (!creator?.id) return;
    setSaveErr(null);
    setPublishing(true);

    try {
      if (bannerAsset && !bannerAreaPixels) {
        setSaveErr("Finish positioning your banner (pinch/zoom) before publishing.".trim());
        setPublishing(false);
        return;
      }
      if (avatarAsset && !avatarAreaPixels) {
        setSaveErr("Finish positioning your profile photo before publishing.");
        setPublishing(false);
        return;
      }

      const normalizedHandle = normalizeHandle(draftHandle);
      const handleChanged =
        normalizedHandle && normalizedHandle !== (creator.handle || "").toLowerCase();

      if (handleChanged) {
        if (!handleRegex.test(normalizedHandle)) {
          setSaveErr("Handle must be 3–24 characters, letters, numbers, and underscores only.");
          setPublishing(false);
          return;
        }
        const res = await fetch(
          `/api/handle-available?handle=${encodeURIComponent(normalizedHandle)}&exclude_user_id=${encodeURIComponent(workspaceViewerId ?? "")}`,
        );
        const data = await res.json();
        if (!data.available) {
          setSaveErr(
            data.reason === "invalid" ? "Invalid handle format." : "That handle is already taken.",
          );
          setPublishing(false);
          return;
        }
        const hr = await auth.updateProfile({ handle: normalizedHandle });
        if (!hr.ok) {
          setSaveErr(hr.error ?? "Failed to update handle.");
          setPublishing(false);
          return;
        }
      }

      let avatarUrl: string | undefined;
      let bannerUrl: string | undefined;

      if (bannerAsset && bannerAreaPixels) {
        bannerUrl = await uploadPreparedProfileMedia(
          supabase,
          creator.id,
          "banner",
          bannerAsset,
          bannerAreaPixels,
        );
      }
      if (avatarAsset && avatarAreaPixels) {
        avatarUrl = await uploadPreparedProfileMedia(
          supabase,
          creator.id,
          "avatar",
          avatarAsset,
          avatarAreaPixels,
        );
      }

      const socials: Record<string, string> = {};
      Object.entries(draftSocials || {}).forEach(([k, v]) => {
        const u = sanitizeUrl(v || "");
        if (u) socials[k] = u;
      });

      const patch: Partial<Profile> = {
        full_name: (draftName || "").trim().slice(0, profileFullNameMax) || null,
        bio: (draftBio || "").trim() || null,
        socials,
        ...(bannerUrl !== undefined ? { banner_url: bannerUrl } : {}),
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      };

      const result = await auth.updateProfile({
        ...(handleChanged && normalizedHandle ? { handle: normalizedHandle } : {}),
        ...patch,
      });

      if (!result.ok) throw new Error(result.error || "Publish failed");

      onPublished({
        full_name: patch.full_name ?? null,
        bio: patch.bio ?? null,
        socials: patch.socials ?? null,
        ...(handleChanged && normalizedHandle ? { handle: normalizedHandle } : {}),
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
        ...(bannerUrl !== undefined ? { banner_url: bannerUrl } : {}),
      });

      resetAll();
      onClose();

      if (handleChanged && normalizedHandle) {
        router.replace(`/profile/${encodeURIComponent(normalizedHandle)}`);
      }
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  if (!open) return null;

  const previewBanner = bannerAsset?.objectUrl || (creator.banner_url ? creator.banner_url : "");
  const previewAvatar = avatarAsset?.objectUrl || creator.avatar_url || DEFAULT_AVATAR_SRC;

  if (!portalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#030303]">
      <header className="safe-area-pb-0 flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4">
        <button
          type="button"
          onClick={() => void publish()}
          disabled={!canPublish || publishing}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition",
            "border border-white/15 bg-white text-black",
            "hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {publishing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Publishing…
            </>
          ) : (
            "Publish changes"
          )}
        </button>

        <button
          type="button"
          onClick={() => !publishing && onClose()}
          disabled={publishing}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/85 transition hover:bg-white/[0.08] disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
          {saveErr && (
            <div className="mb-6 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {saveErr}
            </div>
          )}

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Visuals
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Replace your banner or photo only when needed — cropping appears after you choose a
              new image.
            </p>

            <div ref={bannerSectionRef} className="mt-6 space-y-3 scroll-mt-24">
              <div className="text-sm font-medium text-white/90">Banner</div>
              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] ring-1 ring-white/[0.05]">
                <div
                  className={cn(
                    "relative overflow-hidden bg-[#080808]",
                    bannerAsset?.objectUrl
                      ? "aspect-[3/1] min-h-[160px]"
                      : "aspect-[3/1] min-h-[140px]",
                  )}
                >
                  {bannerAsset?.objectUrl ? (
                    <Cropper
                      image={bannerAsset.objectUrl}
                      crop={bannerCrop}
                      zoom={bannerZoom}
                      aspect={MEDIA_CONFIG.banner.aspect}
                      cropShape={MEDIA_CONFIG.banner.cropShape as "rect"}
                      showGrid
                      minZoom={1}
                      maxZoom={4}
                      objectFit="contain"
                      onCropChange={setBannerCrop}
                      onZoomChange={setBannerZoom}
                      onCropComplete={(_, area) => setBannerAreaPixels(area)}
                    />
                  ) : previewBanner ? (
                    <img
                      src={previewBanner}
                      alt=""
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 px-4 text-center">
                      <ImagePlus className="h-8 w-8 text-white/25" />
                      <span className="text-sm text-white/45">No banner yet</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleSelectFile("banner", f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={publishing || selectingKind === "banner"}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-4 text-xs font-semibold text-white/90 transition hover:bg-white/10 sm:flex-none sm:px-5"
                  >
                    {selectingKind === "banner" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    {bannerAsset ? "Replace banner" : MEDIA_CONFIG.banner.emptyLabel}
                  </button>
                  {bannerAsset && (
                    <>
                      <button
                        type="button"
                        onClick={clearBanner}
                        disabled={publishing}
                        className="h-10 rounded-full border border-white/12 px-4 text-xs font-medium text-white/55 hover:text-white/80"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                {bannerAsset && (
                  <div className="border-t border-white/[0.06] px-4 pb-3 pt-2">
                    <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      <span>Zoom</span>
                      <span>{Math.round(bannerZoom * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={0.01}
                      value={bannerZoom}
                      onChange={(e) => setBannerZoom(Number(e.target.value))}
                      className="w-full accent-zinc-400"
                    />
                  </div>
                )}
                {bannerNotice && (
                  <div className="border-t border-amber-400/15 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-100/90">
                    {bannerNotice}
                  </div>
                )}
              </div>
            </div>

            <div ref={avatarSectionRef} className="mt-8 space-y-3 scroll-mt-24">
              <div className="text-sm font-medium text-white/90">Profile photo</div>
              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] ring-1 ring-white/[0.05]">
                <div className="flex flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:items-start">
                  <div
                    className={cn(
                      "relative shrink-0 overflow-hidden rounded-full border-2 border-white/15 bg-black/50",
                      avatarAsset?.objectUrl ? "h-40 w-40" : "h-32 w-32",
                    )}
                  >
                    {avatarAsset?.objectUrl ? (
                      <Cropper
                        image={avatarAsset.objectUrl}
                        crop={avatarCrop}
                        zoom={avatarZoom}
                        aspect={MEDIA_CONFIG.avatar.aspect}
                        cropShape={MEDIA_CONFIG.avatar.cropShape as "round"}
                        showGrid={false}
                        minZoom={1}
                        maxZoom={4}
                        objectFit="contain"
                        onCropChange={setAvatarCrop}
                        onZoomChange={setAvatarZoom}
                        onCropComplete={(_, area) => setAvatarAreaPixels(area)}
                      />
                    ) : (
                      <img
                        src={previewAvatar}
                        alt=""
                        className="h-full w-full object-cover object-center"
                      />
                    )}
                  </div>
                  <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleSelectFile("avatar", f);
                        e.currentTarget.value = "";
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={publishing || selectingKind === "avatar"}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-4 text-xs font-semibold text-white/90 hover:bg-white/10 sm:flex-none sm:px-5"
                      >
                        {selectingKind === "avatar" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}
                        {avatarAsset ? "Replace photo" : MEDIA_CONFIG.avatar.emptyLabel}
                      </button>
                      {avatarAsset && (
                        <button
                          type="button"
                          onClick={clearAvatar}
                          disabled={publishing}
                          className="h-10 rounded-full border border-white/12 px-4 text-xs font-medium text-white/55 hover:text-white/80"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    {avatarAsset && (
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-white/40">
                          <span>Zoom</span>
                          <span>{Math.round(avatarZoom * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={4}
                          step={0.01}
                          value={avatarZoom}
                          onChange={(e) => setAvatarZoom(Number(e.target.value))}
                          className="w-full accent-zinc-400"
                        />
                      </div>
                    )}
                    {avatarNotice && (
                      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                        {avatarNotice}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Profile details
            </h2>

            <div className="mt-6 grid gap-5">
              <div className="grid gap-4">
                <div>
                  <label className="text-[11px] font-medium text-white/45">
                    Name{" "}
                    <span className="text-white/30">
                      ({draftName.length}/{profileFullNameMax})
                    </span>
                  </label>
                  <input
                    value={draftName}
                    maxLength={profileFullNameMax}
                    onChange={(e) => setDraftName(e.target.value.slice(0, profileFullNameMax))}
                    className="mt-1.5 h-12 w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 text-sm text-white outline-none ring-0 transition placeholder:text-white/30 focus:border-white/25"
                    placeholder="Display name"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/45">Handle</label>
                  <div className="mt-1.5 flex items-center rounded-2xl border border-white/12 bg-white/[0.04] px-4 focus-within:border-white/25">
                    <span className="shrink-0 text-sm text-white/40" aria-hidden>
                      @
                    </span>
                    <input
                      value={draftHandle}
                      onChange={(e) => {
                        const v = e.target.value
                          .replace(/[^a-zA-Z0-9_]/g, "_")
                          .toLowerCase()
                          .slice(0, 24);
                        setDraftHandle(v);
                      }}
                      className="h-12 min-w-0 flex-1 border-0 bg-transparent py-0 pl-0.5 text-sm text-white outline-none placeholder:text-white/30"
                      placeholder="handle"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-white/45">Bio</label>
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={4}
                  className="mt-1.5 w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  placeholder="Optional — a line or two about what you create"
                />
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.02] p-5 ring-1 ring-white/[0.04]">
                <div className="text-xs font-semibold text-white/70">Social links</div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {["twitter", "linkedin", "youtube", "website", "github", "instagram"].map((k) => {
                    const displayLabel =
                      k.toLowerCase() === "twitter" ? "X" : k.charAt(0).toUpperCase() + k.slice(1);
                    return (
                      <div key={k}>
                        <label className="text-[11px] text-white/45">{displayLabel}</label>
                        <input
                          value={draftSocials?.[k] || ""}
                          onChange={(e) =>
                            setDraftSocials((p) => ({ ...(p || {}), [k]: e.target.value }))
                          }
                          className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20"
                          placeholder="https://"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="h-24 shrink-0 sm:h-28" aria-hidden />
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
