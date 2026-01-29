"use client";

import React from "react";

type Size = "xs" | "sm" | "md" | "lg";

/** Premium OG badge text */
const BADGE_TEXT = "★ OG";

/** Subtle glass styling - Edgaze brand: cyan/glass/dark */
const baseStyles = [
  "inline-flex shrink-0 items-center justify-center rounded-full",
  "bg-white/5",
  "border border-white/10",
  "text-cyan-300",
  "px-2 py-[1px]",
  "text-xs font-medium leading-tight",
].join(" ");

const sizeClasses: Record<Size, string> = {
  xs: "text-[10px] px-1.5 py-[1px]",
  sm: "text-[11px] px-2 py-[1px]",
  md: "text-xs px-2 py-[1px]",
  lg: "text-xs px-2.5 py-[1px]",
};

/** Compact (pill): subtle glass with tighter padding */
const compactStyles = [
  "inline-flex shrink-0 items-center justify-center rounded-full",
  "bg-white/5",
  "border border-white/10",
  "text-cyan-300",
  "px-1.5 py-[1px]",
].join(" ");

/**
 * Subtle "★ OG" badge. Glass aesthetic, cyan brand colors, minimal design.
 * Matches Edgaze brand: Linear/Vercel/GitHub style - not gamified.
 * title/aria-label stay "Founding Creator" for accessibility.
 * Use compact in profile pill only.
 */
export default function FoundingCreatorBadge({
  className = "",
  size = "md",
  compact = false,
}: {
  className?: string;
  size?: Size;
  compact?: boolean;
}) {
  const styles = compact ? compactStyles : baseStyles;
  const sz = compact ? sizeClasses[size] : sizeClasses[size];

  return (
    <span
      className={[styles, sz, className].filter(Boolean).join(" ")}
      title="Founding Creator"
      role="status"
      aria-label="Founding Creator"
    >
      {BADGE_TEXT}
    </span>
  );
}
