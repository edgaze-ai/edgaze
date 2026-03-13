"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  loadConnectAndInitialize,
} from "@stripe/connect-js";
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from "@stripe/react-connect-js";
import {
  Shield,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  HelpCircle,
  CreditCard,
  Building2,
  FileText,
  LogIn,
  User,
} from "lucide-react";
import { useAuth } from "src/components/auth/AuthContext";
import { isAllowedOnboardingRef } from "src/lib/creators/onboarding-gate";

type PageState =
  | "loading"
  | "error"
  | "ready"
  | "complete"
  | "incomplete"
  | "logged_out";

const TRUST_CHIPS = [
  "Secure payout onboarding",
  "Powered by Stripe Connect",
  "Usually takes a few minutes",
  "Required to receive earnings",
];

const STEPS = [
  { id: "profile", label: "Creator profile", done: true },
  { id: "payout", label: "Payout setup", done: false, current: true },
  { id: "publish", label: "Ready to sell", done: false },
];

function SupportPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-2">
          Why this is required
        </h3>
        <ul className="space-y-2 text-sm text-white/60">
          <li className="flex items-start gap-2">
            <CreditCard className="h-4 w-4 text-cyan-400/80 shrink-0 mt-0.5" />
            Receive payouts from workflow sales
          </li>
          <li className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-cyan-400/80 shrink-0 mt-0.5" />
            Meet compliance and verification requirements
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-400/80 shrink-0 mt-0.5" />
            Keep creator payouts secure and reliable
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-2">
          What you may need
        </h3>
        <ul className="space-y-2 text-sm text-white/60">
          <li className="flex items-start gap-2">
            <Building2 className="h-4 w-4 text-cyan-400/80 shrink-0 mt-0.5" />
            Legal name or business details
          </li>
          <li className="flex items-start gap-2">
            <CreditCard className="h-4 w-4 text-cyan-400/80 shrink-0 mt-0.5" />
            Bank account information
          </li>
          <li className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-cyan-400/80 shrink-0 mt-0.5" />
            Tax or identity info depending on country
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-2">
          What happens next
        </h3>
        <p className="text-sm text-white/60 leading-relaxed">
          Finish payout setup, then start publishing and selling workflows. Edgaze
          takes 20% platform fee; you keep 80% of each sale.
        </p>
      </div>

      <Link
        href="/help"
        className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-cyan-400 transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
        Need help?
      </Link>
    </motion.div>
  );
}

function EmbeddedOnboardingContent({
  connectInstance,
  onExit,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectInstance: any;
  onExit: () => void;
}) {
  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      <ConnectAccountOnboarding
        onExit={onExit}
        onLoadError={({ error }) => {
          console.error("[Connect] Onboarding load error:", error);
        }}
      />
    </ConnectComponentsProvider>
  );
}

