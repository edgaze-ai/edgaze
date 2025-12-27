// src/components/assets/ImageFieldWithAssetPicker.tsx
"use client";

import React, { useState } from "react";
import { AssetPickerModal } from "./AssetPickerModal";

type ImageFieldWithAssetPickerProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
};

export function ImageFieldWithAssetPicker({
  label = "Image URL",
  value,
  onChange,
}: ImageFieldWithAssetPickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium text-neutral-200">
          {label}
        </label>
      )}

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="rounded-md border border-neutral-700 px-3 py-1 text-sm text-neutral-100 hover:bg-neutral-800"
        >
          Browse
        </button>
      </div>

      <AssetPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url) => {
          onChange(url); // <- this is the critical part – a REAL function
        }}
      />
    </div>
  );
}
