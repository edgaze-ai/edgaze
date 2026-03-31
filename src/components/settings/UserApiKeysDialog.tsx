"use client";

import { X } from "lucide-react";
import { UserApiKeysPanel } from "./UserApiKeysPanel";

export function UserApiKeysDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75">
      <div className="absolute inset-0" aria-hidden onClick={() => onClose()} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0a0a0a] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08] shrink-0">
          <h2 className="text-[15px] font-semibold text-white">Saved API keys</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/50 hover:text-white hover:bg-white/[0.06]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">
          <UserApiKeysPanel
            heading="Your provider keys"
            description="Keys are encrypted at rest. You can replace or remove them anytime; we never show the secret again after save."
          />
        </div>
      </div>
    </div>
  );
}
