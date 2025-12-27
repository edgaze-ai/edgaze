"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../components/auth/AuthContext";

function safeHandle(input: unknown) {
  if (typeof input !== "string") return null;

  const raw = input.trim();
  if (!raw) return null;

  const v = raw.toLowerCase();
  if (v === "undefined" || v === "null") return null;

  const stripped = raw.startsWith("@") ? raw.slice(1).trim() : raw;
  if (!stripped) return null; // IMPORTANT: blocks "@", " @ ", etc.

  return stripped;
}

export default function ProfileRootPage() {
  const router = useRouter();
  const { authReady, loading, userId, profile, openSignIn, refreshProfile } = useAuth();

  const [openingModalOnce, setOpeningModalOnce] = useState(false);
  const pushedRef = useRef(false);

  const handle = useMemo(() => safeHandle(profile?.handle), [profile?.handle]);

  // Auto-open profile once (no infinite loop)
  useEffect(() => {
    if (!authReady) return;

    // Not signed in -> open modal once
    if (!userId) {
      if (!openingModalOnce) {
        setOpeningModalOnce(true);
        openSignIn();
      }
      return;
    }

    // Signed in but profile not ready -> try refresh
    if (!handle) {
      refreshProfile().catch(() => {});
      return;
    }

    // Push once only
    if (pushedRef.current) return;
    pushedRef.current = true;

    router.replace(`/profile/${encodeURIComponent(handle)}`);
  }, [authReady, userId, handle, openSignIn, openingModalOnce, refreshProfile, router]);

  // Manual fallback (uses router, not Link)
  const manualOpen = () => {
    if (!handle) return;
    router.replace(`/profile/${encodeURIComponent(handle)}`);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening your profile…
        </div>

        <div className="mt-3 text-xs text-white/50 space-y-1">
          <div>authReady: {String(authReady)}</div>
          <div>loading: {String(loading)}</div>
          <div>userId: {userId ? "yes" : "no"}</div>
          <div>profileLoaded: {profile ? "yes" : "no"}</div>
          <div>handle: {handle ?? "null"}</div>
        </div>

        {/* If something prevents auto-nav, this always works */}
        <button
          type="button"
          onClick={manualOpen}
          disabled={!handle}
          className="mt-4 w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          Open profile
        </button>
      </div>
    </div>
  );
}
