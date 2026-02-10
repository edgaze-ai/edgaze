"use client";

import React from "react";
import { Clock, AlertCircle } from "lucide-react";

interface HandleCooldownBannerProps {
  lastChangedAt: string;
  nextAllowedAt: string;
  daysRemaining: number;
}

export default function HandleCooldownBanner({
  lastChangedAt,
  nextAllowedAt,
  daysRemaining,
}: HandleCooldownBannerProps) {
  const lastChangedDate = new Date(lastChangedAt);
  const nextAllowedDate = new Date(nextAllowedAt);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-5 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-[15px] font-semibold text-amber-400">Handle Change Locked</h3>
            <span className="text-[12px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
              {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
            </span>
          </div>
          <p className="text-[13px] text-white/70 leading-relaxed mb-3">
            You changed your handle recently and need to wait 60 days before changing it again. This cooldown period helps maintain consistency and trust with your audience.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-white/50">Last changed:</span>
              <span className="text-white/80 font-medium">{formatDate(lastChangedDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-white/50">Available again on:</span>
              <span className="text-white/80 font-medium">{formatDate(nextAllowedDate)}</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-amber-500/10">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400/70 shrink-0 mt-0.5" />
              <p className="text-[12px] text-white/60 leading-relaxed">
                The cooldown prevents frequent handle changes that could confuse your followers and disrupt your brand identity. Plan your handle changes carefully.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
