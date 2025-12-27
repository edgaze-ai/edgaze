// src/components/prompt-studio/PublishPromptModal.tsx
"use client";

import React, { useMemo, useState } from "react";
import { X, Globe2, EyeOff, Coins, Image as ImageIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import AssetPickerModal from "../assets/AssetPickerModal";
import { createBlurredPromptThumbnail } from "../../lib/edgazeAssets";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type PlaceholderDef = {
  name: string;
  question: string;
};

type Visibility = "public" | "unlisted" | "private";

type PublishMeta = {
  name: string;
  description: string;
  thumbnailUrl: string;
  tags: string;
  visibility: Visibility;
  paid: boolean;
  priceUsd: string;
  // optional extras (keep compatible if your DB doesn’t have them)
  demoImageUrls?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  meta: PublishMeta;
  onMetaChange: (next: PublishMeta) => void;
  promptText: string;
  placeholders: PlaceholderDef[];
  onPublished: () => void;
};

type AssetTarget = { type: "thumbnail" } | { type: "demo"; index: number } | null;

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

function randomCode() {
  // short-ish share code
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export default function PublishPromptModal({
  open,
  onClose,
  meta,
  onMetaChange,
  promptText,
  placeholders,
  onPublished,
}: Props) {
  const { userId, profile, requireAuth } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetTarget, setAssetTarget] = useState<AssetTarget>(null);

  const [demoImages, setDemoImages] = useState<string[]>(meta.demoImageUrls ?? []);

  const ownerHandle = useMemo(() => {
    // Always prefer your profiles.handle (real @handle)
    if (profile?.handle) return profile.handle;

    // Fallback: if profile missing, use a stable handle-like string
    if (userId) return `user_${userId.slice(0, 6)}`;
    return "creator";
  }, [profile?.handle, userId]);

  const edgazeCode = useMemo(() => {
    // if you already store a code in meta, keep it; else generate a draft code
    return meta.name ? `${slugify(meta.name)}-${randomCode()}` : randomCode();
    // (If you have a real “edgaze code” field in meta/db, wire it. Keeping minimal.)
  }, [meta.name]);

  const urlPreview = useMemo(() => {
    return `edgaze.ai/@${ownerHandle}/${edgazeCode}`;
  }, [ownerHandle, edgazeCode]);

  const autoThumb = useMemo(() => {
    if (meta.thumbnailUrl) return "";
    if (!promptText.trim()) return "";
    try {
      return createBlurredPromptThumbnail(promptText);
    } catch {
      return "";
    }
  }, [meta.thumbnailUrl, promptText]);

  if (!open) return null;

  const handleField = (patch: Partial<PublishMeta>) => {
    onMetaChange({ ...meta, ...patch, demoImageUrls: demoImages });
  };

  const openThumbnailPicker = () => {
    setAssetTarget({ type: "thumbnail" });
    setAssetPickerOpen(true);
  };

  const openDemoPicker = (index: number) => {
    setAssetTarget({ type: "demo", index });
    setAssetPickerOpen(true);
  };

  const handleAssetSelected = (url: string) => {
    if (!assetTarget) return;

    if (assetTarget.type === "thumbnail") {
      onMetaChange({ ...meta, thumbnailUrl: url, demoImageUrls: demoImages });
    } else {
      setDemoImages((prev) => {
        const next = [...prev];
        next[assetTarget.index] = url;
        return next;
      });
    }

    setAssetPickerOpen(false);
    setAssetTarget(null);
  };

  const addDemoSlot = () => {
    setDemoImages((prev) => [...prev, ""]);
  };

  const removeDemo = (index: number) => {
    setDemoImages((prev) => prev.filter((_, i) => i !== index));
  };

  const canPublish =
    !!meta.name.trim() &&
    !!meta.description.trim() &&
    !!promptText.trim() &&
    placeholders.every((p) => p.name && p.question);

  const doPublish = async () => {
    setErrorMsg(null);

    if (!requireAuth()) return;
    if (!userId) return;

    if (!canPublish) {
      setErrorMsg("Fill in name, description, and prompt before publishing.");
      return;
    }

    setSubmitting(true);

    try {
      // 1) Ensure we have a thumbnail (either chosen or generated)
      let thumbUrl = meta.thumbnailUrl?.trim() || "";
      if (!thumbUrl && autoThumb) {
        // If you store data URLs, keep it; otherwise you should upload it.
        // Keeping behavior non-breaking: just store data URL.
        thumbUrl = autoThumb;
      }

      // 2) Insert prompt record (adjust table/columns to match your schema)
      // If your table name differs, change here only.
      const payload: any = {
        owner_id: userId,
        owner_handle: ownerHandle,
        name: meta.name.trim(),
        description: meta.description.trim(),
        prompt_text: promptText,
        placeholders,
        tags: meta.tags,
        visibility: meta.visibility,
        paid: meta.paid,
        price_usd: meta.priceUsd ? Number(meta.priceUsd) : null,
        thumbnail_url: thumbUrl || null,
        demo_images: demoImages.filter(Boolean),
        edgaze_code: edgazeCode,
        created_at: new Date().toISOString(),
      };

      const { error: insertErr } = await supabase.from("prompts").insert(payload);
      if (insertErr) throw insertErr;

      onPublished();
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message || "Publish failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-[720px] overflow-hidden rounded-[28px] border border-white/15 bg-[#05060a] shadow-[0_0_80px_rgba(0,0,0,0.65)]">
        <div className="pointer-events-none absolute -inset-[2px] rounded-[30px] bg-gradient-to-r from-cyan-400/30 via-sky-500/20 to-pink-500/30 blur-[10px]" />

        <div className="relative p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>

          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Publish Prompt</h2>
            <div className="mt-1 text-xs text-white/55">
              This will be visible at{" "}
              <span className="text-white/80">{urlPreview}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] text-white/55">Name</div>
                <input
                  value={meta.name}
                  onChange={(e) => handleField({ name: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                  placeholder="e.g. Perfect cold email generator"
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] text-white/55">Description</div>
                <textarea
                  value={meta.description}
                  onChange={(e) => handleField({ description: e.target.value })}
                  className="h-[92px] w-full resize-none rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                  placeholder="What does this prompt do? When should someone use it?"
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] text-white/55">Tags</div>
                <input
                  value={meta.tags}
                  onChange={(e) => handleField({ tags: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                  placeholder="sales, email, outreach"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleField({ visibility: "public" })}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                    meta.visibility === "public"
                      ? "bg-white/10 text-white"
                      : "border border-white/15 bg-black/40 text-white/60 hover:bg-white/5"
                  }`}
                >
                  <Globe2 className="h-4 w-4" />
                  Public
                </button>

                <button
                  type="button"
                  onClick={() => handleField({ visibility: "unlisted" })}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                    meta.visibility === "unlisted"
                      ? "bg-white/10 text-white"
                      : "border border-white/15 bg-black/40 text-white/60 hover:bg-white/5"
                  }`}
                >
                  Unlisted
                </button>

                <button
                  type="button"
                  onClick={() => handleField({ visibility: "private" })}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                    meta.visibility === "private"
                      ? "bg-white/10 text-white"
                      : "border border-white/15 bg-black/40 text-white/60 hover:bg-white/5"
                  }`}
                >
                  <EyeOff className="h-4 w-4" />
                  Private
                </button>
              </div>

              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-white/70">
                    Thumbnail
                  </div>
                  <button
                    type="button"
                    onClick={openThumbnailPicker}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Choose
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-[72px] w-[128px] overflow-hidden rounded-lg border border-white/10 bg-black/60">
                    {meta.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={meta.thumbnailUrl}
                        alt="thumbnail"
                        className="h-full w-full object-cover"
                      />
                    ) : autoThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={autoThumb}
                        alt="auto thumbnail"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
                        No thumbnail
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-white/50">
                    {meta.thumbnailUrl ? "Custom thumbnail set." : "Auto thumbnail preview."}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-white/70">
                    Monetisation
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleField({ paid: false, priceUsd: "" })}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                      !meta.paid
                        ? "bg-white/10 text-white"
                        : "border border-white/15 bg-black/40 text-white/60 hover:bg-white/5"
                    }`}
                  >
                    Free
                  </button>

                  <button
                    type="button"
                    onClick={() => handleField({ paid: true })}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                      meta.paid
                        ? "bg-white/10 text-white"
                        : "border border-white/15 bg-black/40 text-white/60 hover:bg-white/5"
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    Paywall
                  </button>
                </div>

                {meta.paid && (
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] text-white/55">Price (USD)</div>
                    <input
                      value={meta.priceUsd}
                      onChange={(e) => handleField({ priceUsd: e.target.value })}
                      className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                      placeholder="e.g. 5"
                    />
                    <div className="mt-1 text-[11px] text-white/40">
                      Payments can be wired later; store the intended price now.
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-white/70">
                    Demo images
                  </div>
                  <button
                    type="button"
                    onClick={addDemoSlot}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                  >
                    + Add
                  </button>
                </div>

                <div className="space-y-2">
                  {demoImages.length === 0 && (
                    <div className="text-[11px] text-white/40">No demo images added.</div>
                  )}

                  {demoImages.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="h-12 w-20 overflow-hidden rounded-lg border border-white/10 bg-black/60">
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={`demo-${idx}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-white/35">
                            Empty
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openDemoPicker(idx)}
                        className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                      >
                        Choose
                      </button>

                      <button
                        type="button"
                        onClick={() => removeDemo(idx)}
                        className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/70 hover:bg-red-500/10 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}

              <button
                type="button"
                onClick={doPublish}
                disabled={submitting}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-3 text-sm font-semibold text-black shadow-[0_0_26px_rgba(56,189,248,0.35)] hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? "Publishing…" : "Publish"}
              </button>

              <div className="text-[11px] text-white/40">
                You can edit metadata later. Publishing stores current prompt + placeholders.
              </div>
            </div>
          </div>
        </div>

        {assetPickerOpen && (
          <AssetPickerModal
            open={assetPickerOpen}
            onClose={() => {
              setAssetPickerOpen(false);
              setAssetTarget(null);
            }}
            onSelect={handleAssetSelected}
          />
        )}
      </div>
    </div>
  );
}
