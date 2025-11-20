"use client";

import Link from "next/link";

export default function PublicProfileView({ handle }: { handle: string }) {
  const displayHandle = handle || "creator";

  return (
    <div className="min-h-screen bg-[#050505] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-white/50">Creator profile</p>
          <h1 className="text-3xl font-bold">@{displayHandle}</h1>
          <p className="text-white/60 text-sm">
            Public creator profiles are coming soon. This URL is already
            reserved for @{displayHandle}.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 space-y-3">
          <p className="text-sm text-white/70">
            Once profiles are connected to your backend, this page will show:
          </p>
          <ul className="list-disc list-inside text-sm text-white/65 space-y-1">
            <li>Creator name, avatar, banner, and bio</li>
            <li>Social links (YouTube, TikTok, X, GitHub, etc.)</li>
            <li>Follower count, workflows, and prompts</li>
            <li>Featured workflows from this creator</li>
          </ul>
        </div>

        <div className="text-sm text-white/60">
          <Link
            href="/"
            className="underline decoration-white/40 underline-offset-2 hover:text-cyan-300"
          >
            Back to Edgaze marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
