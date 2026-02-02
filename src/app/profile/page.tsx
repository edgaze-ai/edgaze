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

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Loader2 className="h-6 w-6 animate-spin text-white/60" aria-hidden />
    </div>
  );
}
