"use client";

import React from "react";
import { Sparkles } from "lucide-react";

const TOOLTIP =
  "This creator joined while Edgaze was in beta and was an early supporter of the platform.";

/**
 * OG / founding creator — **public profile only** (not marketplace or comments).
 */
export default function FoundingCreatorBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={[
        "inline-flex select-none items-center gap-1.5 rounded-full",
        "border border-cyan-300/[0.22] bg-gradient-to-r from-cyan-400/[0.14] via-white/[0.06] to-fuchsia-400/[0.12]",
        "px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/95",
        "ring-1 ring-inset ring-white/10 backdrop-blur-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={TOOLTIP}
      aria-label={TOOLTIP}
    >
      <Sparkles className="h-3 w-3 shrink-0 text-cyan-200/95" strokeWidth={2} aria-hidden />
      OG Creator
    </span>
  );
}
