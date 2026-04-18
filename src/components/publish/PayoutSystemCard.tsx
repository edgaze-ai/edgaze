"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Edgaze-branded card explaining the payout system with clear onboarding guidance.
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
        boxShadow: "0 0 36px rgba(6, 182, 212, 0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25 animate-payout-shimmer"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 0%, rgba(6, 182, 212, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(236, 72, 153, 0.06) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
            <Image
              src="/brand/edgaze-mark.png"
              alt="Edgaze"
              width={22}
              height={22}
              className="h-[22px] w-[22px]"
            />
          </div>
          <div>
            <div className="text-[16px] font-semibold tracking-tight text-white">
              Edgaze Payout System
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
              Sell Now, Onboard Later
            </div>
          </div>
        </div>

        <p className="text-[12px] text-white/70 leading-relaxed">
          You can start selling your {variant} immediately without completing payout onboarding on
          day one. If buyers purchase before onboarding is complete, Edgaze can hold eligible
          proceeds while you finish setup later. Complete Creator Program onboarding within{" "}
          <strong className="text-white/90">90 days</strong> of your first sale to receive payouts.
          Pricing: {minPrice}–{maxPrice} per purchase.
        </p>
        <p className="mt-2 text-[11px] text-white/50">
          This is designed to help creators launch faster while keeping payout operations compliant
          and orderly. If payout setup is not completed in time, pending payouts may be cancelled
          per our{" "}
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
              I understand the payout onboarding requirement and agree to the{" "}
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
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/20 px-4 py-2.5 text-[12px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/30"
        >
          Start payout onboarding →
        </Link>
      </div>
    </div>
  );
}
