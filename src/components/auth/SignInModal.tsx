"use client";

import React, { useState, FormEvent } from "react";

export type OAuthProvider = "google" | "apple" | "linkedin" | "facebook";

type Props = {
  open: boolean;
  onClose: () => void;
  onProvider: (provider: OAuthProvider) => void;
  onEmailLogin: (email: string) => void;
};

export default function SignInModal({
  open,
  onClose,
  onProvider,
  onEmailLogin,
}: Props) {
  const [email, setEmail] = useState("");

  if (!open) return null;

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onEmailLogin(email.trim());
  };

  const baseButton =
    "flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 text-sm font-medium text-white hover:bg-white/10 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#050505] p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sign in to Edgaze</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onProvider("google")}
            className={baseButton}
          >
            <span className="text-xs uppercase tracking-wide">Google</span>
          </button>
          <button
            type="button"
            onClick={() => onProvider("apple")}
            className={baseButton}
          >
            <span className="text-xs uppercase tracking-wide">Apple</span>
          </button>
          <button
            type="button"
            onClick={() => onProvider("linkedin")}
            className={baseButton}
          >
            <span className="text-xs uppercase tracking-wide">LinkedIn</span>
          </button>
          <button
            type="button"
            onClick={() => onProvider("facebook")}
            className={baseButton}
          >
            <span className="text-xs uppercase tracking-wide">Facebook</span>
          </button>
        </div>

        <div className="my-4 text-center text-[11px] uppercase tracking-wide text-white/40">
          or continue with email
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-2">
          <input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm outline-none placeholder:text-white/30"
          />
          <button type="submit" className={baseButton}>
            <span className="text-xs uppercase tracking-wide">
              Continue with email
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
