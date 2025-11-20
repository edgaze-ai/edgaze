"use client";

import React from "react";
import { Search } from "lucide-react";
import ProfileMenu from "../components/auth/ProfileMenu";
import { useAuth } from "../components/auth/AuthContext";

type PlaceholderWorkflow = {
  id: number;
  title: string;
  description: string;
};

const PLACEHOLDER_WORKFLOWS: PlaceholderWorkflow[] = Array.from(
  { length: 8 },
  (_, i) => ({
    id: i + 1,
    title: `Placeholder workflow #${i + 1}`,
    description:
      "This slot will be used for a real creator workflow. For now it just triggers the sign-in gate.",
  })
);

export default function MarketplacePage() {
  const { requireAuth } = useAuth();

  const handleCardClick = () => {
    // For now: just trigger the sign-in modal via requireAuth
    requireAuth();
  };

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-white/10">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Edgaze Marketplace</h1>
          <p className="text-sm text-white/55">
            Discover workflows shared by AI-native creators.
          </p>
        </div>

        {/* Center search */}
        <div className="flex-1 px-8 max-w-2xl">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">
            <Search className="h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Search workflows, creators, or tags..."
              className="w-full bg-transparent outline-none text-sm placeholder:text-white/40"
            />
            <span className="text-[11px] text-white/35 border border-white/15 rounded-full px-2 py-0.5">
              ⌘K
            </span>
          </div>
        </div>

        {/* Right: unified profile chip (avatar + name + plan) */}
        <div className="flex items-center gap-3">
          <ProfileMenu />
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto px-8 pb-10 pt-6">
        <section className="mb-4">
          <h2 className="text-lg font-semibold mb-1">Featured workflows</h2>
          <p className="text-sm text-white/55">
            This is a placeholder grid. Clicking a card will ask users to sign
            in for now.
          </p>
        </section>

        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
            {PLACEHOLDER_WORKFLOWS.map((wf) => (
              <button
                key={wf.id}
                onClick={handleCardClick}
                className="group flex flex-col items-stretch text-left rounded-2xl border border-white/12 bg-white/[0.02] hover:bg-white/[0.06] hover:border-cyan-400/60 transition-colors p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-300">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    Coming soon
                  </span>
                </div>

                <h3 className="text-base font-semibold mb-1">
                  {wf.title}
                </h3>
                <p className="text-sm text-white/60 mb-4 line-clamp-3">
                  {wf.description}
                </p>

                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-white/50">
                  <span>Click to preview</span>
                  <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px]">
                    Sign-in required
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
