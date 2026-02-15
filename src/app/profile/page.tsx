"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function ProfileRootPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authReady, loading, userId, profile, openSignIn, refreshProfile } = useAuth();

  const [openingModalOnce, setOpeningModalOnce] = useState(false);
  const pushedRef = useRef(false);

  const handle = useMemo(() => safeHandle(profile?.handle), [profile?.handle]);
  const fromSidebar = useMemo(() => searchParams?.get("from") === "sidebar", [searchParams]);

  // Auto-open profile once (no infinite loop)
  useEffect(() => {
    if (!authReady) return;

    // Not signed in -> either show inline CTA (sidebar entry) or open modal once (other entry points)
    if (!userId) {
      if (fromSidebar) return;
      if (!openingModalOnce) {
        queueMicrotask(() => {
          setOpeningModalOnce(true);
          openSignIn();
        });
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

    // Remove query params when redirecting to avoid keeping from=sidebar
    router.replace(`/profile/${encodeURIComponent(handle)}`);
  }, [authReady, userId, handle, openSignIn, openingModalOnce, refreshProfile, router, fromSidebar]);

  if (authReady && !userId && fromSidebar) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="text-lg font-semibold text-white">Sign in to view your profile</div>
          <div className="mt-2 text-sm text-white/60">
            Your profile is tied to your account. Sign in to continue.
          </div>

          <button
            type="button"
            onClick={openSignIn}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(56,189,248,0.35)] hover:opacity-95 active:scale-[0.99]"
          >
            Sign in
          </button>

          <div className="mt-3 text-xs text-white/45">You’ll be returned here after signing in.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Loader2 className="h-6 w-6 animate-spin text-white/60" aria-hidden />
    </div>
  );
}

export default function ProfileRootPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" aria-hidden />
      </div>
    }>
      <ProfileRootPageContent />
    </Suspense>
  );
}
