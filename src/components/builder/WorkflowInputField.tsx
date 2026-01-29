"use client";

import React, { useRef, useState } from "react";
import { Download } from "lucide-react";
import type { WorkflowInput } from "./PremiumWorkflowRunModal";

export function WorkflowInputField({
  input,
  value,
  onChange,
}: {
  input: WorkflowInput;
  value: any;
  onChange: (value: any) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  if (input.type === "file") {
    return (
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) {
              onChange(null);
              setFileError(null);
              return;
            }

            // Check file size (5MB limit)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (file.size > maxSize) {
              setFileError(
                `File size exceeds 5MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
              );
              onChange(null);
              return;
            }

            setFileError(null);
            onChange(file);
          }}
          required={input.required}
          className="hidden"
          accept="*/*"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white/80 hover:border-cyan-500/50 hover:bg-black/50 transition-all flex items-center justify-between"
        >
          <span>
            {value instanceof File ? value.name : "Choose file (max 5MB)"}
          </span>
          <Download className="h-4 w-4" />
        </button>
        {fileError && <p className="text-xs text-red-400">{fileError}</p>}
        {value instanceof File && (
          <p className="text-xs text-white/50">
            Size: {(value.size / 1024).toFixed(2)} KB
          </p>
        )}
      </div>
    );
  }

  if (input.type === "textarea") {
    return (
      <textarea
        value={value || input.defaultValue || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={input.placeholder}
        required={input.required}
        rows={4}
        className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
      />
    );
  }

  return (
    <input
      type={input.type === "number" ? "number" : input.type === "url" ? "url" : "text"}
      value={value || input.defaultValue || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={input.placeholder}
      required={input.required}
      className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
    />
  );
}
