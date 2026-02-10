"use client";

import React from "react";
import { AlertTriangle, Clock, X } from "lucide-react";

interface HandleChangeWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentHandle: string;
  newHandle: string;
  isProcessing?: boolean;
}

export default function HandleChangeWarningDialog({
  isOpen,
  onClose,
  onConfirm,
  currentHandle,
  newHandle,
  isProcessing = false,
}: HandleChangeWarningDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-[#0f0f0f] border border-red-500/30 rounded-xl shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-3 right-3 p-1.5 text-white/40 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-50 z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with warning icon */}
        <div className="p-5 pb-4">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>

          <h2 className="text-[20px] font-semibold text-white tracking-tight mb-1.5">
            Change Your Handle?
          </h2>
          <p className="text-[13px] text-white/60 leading-relaxed">
            Please read the warnings carefully before proceeding.
          </p>
        </div>

        {/* Handle preview */}
        <div className="px-5 pb-4">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-white/40 mb-0.5">Current</div>
                <div className="text-[14px] text-white/90 font-medium truncate">@{currentHandle}</div>
              </div>
              <div className="text-white/30 text-[16px]">→</div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-white/40 mb-0.5">New</div>
                <div className="text-[14px] text-white font-semibold truncate">@{newHandle}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Warning messages */}
        <div className="px-5 pb-4 space-y-3">
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] font-semibold text-red-400 mb-0.5">60-Day Cooldown</div>
                <div className="text-[12px] text-white/70 leading-relaxed">
                  You won't be able to change it again for 2 months (60 days).
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] font-semibold text-amber-400 mb-0.5">Links Will Change</div>
                <div className="text-[12px] text-white/70 leading-relaxed">
                  All your profile and product URLs will be updated. Old links will redirect.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-3">
            <div className="text-[12px] text-white/60 leading-relaxed">
              <p className="font-medium mb-1.5">You acknowledge:</p>
              <ul className="space-y-1 ml-3 list-disc list-outside">
                <li>Can't change again for 60 days</li>
                <li>Profile URL will update</li>
                <li>All products will use new handle</li>
                <li>Should update external links</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.10] text-[13px] font-medium text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-[13px] font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Changing..." : "Yes, Change"}
          </button>
        </div>
      </div>
    </div>
  );
}
