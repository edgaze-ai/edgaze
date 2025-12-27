// src/components/assets/AssetPickerModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Image as ImageIcon, UploadCloud, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export type EdgazeAsset = {
  id: string;
  publicUrl: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

export type AssetPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when the user chooses an asset.
   * We pass the asset's public URL.
   */
  onSelect?: (url: string) => void;
};

export default function AssetPickerModal({
  isOpen,
  onClose,
  onSelect,
}: AssetPickerModalProps) {
  const { user } = useAuth();

  const [isUploading, setIsUploading] = useState(false);
  const [assets, setAssets] = useState<EdgazeAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing assets when the modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadAssets = async () => {
      try {
        setLoadingAssets(true);
        setError(null);

        const res = await fetch("/api/assets/list");

        if (!res.ok) {
          let message = "Failed to load assets";
          try {
            const body = await res.json();
            if (body && typeof body.error === "string") {
              message = body.error;
            }
          } catch {
            // ignore json parse issues
          }
          throw new Error(message);
        }

        const data = await res.json();
        const list = Array.isArray(data.assets) ? data.assets : [];
        setAssets(list);
      } catch (err: any) {
        console.error("Error loading assets:", err);
        setError(err?.message || "Failed to load assets");
      } finally {
        setLoadingAssets(false);
      }
    };

    loadAssets();
  }, [isOpen]);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user?.id) {
      setError("You must be signed in to upload files.");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);

      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let message = "Upload failed";
        try {
          const body = await res.json();
          if (body && typeof body.error === "string") {
            message = body.error;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const uploaded = await res.json();

      const newAsset: EdgazeAsset = {
        id: uploaded.id ?? uploaded.path ?? crypto.randomUUID(),
        publicUrl: uploaded.publicUrl,
        filename: file.name,
        sizeBytes: uploaded.sizeBytes ?? file.size,
        createdAt: uploaded.createdAt ?? new Date().toISOString(),
      };

      setAssets((prev) => [newAsset, ...prev]);
    } catch (err: any) {
      console.error("Error uploading asset:", err);
      setError(err?.message || "Upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handlePick = (asset: EdgazeAsset) => {
    if (onSelect) {
      onSelect(asset.publicUrl);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-3xl rounded-3xl border border-white/12 bg-[#05060b] shadow-[0_0_50px_rgba(15,23,42,0.9)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-pink-500">
              <ImageIcon className="h-4 w-4 text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Asset library</span>
              <span className="text-[11px] text-white/60">
                Upload images or pick from your existing library.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex gap-4 px-5 py-4">
          {/* Left: uploader */}
          <div className="w-64 flex-shrink-0 space-y-3">
            <div className="rounded-2xl border border-dashed border-white/25 bg-black/40 p-4">
              <div className="flex flex-col items-center text-center">
                <UploadCloud className="mb-2 h-6 w-6 text-cyan-300" />
                <p className="text-xs font-medium text-white/80">
                  Upload a new image
                </p>
                <p className="mt-1 text-[10px] text-white/45">
                  PNG, JPG, up to a few MB.
                </p>
                <label className="mt-3 inline-flex cursor-pointer items-center rounded-full bg-gradient-to-r from-cyan-400 to-pink-500 px-3 py-1 text-[11px] font-semibold text-black hover:brightness-110">
                  <span>Choose file</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
                {isUploading && (
                  <p className="mt-2 text-[10px] text-white/60">
                    Uploading…
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/40 p-3 text-[10px] text-white/55">
              <p className="font-medium text-white/70">Tip</p>
              <p className="mt-1">
                Use a clean, high-contrast image. It will be reused across your
                listings.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/60 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                {error}
              </div>
            )}
          </div>

          {/* Right: library */}
          <div className="flex-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/70">
                Your assets
              </span>
              {loadingAssets && (
                <span className="text-[10px] text-white/45">Loading…</span>
              )}
            </div>

            {!loadingAssets && assets.length === 0 && !error && (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/40 text-[11px] text-white/50">
                No assets yet. Upload an image on the left to get started.
              </div>
            )}

            {!loadingAssets && assets.length > 0 && (
              <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-white/12 bg-black/40 p-3">
                <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                  {assets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handlePick(asset)}
                      className="group relative flex h-24 flex-col overflow-hidden rounded-xl border border-white/15 bg-white/5 text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.publicUrl}
                        alt={asset.filename}
                        className="h-16 w-full object-cover group-hover:brightness-110"
                      />
                      <div className="flex flex-1 items-center justify-between px-2 py-1.5">
                        <span className="w-[70%] truncate text-[10px] text-white/80">
                          {asset.filename}
                        </span>
                        <span className="text-[9px] text-white/45">
                          {Math.round(asset.sizeBytes / 1024)} kb
                        </span>
                      </div>
                      <div className="pointer-events-none absolute inset-0 rounded-xl border border-cyan-400/0 group-hover:border-cyan-400/70 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
