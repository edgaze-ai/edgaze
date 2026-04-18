"use client";

import React, { useId } from "react";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { cn } from "../../lib/utils";
import { toSafeDomId } from "@/lib/security/safe-values";

export const VERIFIED_CREATOR_TOOLTIP =
  "Verified creator on Edgaze\nIdentity confirmed and work quality reviewed";

type Size = "xs" | "sm" | "md";

/** Single gradient icon — no rings */
const iconBox: Record<Size, string> = {
  xs: "h-4 w-4 min-w-4",
  sm: "h-[18px] w-[18px] min-w-[18px]",
  md: "h-5 w-5 min-w-5",
};

type Props = {
  className?: string;
  variant?: "mark" | "pill";
  size?: Size;
};

function GradientVerifiedIcon({ size, className }: { size: Size; className?: string }) {
  const uid = useId();
  const gradId = React.useMemo(() => toSafeDomId(uid, "eg_verified_grad"), [uid]);

  return (
    <>
      <svg width={0} height={0} className="pointer-events-none absolute" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="45%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
      </svg>
      <RiVerifiedBadgeFill
        className={cn(
          "shrink-0 [shape-rendering:geometricPrecision]",
          // Subtle depth only — heavy drop-shadow loses clean edges at small sizes
          "drop-shadow-[0_0.5px_0.8px_rgba(0,0,0,0.28)]",
          iconBox[size],
          className,
        )}
        fill={`url(#${gradId})`}
        aria-hidden
      />
    </>
  );
}

/**
 * One Remix “verified” glyph, cyan → pink gradient. No stacked circles.
 */
export default function VerifiedCreatorBadge({ className, variant = "mark", size = "sm" }: Props) {
  const aria = VERIFIED_CREATOR_TOOLTIP.replace("\n", " ");

  if (variant === "pill") {
    return (
      <span
        className={cn(
          "inline-flex select-none items-center gap-2 rounded-lg",
          "border border-white/12 bg-white/[0.06] px-2.5 py-1",
          "text-[10px] font-semibold uppercase tracking-[0.11em] text-white/95",
          className,
        )}
        title={VERIFIED_CREATOR_TOOLTIP}
        aria-label={aria}
      >
        <GradientVerifiedIcon size={size} />
        Verified
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex shrink-0 select-none leading-none", className)}
      title={VERIFIED_CREATOR_TOOLTIP}
      role="img"
      aria-label={aria}
    >
      <GradientVerifiedIcon size={size} />
    </span>
  );
}
