"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

export default function ForbiddenPage() {
  const sp = useSearchParams();
  const from = sp.get("from") || "/admin";

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-lg font-semibold">Access denied</div>
        <div className="text-sm text-white/60 mt-1">
          You don’t have permission to view this page.
        </div>

        <div className="text-xs text-white/40 mt-3 break-all">
          Requested: {from}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <a
            href="/marketplace"
            className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          >
            Go to marketplace
          </a>
        </div>
      </div>
    </div>
  );
}
