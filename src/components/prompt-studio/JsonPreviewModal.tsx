"use client";

import React, { useState } from "react";
import { Copy, X, Check } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  json: string;
  title?: string;
};

export default function JsonPreviewModal({ open, onClose, json, title = "JSON Preview" }: Props) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      try {
        const ta = document.createElement("textarea");
        ta.value = json;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Failed to copy
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[140]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-[min(800px,95vw)] max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.8)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="text-[14px] font-semibold text-white">{title}</div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-semibold text-white/90 hover:bg-white/10 transition"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* JSON Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            <pre className="p-5 text-[13px] leading-relaxed text-white/85 font-mono whitespace-pre-wrap break-words">
              {json}
            </pre>
          </div>

          <div className="h-[1px] bg-gradient-to-r from-cyan-400/40 via-white/10 to-pink-500/40" />
        </div>
      </div>
    </div>
  );
}
