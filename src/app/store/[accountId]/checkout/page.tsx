"use client";

/**
 * Embedded Stripe Checkout for store products — Edgaze theme.
 * Creates session with embedded mode and mounts Stripe Embedded Checkout via stripe.initEmbeddedCheckout().
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { stripeConfig } from "@/lib/stripe/config";

export default function StoreEmbeddedCheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const accountId = params.accountId as string;
  const productId = searchParams.get("productId");
  const priceId = searchParams.get("priceId") || undefined;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountRef = useRef<HTMLDivElement>(null);

  const fetchClientSecret = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/stripe/v2/checkout/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        connectedAccountId: accountId,
        productId: productId || undefined,
        priceId: priceId || undefined,
        quantity: 1,
        embedded: true,
        metadata: productId ? { product_id: productId } : {},
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to start checkout");
    }
    if (!data.clientSecret) {
      throw new Error("Invalid checkout session");
    }
    return data.clientSecret;
  }, [accountId, productId, priceId]);

  useEffect(() => {
    if (!productId && !priceId) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let mounted = true;
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    (async () => {
      try {
        const stripe = await loadStripe(stripeConfig.publishableKey, {
          stripeAccount: accountId,
        });
        if (!stripe || !mountRef.current) return;
        const checkout = await stripe.initEmbeddedCheckout({ fetchClientSecret });
        if (!mounted) return;
        checkout.mount(mountRef.current);
        setLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Checkout failed to load");
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [accountId, fetchClientSecret, productId, priceId]);

  if (!productId && !priceId) {
    return (
      <div className="font-dm-sans min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#111113] p-8 text-center shadow-teal-glow">
          <p className="text-white/80 mb-6">Select a product from the store to checkout.</p>
          <Link
            href={`/store/${accountId}`}
            className="inline-flex items-center gap-2 text-[#00E5CC] hover:text-[#00E5CC]/90 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="font-dm-sans min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      <div
        className="flex-1 flex flex-col min-h-0 overflow-y-auto"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,229,204,0.08), transparent),
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 24px 24px, 24px 24px",
        }}
      >
        <header className="flex-shrink-0 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
            <Link
              href={`/store/${accountId}`}
              className="inline-flex items-center gap-2 text-white/70 hover:text-[#00E5CC] transition-colors text-sm font-medium min-w-0"
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Back to store</span>
            </Link>
            <span className="flex items-center gap-1.5 text-white/50 text-xs flex-shrink-0">
              <Lock className="w-3.5 h-3.5" />
              Secure payment
            </span>
          </div>
        </header>

        <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-10 sm:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-white/10 bg-[#111113] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_48px_rgba(0,0,0,0.4)] overflow-hidden"
            style={{ boxShadow: "0 0 24px rgba(0,229,204,0.06)" }}
          >
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-white/10">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Checkout
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Complete your purchase. Powered by Stripe.
              </p>
            </div>

            <div className="p-4 sm:p-6 min-h-[340px] sm:min-h-[380px] relative">
              {error ? (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-200 text-sm">
                  {error}
                </div>
              ) : (
                <>
                  <div ref={mountRef} className="min-h-[300px] sm:min-h-[340px]" />
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#111113]/95 rounded-b-2xl">
                      <Loader2 className="w-10 h-10 text-[#00E5CC] animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