export default function CreatorsOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, profile, authReady, loading, openSignIn, refreshProfile, getAccessToken } = useAuth();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [gateChecked, setGateChecked] = useState(false);

  const fromRef = searchParams.get("from");
  const hasValidRef = isAllowedOnboardingRef(fromRef);

  useEffect(() => {
    if (gateChecked) return;
    setGateChecked(true);
    if (!hasValidRef) {
      router.replace("/creators");
      return;
    }
  }, [hasValidRef, router, gateChecked]);
  const [error, setError] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] = useState<unknown>(null);

  const publishableKey =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string)
      : "";

  const fetchClientSecret = useCallback(async (): Promise<{
    clientSecret: string;
    alreadyComplete?: boolean;
  }> => {
    const token = await getAccessToken();
    const res = await fetch("/api/stripe/v2/connect/account-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create account session");
    }
    if (data.status === "active") {
      return { clientSecret: data.clientSecret, alreadyComplete: true };
    }
    return { clientSecret: data.clientSecret };
  }, [getAccessToken]);

  useEffect(() => {
    if (!gateChecked || !hasValidRef) return;
    if (loading || !authReady) return;
    if (!userId) {
      setPageState("logged_out");
      return;
    }
    if (!publishableKey) {
      setError("Stripe publishable key not configured");
      setPageState("error");
      return;
    }

    setPageState("loading");
    setError(null);

    const fetchSecret = async () => {
      try {
        const result = await fetchClientSecret();
        const { clientSecret, alreadyComplete } = result;
        if (alreadyComplete) {
          setPageState("complete");
          return;
        }
        const instance = loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => {
            const result = await fetchClientSecret();
            return result.clientSecret;
          },
          appearance: {
            variables: {
              colorText: "#f3f4f6",
              colorBackground: "#14171D",
              colorPrimary: "#22d3ee",
              colorDanger: "#f87171",
              borderRadius: "12px",
            },
          },
        });
        setConnectInstance(instance);
        setPageState("ready");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setPageState("error");
      }
    };

    fetchSecret();
  }, [loading, authReady, userId, publishableKey, fetchClientSecret]);

  const handleOnboardingExit = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/v2/connect/status");
      const data = await res.json();
      if (data?.readyToProcessPayments) {
        await refreshProfile();
        setPageState("complete");
      } else {
        setPageState("incomplete");
      }
    } catch {
      setPageState("incomplete");
    }
  }, [refreshProfile]);

  const handleRetry = useCallback(async () => {
    setPageState("loading");
    setError(null);
    const token = await getAccessToken();
    fetch("/api/stripe/v2/connect/account-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        return data;
      })
      .then((data) => {
        if (!data.clientSecret) throw new Error(data.error || "Failed");
        if (data.status === "active") {
          setPageState("complete");
          return;
        }
        const instance = loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => {
            const t = await getAccessToken();
            const r = await fetch("/api/stripe/v2/connect/account-session", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(t ? { Authorization: `Bearer ${t}` } : {}),
              },
              credentials: "include",
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Failed");
            return d.clientSecret;
          },
          appearance: {
            variables: {
              colorText: "#f3f4f6",
              colorBackground: "#14171D",
              colorPrimary: "#22d3ee",
              colorDanger: "#f87171",
              borderRadius: "12px",
            },
          },
        });
        setConnectInstance(instance);
        setPageState("ready");
      })
      .catch((err) => {
        setError(err?.message || "Retry failed");
        setPageState("error");
      });
  }, [publishableKey, getAccessToken]);

  if (gateChecked && !hasValidRef) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#0d0d0d]">
        <div className="text-center">
          <p className="text-white/60 text-[15px]">Redirecting to Creator Program…</p>
          <Link href="/creators" className="mt-4 inline-block text-cyan-400 hover:underline text-sm">
            Click here if not redirected
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !authReady || !gateChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#0d0d0d]">
        <div className="flex items-center gap-3 text-white/50 text-[15px]">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          Loading…
        </div>
      </div>
    );
  }

  if (pageState === "logged_out") {
    return (
      <div className="min-h-screen w-full bg-[#0d0d0d] text-white flex flex-col items-center justify-center px-6 py-16">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[#0d0d0d]" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 100% 60% at 50% 0%, rgba(120,119,198,0.12), transparent 60%), radial-gradient(ellipse 80% 50% at 80% 80%, rgba(34,211,238,0.06), transparent 50%)",
            }}
          />
        </div>
        <div className="w-full max-w-md mx-auto text-center">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-10 sm:p-12 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-6">
              <User className="h-7 w-7 text-white/60" />
            </div>
            <h1 className="text-[22px] sm:text-[24px] font-semibold text-white tracking-tight">
              Payout setup
            </h1>
            <p className="mt-3 text-[15px] text-white/55 leading-relaxed max-w-sm mx-auto">
              Sign in to complete payout setup and start receiving earnings on Edgaze.
            </p>
            <button
              type="button"
              onClick={openSignIn}
              className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black px-6 py-4 text-[15px] font-semibold hover:bg-white/95 transition-colors"
            >
              <LogIn className="h-5 w-5" />
              Sign in
            </button>
            <Link
              href="/creators"
              className="mt-5 inline-block text-[14px] text-white/50 hover:text-white/70 transition-colors"
            >
              ← Back to Creator Program
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#0d0d0d]">
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-pink-500/[0.04] blur-[100px]" />
      </div>

      <header className="relative z-10 shrink-0 border-b border-white/10 bg-[#0d0d0d]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={28}
                height={28}
                className="h-7 w-auto"
              />
              <span className="font-semibold text-white">Edgaze</span>
            </Link>
            <span className="text-white/40 text-sm hidden sm:inline">
              Creator Program / Payout Setup
            </span>
          </div>
          <Link
            href="/creators"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to creators
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16 sm:pt-8 sm:pb-20">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {STEPS.map((step, i) => (
              <React.Fragment key={step.id}>
                <span
                  className={`text-xs font-medium ${
                    step.current
                      ? "text-cyan-400"
                      : step.done
                      ? "text-white/50"
                      : "text-white/30"
                  }`}
                >
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="text-white/20">/</span>
                )}
              </React.Fragment>
            ))}
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-xl sm:text-2xl font-semibold text-white tracking-tight"
          >
            Set up payouts to start selling
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mt-1.5 text-white/60 max-w-xl text-sm sm:text-base"
          >
            Complete secure payout setup through Stripe to start receiving
            earnings when your workflows sell on Edgaze. Marketplace: 20%
            platform fee, 80% to you.
          </motion.p>
          <div className="flex flex-wrap gap-2 mt-3">
            {TRUST_CHIPS.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70"
              >
                <Shield className="h-3.5 w-3.5 text-cyan-400/80" />
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className={`grid gap-6 lg:gap-8 ${pageState === "complete" ? "grid-cols-1" : "lg:grid-cols-[1fr,320px]"}`}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-6"
          >
            <AnimatePresence mode="wait">
              {pageState === "loading" && (
                <motion.div
                  key="loading"
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 sm:p-10 min-h-[320px] flex flex-col items-center justify-center"
                >
                  <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-cyan-500/20 border border-cyan-500/30" />
                    <p className="text-white/60 text-sm">
                      Preparing secure payout setup...
                    </p>
                    <div className="h-2 w-48 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500/40 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(34,211,238,0.3), transparent)",
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {pageState === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 sm:p-10 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl text-red-400">!</span>
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-2">
                    We couldn&apos;t load payout setup
                  </h2>
                  <p className="text-white/60 text-sm mb-6 max-w-md mx-auto">
                    {error || "Please try again. If the issue persists, contact support."}
                  </p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-6 py-3 text-sm font-medium text-white transition-colors"
                  >
                    Retry setup
                  </button>
                </motion.div>
              )}

              {(pageState === "incomplete" || pageState === "ready") && (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-visible"
                >
                  <div className="p-4 sm:p-6 min-h-[260px] overflow-y-auto bg-[#14171D]">
                    {connectInstance ? (
                      <EmbeddedOnboardingContent
                        connectInstance={connectInstance}
                        onExit={handleOnboardingExit}
                      />
                    ) : null}
                  </div>
                  <p className="px-4 sm:px-6 pb-4 text-xs text-white/40 bg-[#14171D]">
                    Your information is processed securely by Stripe for identity
                    and payout verification.
                  </p>
                </motion.div>
              )}

              {pageState === "complete" && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                  className="relative w-full rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden"
                >
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-cyan-500/20 via-pink-500/15 to-cyan-500/20 blur-[80px]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full bg-cyan-500/10 blur-[60px]" />
                  </div>
                  <div className="relative py-16 sm:py-20 px-6 sm:px-10 text-center flex flex-col items-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                      className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center mx-auto mb-8"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 opacity-90 animate-pulse" style={{ animationDuration: "2s" }} />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/50 via-pink-400/50 to-cyan-400/50 blur-2xl" />
                      <div className="absolute inset-1 rounded-full bg-[#0d0d0d] flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 sm:w-14 sm:h-14 text-cyan-400 drop-shadow-[0_0_24px_rgba(34,211,238,0.6)]" strokeWidth={2} />
                      </div>
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-2xl sm:text-3xl font-bold text-white mb-3"
                    >
                      <span className="bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                        Onboarding successful
                      </span>
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-white/60 text-sm sm:text-base max-w-sm mx-auto mb-10"
                    >
                      Your creator account is ready to receive earnings on Edgaze.
                    </motion.p>
                    <motion.button
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      type="button"
                      onClick={() => router.push("/dashboard/earnings")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-pink-400/90 to-cyan-400 px-8 py-4 text-base font-semibold text-white shadow-[0_0_32px_rgba(34,211,238,0.35)] hover:shadow-[0_0_48px_rgba(34,211,238,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      View Earnings Dashboard
                      <ArrowLeft className="h-5 w-5 rotate-180" />
                    </motion.button>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-8 text-xs text-white/40"
                    >
                      Need help? <Link href="/help" className="text-cyan-400 hover:underline">Help center</Link>
                      {" · "}
                      <a href="mailto:support@edgaze.ai" className="text-cyan-400 hover:underline">support@edgaze.ai</a>
                    </motion.p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {pageState !== "complete" && (
            <aside className="hidden lg:block">
              <SupportPanel />
            </aside>
          )}
        </div>

        {pageState !== "complete" && (
          <div className="mt-8 lg:hidden">
            <SupportPanel />
          </div>
        )}
      </main>
    </div>
  );
}
