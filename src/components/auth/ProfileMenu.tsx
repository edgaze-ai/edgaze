"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";
import { DEFAULT_AVATAR_SRC } from "../../config/branding";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

export default function ProfileMenu() {
  const { user, profile, signOut, openSignIn, authReady, userId } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // If signed out
  if (!userId) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:border-cyan-400 hover:bg-white/10 transition-colors"
      >
        Sign in
      </button>
    );
  }

  // Signed in but profile/user object not ready yet (common right after auth)
  const readyHandle = useMemo(
    () => safeHandle(profile?.handle) || safeHandle(user?.handle),
    [profile?.handle, user?.handle]
  );

  const avatarSrc = profile?.avatar_url || DEFAULT_AVATAR_SRC;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-3 rounded-full border px-3 py-1.5",
          "border-white/18 bg-white/5 hover:border-cyan-400 transition-colors"
        )}
      >
        <div className="relative h-7 w-7 overflow-hidden rounded-full bg-white/10">
          <Image src={avatarSrc} alt="Profile" fill className="object-cover" />
        </div>

        <div className="flex flex-col items-start">
          <span className="max-w-[120px] truncate text-xs font-medium text-white/90">
            {profile?.full_name || profile?.handle || user?.name || "Creator"}
          </span>

          <span className="text-[10px] text-white/55">
            {profile?.plan || "Free"} plan
            {!profile && (
              <span className="ml-2 inline-flex items-center gap-1 text-white/45">
                <Loader2 className="h-3 w-3 animate-spin" />
                syncing…
              </span>
            )}
          </span>
        </div>

        <ChevronDown className="h-3.5 w-3.5 text-white/70" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/16 bg-[#050505] shadow-xl z-30 overflow-hidden">
          {/* If handle exists, go straight to /profile/<handle>, else go to /profile (redirect page). */}
          <Link
            href={readyHandle ? `/profile/${encodeURIComponent(readyHandle)}` : "/profile"}
            className={cn(
              "block px-3 py-2 text-sm text-white/90 hover:bg-white/10",
              !readyHandle && "opacity-80"
            )}
            onClick={() => setOpen(false)}
          >
            View profile
          </Link>

          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
