"use client";

import React from "react";
import Link from "next/link";
import { useImpersonation } from "./ImpersonationContext";

export default function ImpersonationBanner() {
  const { state, endImpersonation } = useImpersonation();

  if (!state.active) return null;

  return (
    <div
      className="sticky top-0 z-[200] border-b border-amber-500/40 bg-gradient-to-r from-amber-950/95 via-amber-900/90 to-amber-950/95 px-3 py-3 text-amber-50 shadow-[0_4px_24px_rgba(0,0,0,0.35)] backdrop-blur-md sm:px-4"
      role="region"
      aria-label="Admin impersonation active"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-[13px] font-semibold tracking-tight text-amber-100 sm:text-sm">
            Impersonating @{state.handle}
            {state.fullName ? (
              <span className="font-normal text-amber-200/90"> — {state.fullName}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-amber-200/75 sm:text-xs">
            You are acting inside this creator workspace as an admin. Your actions are logged.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => void endImpersonation()}
            className="rounded-lg bg-amber-400 px-3 py-2 text-[12px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-300 sm:px-4 sm:text-[13px]"
          >
            End impersonation
          </button>
          <Link
            href={state.returnToAdminPath}
            className="rounded-lg border border-amber-400/50 bg-amber-950/40 px-3 py-2 text-[12px] font-semibold text-amber-50 transition hover:bg-amber-950/60 sm:px-4 sm:text-[13px]"
          >
            Return to admin panel
          </Link>
        </div>
      </div>
    </div>
  );
}
