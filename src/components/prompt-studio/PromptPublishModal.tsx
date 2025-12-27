"use client";

import React, { useState } from "react";

export type PublishMeta = {
  title: string;
  description: string;
  thumbnailUrl: string;
  seoTags: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPublish: (meta: PublishMeta) => Promise<void>;
  loading: boolean;
  error: string | null;
  success: string | null;
};

export default function PromptPublishModal({
  open,
  onClose,
  onPublish,
  loading,
  error,
  success,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [seoTags, setSeoTags] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onPublish({ title, description, thumbnailUrl, seoTags });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-[#050505] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Publish prompt to Edgaze</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-white/60 hover:text-white/90"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">
              Prompt name
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="rounded-lg border border-white/25 bg-black/50 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
              placeholder="Example: YouTube script generator for tech channels"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">
              Short description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="rounded-lg border border-white/25 bg-black/50 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400 resize-none"
              placeholder="Explain what this prompt does and who it is for."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">
              Thumbnail URL
            </label>
            <input
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              className="rounded-lg border border-white/25 bg-black/50 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
              placeholder="https://…  (for now paste an image URL)"
            />
            <p className="text-[10px] text-white/40">
              Later this can come from Edgaze’s asset system.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">
              SEO tags / keywords
            </label>
            <input
              value={seoTags}
              onChange={(e) => setSeoTags(e.target.value)}
              className="rounded-lg border border-white/25 bg-black/50 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
              placeholder="Example: youtube, script, content, ai, tech"
            />
            <p className="text-[10px] text-white/40">
              Comma separated. Used for future search and discovery.
            </p>
          </div>

          {error && (
            <p className="text-[11px] text-amber-300">
              {error}
            </p>
          )}
          {success && (
            <p className="text-[11px] text-emerald-300">
              {success}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-1 font-semibold text-black hover:brightness-[1.05] disabled:opacity-60"
            >
              {loading ? "Publishing…" : "Publish to marketplace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
