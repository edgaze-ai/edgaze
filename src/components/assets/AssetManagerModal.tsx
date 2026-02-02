// src/components/assets/AssetManagerModal.tsx
"use client";

import React, { useEffect, useState } from "react";
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
  // Optional so it can't crash; guarded before calling.
  onSelect?: (url: string) => void;
};

export function AssetPickerModal({
  isOpen,
  onClose,
  onSelect,
}: AssetPickerModalProps) {
  const { getAccessToken } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [assets, setAssets] = useState<EdgazeAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load assets when the modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadAssets = async () => {
      try {
        setLoadingAssets(true);
        setError(null);

        const headers: Record<string, string> = {};
        const token = await getAccessToken?.();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch("/api/assets/list", { headers });

        if (!res.ok) {
          let message = "Failed to load assets";
          try {
            const body = await res.json();
            if (body && typeof body.error === "string") {
              message = body.error;
            }
          } catch {
            // ignore JSON errors
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      const headers: Record<string, string> = {};
      const token = await getAccessToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        headers,
        body: formData,
      });

      if (res.status === 401) {
        setError("You must be signed in to upload files.");
        return;
      }

      if (!res.ok) {
        let message = "Upload failed";
        try {
          const body = await res.json();
          if (body && typeof body.error === "string") {
            message = body.error;
          }
        } catch {
          // ignore JSON errors
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
      // Allow re-selecting the same file again
      e.target.value = "";
    }
  };

  const handlePick = (asset: EdgazeAsset) => {
    // This guard is what prevents `onSelect is not a function`
    if (onSelect) {
      onSelect(asset.publicUrl);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl rounded-xl bg-neutral-900 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Asset Library</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Close
          </button>
        </div>

        {/* Upload section */}
        <div className="mb-3 rounded-md border border-neutral-700 p-3">
          <p className="mb-2 text-sm text-neutral-300">Upload a new file</p>
          <input
            type="file"
            onChange={handleFileChange}
            disabled={isUploading}
            className="text-sm text-neutral-200"
          />
          {isUploading && (
            <p className="mt-1 text-xs text-neutral-400">Uploading…</p>
          )}
        </div>

        {/* Library section */}
        <div className="rounded-md border border-neutral-700 p-3">
          <p className="mb-2 text-sm font-medium text-neutral-200">
            Your assets
          </p>

          {loadingAssets && (
            <p className="text-sm text-neutral-400">Loading…</p>
          )}

          {error && (
            <p className="mb-2 text-sm text-red-400">{error}</p>
          )}

          {!loadingAssets && !error && assets.length === 0 && (
            <p className="text-sm text-neutral-400">
              No assets yet. Upload a file to get started.
            </p>
          )}

          {!loadingAssets && assets.length > 0 && (
            <div className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handlePick(asset)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-neutral-800"
                >
                  <span className="truncate text-neutral-100">
                    {asset.filename}
                  </span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {Math.round(asset.sizeBytes / 1024)} kb
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
