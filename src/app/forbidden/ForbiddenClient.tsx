// src/app/forbidden/ForbiddenClient.tsx
"use client";

import React, { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeReturnTo(path: string) {
  if (!path || typeof path !== "string") return "/marketplace";
  if (!path.startsWith("/")) return "/marketplace";
  if (path.startsWith("//")) return "/marketplace";
  if (path.includes("http://") || path.includes("https://")) return "/marketplace";
  return path;
}

export default function ForbiddenClient() {
  const router = useRouter();
  const params = useSearchParams();

  const returnTo = useMemo(() => {
    const qp = params.get("returnTo") || "/marketplace";
    return safeReturnTo(qp);
  }, [params]);

  return (
    <div className="min-h-[100dvh] w-full bg-black">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="text-xs uppercase tracking-widest text-white/50">Access</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Forbidden</h1>
          <p className="mt-2 text-sm text-white/60 leading-relaxed">
            You don’t have permission to view this page.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.replace(returnTo)}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={() => router.replace("/marketplace")}
              className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
            >
              Marketplace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
