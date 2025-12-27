// src/components/assets/AssetUploader.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { uploadImageAsset, USER_ASSET_QUOTA_BYTES } from "../../lib/edgazeAssets";
import { User } from "../auth/AuthContext"; // adjust import path if different

type Props = {
  user: User;
  value: string | null; // current thumbnail URL
  onChange: (url: string | null) => void;
};

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export default function AssetUploader({ user, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      setUploading(true);
      const result = await uploadImageAsset(user.id, file);
      onChange(result.publicUrl);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-white/80">Thumbnail image</label>

      <div className="flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:border-cyan-400 hover:bg-white/10">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading ? "Uploading…" : "Upload image"}
        </label>

        {value && (
          <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-white/15 bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Thumbnail preview" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      <p className="text-[11px] text-white/40">
        PNG / JPG only. Total Edgaze assets limit per account:{" "}
        {formatBytes(USER_ASSET_QUOTA_BYTES)}.
      </p>

      {error && <p className="text-[11px] text-amber-300">{error}</p>}
    </div>
  );
}