"use client";

import React from "react";
import { X, AlertTriangle } from "lucide-react";

type ErrorModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
  hint?: string;
};

export default function ErrorModal({
  open,
  onClose,
  title = "Error",
  message,
  details,
  hint,
}: ErrorModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0b0b10] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="rounded-full bg-red-500/20 p-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
            <p className="text-sm text-white/90 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-white/10 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>
        </div>

        {/* Details */}
        {details && (
          <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-xs font-medium text-white/60 mb-1">Details:</div>
            <div className="text-sm text-white/80 font-mono break-words">
              {details}
            </div>
          </div>
        )}

        {/* Hint */}
        {hint && (
          <div className="mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <div className="text-xs font-medium text-cyan-300 mb-1">💡 Hint:</div>
            <div className="text-sm text-cyan-200/90">{hint}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
