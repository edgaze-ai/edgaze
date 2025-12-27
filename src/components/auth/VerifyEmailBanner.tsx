"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export default function VerifyEmailBanner() {
  const { userId, profile, resendVerification, refreshAuth } = useAuth();
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!userId) return null;
  if (!profile) return null;
  if (profile.email_verified) return null;

  const email = profile.email;

  return (
    <div className="sticky top-0 z-[60] w-full border-b border-white/10 bg-[#0b0b0b]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm text-white/80">
          <span className="font-medium text-white">Verify your email</span>{" "}
          to unlock publishing and purchases.{" "}
          <span className="text-white/50">({email})</span>
          {msg && <span className="ml-2 text-white/60">{msg}</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setMsg(null);
              setSending(true);
              try {
                await resendVerification(email);
                setMsg("Verification email sent. Check spam too.");
              } catch (e: any) {
                setMsg(e?.message ?? "Failed to resend");
              } finally {
                setSending(false);
              }
            }}
            disabled={sending}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Resend email"}
          </button>

          <button
            type="button"
            onClick={async () => {
              setMsg(null);
              await refreshAuth();
              setMsg("Refreshed.");
            }}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
