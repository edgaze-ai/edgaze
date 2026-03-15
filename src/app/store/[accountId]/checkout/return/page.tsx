"use client";

/**
 * Return page after embedded checkout (Stripe redirects here with session_id).
 * Shows success or "try again" based on session status.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";

export default function StoreCheckoutReturnPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const accountId = params.accountId as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "complete" | "open" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      queueMicrotask(() => {
        setStatus("error");
        setError("Missing session");
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/stripe/v2/checkout/session-status?session_id=${encodeURIComponent(sessionId)}&accountId=${encodeURIComponent(accountId)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setError(data.error || "Failed to get status");
          return;
        }
        if (data.status === "complete") {
          setStatus("complete");
        } else {
          setStatus("open");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Network error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, accountId]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <div
        className="relative max-w-md w-full rounded-2xl border border-white/10 bg-[#111113] p-8 text-center"
        style={{ boxShadow: "0 0 20px rgba(0,229,204,0.08)" }}
      >
        {status === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="w-12 h-12 text-[#00E5CC] animate-spin" />
            <p className="text-white/70">Confirming your payment…</p>
          </motion.div>
        )}

        {status === "complete" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-[#00E5CC]/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[#00E5CC]" />
            </div>
            <h1 className="font-instrument text-2xl text-white">Payment successful</h1>
            <p className="text-white/60 text-sm">
              Thanks for your purchase. You’ll receive a confirmation email shortly.
            </p>
            <Link
              href={`/store/${accountId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#00E5CC]/20 border border-[#00E5CC]/40 px-5 py-2.5 text-[#00E5CC] font-medium hover:bg-[#00E5CC]/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to store
            </Link>
          </motion.div>
        )}

        {status === "open" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="font-instrument text-2xl text-white">Payment not completed</h1>
            <p className="text-white/60 text-sm">
              The payment was cancelled or failed. You can try again from the store.
            </p>
            <Link
              href={`/store/${accountId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-5 py-2.5 text-white font-medium hover:bg-white/15 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to store
            </Link>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="font-instrument text-2xl text-white">Something went wrong</h1>
            <p className="text-white/60 text-sm">{error}</p>
            <Link
              href={`/store/${accountId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-5 py-2.5 text-white font-medium hover:bg-white/15 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to store
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
