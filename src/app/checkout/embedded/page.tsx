"use client";

/**
 * Stripe hosted checkout for workflow/prompt purchases.
 * Creates a Checkout Session and redirects the user to Stripe's hosted page.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

function safeBackHref(back: string | null): string {
  if (!back || typeof back !== "string") return "/marketplace";
  const path = back.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/marketplace";
  return path;
}

export default function EmbeddedCheckoutPage() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") as "workflow" | "prompt" | null;
  const workflowId = searchParams.get("workflowId") || undefined;
  const promptId = searchParams.get("promptId") || undefined;
  const sourceTable = searchParams.get("sourceTable") || undefined;
  const backParam = searchParams.get("back");
  const backHref = safeBackHref(backParam);

  const { getAccessToken, refreshAuthSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!type || (type !== "workflow" && type !== "prompt")) return;
    if ((type === "workflow" && !workflowId) || (type === "prompt" && !promptId)) return;
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        let token = await getAccessToken();
        if (!token) {
          await refreshAuthSession();
          token = await getAccessToken();
        }
        if (!token) {
          setError("Please sign in to continue checkout.");
          return;
        }
        const res = await fetch("/api/stripe/checkout/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({
            type,
            workflowId,
            promptId,
            sourceTable,
            embedded: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to start checkout");
          return;
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        setError("Invalid checkout response");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load checkout");
      }
    })();
  }, [type, workflowId, promptId, sourceTable, getAccessToken, refreshAuthSession]);

  if (!type || (type !== "workflow" && type !== "prompt")) {
    return (
      <div className="font-dm-sans min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#111113] p-8 text-center shadow-teal-glow">
          <p className="text-white/80 mb-6">
            Invalid checkout. Please go back and click Buy on a product.
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-[#00E5CC] hover:text-[#00E5CC]/90 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  if ((type === "workflow" && !workflowId) || (type === "prompt" && !promptId)) {
    return (
      <div className="font-dm-sans min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#111113] p-8 text-center shadow-teal-glow">
          <p className="text-white/80 mb-6">
            Missing product. Please go back and select a product.
          </p>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-[#00E5CC] hover:text-[#00E5CC]/90 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to product
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="font-dm-sans min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#111113] p-8 text-center shadow-teal-glow">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-200 text-sm mb-6">
            {error}
          </div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-[#00E5CC] hover:text-[#00E5CC]/90 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to product
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="font-dm-sans min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#111113] p-8 text-center shadow-teal-glow">
        <Loader2 className="w-10 h-10 text-[#00E5CC] animate-spin mx-auto mb-4" />
        <p className="text-white/80 mb-2">Redirecting to secure checkout…</p>
        <p className="flex items-center justify-center gap-1.5 text-white/50 text-xs">
          <Lock className="w-3.5 h-3.5" />
          Powered by Stripe
        </p>
      </div>
    </div>
  );
}
