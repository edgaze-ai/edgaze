"use client";

import React from "react";
import Link from "next/link";

/**
 * Animated Edgaze-branded card explaining the payout system (Sell Now, Payout Later).
 * Black bg with subtle gradient animation.
 */
export function PayoutSystemCard({
  variant = "prompt",
  showCheckbox,
  acceptedCreatorTerms,
  onAcceptedChange,
}: {
  variant?: "prompt" | "workflow";
  showCheckbox?: boolean;
  acceptedCreatorTerms?: boolean;
  onAcceptedChange?: (checked: boolean) => void;
}) {
  const minPrice = variant === "workflow" ? "$5" : "$3";
  const maxPrice = variant === "workflow" ? "$150" : "$50";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black p-5"
      style={{
        boxShadow: "0 0 40px rgba(6, 182, 212, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Animated gradient background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 animate-payout-shimmer"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 0%, rgba(6, 182, 212, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-50 animate-payout-pulse"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[11px] font-bold tracking-widest uppercase text-cyan-400/90"
            style={{ textShadow: "0 0 20px rgba(6, 182, 212, 0.3)" }}
          >
            Edgaze
          </span>
          <span className="text-[11px] text-white/40">Payout system</span>
        </div>

        <h3 className="text-[14px] font-semibold text-white/95 mb-2">
          Sell now, receive payouts later
        </h3>
        <p className="text-[12px] text-white/70 leading-relaxed">
          You can list your {variant} for sale immediately—no payout account required to start. When
          customers buy, funds are held by Edgaze. Complete Creator Program onboarding within{" "}
          <strong className="text-white/90">90 days</strong> of your first sale to receive payouts.
          Pricing: {minPrice}–{maxPrice} per purchase.
        </p>
        <p className="mt-2 text-[11px] text-white/50">
          If payout setup isn&apos;t completed in time, pending payouts may be cancelled per our{" "}
          <Link
            href="/docs/creator-terms"
            className="text-cyan-400/90 hover:text-cyan-300 underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Creator Terms
          </Link>
          .
        </p>

        {showCheckbox && onAcceptedChange !== undefined && (
          <label className="mt-4 flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={acceptedCreatorTerms}
              onChange={(e) => onAcceptedChange(e.target.checked)}
              className="mt-1 rounded border-white/30 bg-white/5 text-cyan-500 focus:ring-cyan-400/50"
            />
            <span className="text-[12px] text-white/90">
              I understand the 90-day payout rule and agree to the{" "}
              <Link
                href="/docs/creator-terms"
                className="text-cyan-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Creator Terms
              </Link>
              .
            </span>
          </label>
        )}

        <Link
          href="/creators/onboarding"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/20 px-4 py-2.5 text-[12px] font-semibold text-cyan-200 transition-colors"
        >
          Complete payout setup →
        </Link>
      </div>
    </div>
  );
}
