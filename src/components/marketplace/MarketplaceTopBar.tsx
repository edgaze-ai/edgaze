"use client";

import React from "react";
import { useAuth } from "../auth/AuthContext";
import ProfileMenu from "../auth/ProfileMenu";

export default function MarketplaceTopBar() {
  const { user, openSignIn } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      {/* Left side – plan and any other chips */}
      <div className="flex items-center gap-3">
        {/* Current plan chip */}
        <div className="inline-flex h-10 items-center rounded-full bg-white/5 px-4 text-xs uppercase tracking-wide text-white/70">
        {"Free plan"}
        </div>

        {/* Example placeholder for filters / view mode etc, all h-10 for equal height */}
        {/* <button className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/5 px-4 text-xs text-white/80 hover:bg-white/10">
          Filters
        </button> */}
      </div>

      {/* Right side – profile / sign in */}
      {user ? (
        <ProfileMenu />
      ) : (
        <button
          type="button"
          onClick={openSignIn}
          className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/5 px-4 text-xs uppercase tracking-wide text-white/80 hover:bg-white/10"
        >
          Sign in
        </button>
      )}
    </header>
  );
}
