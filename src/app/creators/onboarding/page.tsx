"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { loadConnectAndInitialize } from "@stripe/connect-js/pure";
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js";
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
import {
  ALLOWED_PAYOUT_COUNTRIES_SORTED,
  isAllowedPayoutCountry,
} from "src/lib/creators/allowed-countries";
import { isAllowedOnboardingRef } from "src/lib/creators/onboarding-gate";

type PageState = "loading" | "error" | "ready" | "complete" | "incomplete";

function syncPayoutCountrySelectFromProfile(
  profile: { country?: string | null } | null | undefined,
  setCode: React.Dispatch<React.SetStateAction<string>>,
) {
  const c = profile?.country?.trim().toUpperCase();
  if (c && isAllowedPayoutCountry(c)) {
    setCode(c);
  }
}

function SupportPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-2">Why this is required</h3>
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
        <h3 className="text-sm font-semibold text-white/90 mb-2">What you may need</h3>
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
        <h3 className="text-sm font-semibold text-white/90 mb-2">What happens next</h3>
        <p className="text-sm text-white/60 leading-relaxed">
          Finish payout setup, then start publishing and selling workflows. Edgaze takes 20%
          platform fee; you keep 80% of each sale.
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

function CreatorsOnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    userId,
    authReady,
    loading,
    openSignIn,
    refreshProfile,
    getAccessToken,
    profile,
    updateProfile,
  } = useAuth();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [payoutCountryCode, setPayoutCountryCode] = useState("");
  const [countrySaving, setCountrySaving] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);

  const fromRef = searchParams.get("from");
  const hasValidRef = isAllowedOnboardingRef(fromRef);

  const countryOk = Boolean(
    profile?.country && isAllowedPayoutCountry(String(profile.country).trim().toUpperCase()),
  );

  useEffect(() => {
    if (!userId || !authReady || loading) return;
    if (!profile) {
      void refreshProfile();
    }
  }, [userId, authReady, loading, profile, refreshProfile]);

  useEffect(() => {
    if (!hasValidRef) {
      router.replace("/creators");
    }
  }, [hasValidRef, router]);

  const [error, setError] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] = useState<unknown>(null);
  /** Bumps when payout country changes after a failure so we recreate the Connect session with a fresh account if needed. */
  const [onboardingAttemptKey, setOnboardingAttemptKey] = useState(0);

  const publishableKey =
    typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string) : "";

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
      const msg =
        data?.code === "missing_payout_country"
          ? data.error ||
            "Choose your payout country first so we can open the correct Stripe bank flow for your region."
          : data.error || "Failed to create account session";
      throw new Error(msg);
    }
    if (data.status === "active") {
      return { clientSecret: data.clientSecret, alreadyComplete: true };
    }
    return { clientSecret: data.clientSecret };
  }, [getAccessToken]);

  useEffect(() => {
    if (!hasValidRef) return;
    if (loading || !authReady) return;
    if (!userId) return;
    if (!profile || !countryOk) return;
    if (!publishableKey) return;

    let cancelled = false;
    const fetchSecret = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setPageState("loading");
      setError(null);
      try {
        const result = await fetchClientSecret();
        if (cancelled) return;
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
        if (cancelled) return;
        setConnectInstance(instance);
        setPageState("ready");
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Something went wrong";
        syncPayoutCountrySelectFromProfile(profile, setPayoutCountryCode);
        setError(msg);
        setPageState("error");
      }
    };

    fetchSecret();
    return () => {
      cancelled = true;
    };
  }, [
    hasValidRef,
    loading,
    authReady,
    userId,
    profile,
    countryOk,
    publishableKey,
    fetchClientSecret,
    onboardingAttemptKey,
  ]);

  const checkConnectStatusAndMaybeComplete = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/stripe/v2/connect/status");
      const data = await res.json();
      const ready = data?.readyForPayouts === true || data?.readyToProcessPayments === true;
      if (ready) {
        await refreshProfile();
        setPageState("complete");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [refreshProfile]);

  const handleOnboardingExit = useCallback(async () => {
    const ready = await checkConnectStatusAndMaybeComplete();
    if (!ready) {
      setPageState("incomplete");
    }
  }, [checkConnectStatusAndMaybeComplete]);

  /** Stripe often ends on “Information submitted” without calling onExit; poll until payouts activate. */
  useEffect(() => {
    if (pageState !== "ready" && pageState !== "incomplete") return;
    const tick = () => {
      void checkConnectStatusAndMaybeComplete();
    };
    tick();
    const id = window.setInterval(tick, 12_000);
    return () => window.clearInterval(id);
  }, [pageState, checkConnectStatusAndMaybeComplete]);

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
        syncPayoutCountrySelectFromProfile(profile, setPayoutCountryCode);
        setError(err?.message || "Retry failed");
        setPageState("error");
      });
  }, [publishableKey, getAccessToken, profile]);

  const handleSavePayoutCountry = useCallback(async () => {
    const code = payoutCountryCode.trim().toUpperCase();
    if (!code || !isAllowedPayoutCountry(code)) {
      setCountryError("Choose your country from the list.");
      return;
    }
    setCountrySaving(true);
    setCountryError(null);
    const result = await updateProfile({ country: code });
    setCountrySaving(false);
    if (!result.ok) {
      setCountryError(result.error ?? "Could not save country.");
      return;
    }
    await refreshProfile();
  }, [payoutCountryCode, updateProfile, refreshProfile]);

  /** After Stripe or API errors: pick another country and restart (server may replace the Connect account). */
  const handleSavePayoutCountryAfterError = useCallback(async () => {
    const code = payoutCountryCode.trim().toUpperCase();
    if (!code || !isAllowedPayoutCountry(code)) {
      setCountryError("Choose your country from the list.");
      return;
    }
    setCountrySaving(true);
    setCountryError(null);
    const result = await updateProfile({ country: code });
    if (!result.ok) {
      setCountrySaving(false);
      setCountryError(result.error ?? "Could not save country.");
      return;
    }
    await refreshProfile();
    setCountrySaving(false);
    setConnectInstance(null);
    setError(null);
    setOnboardingAttemptKey((k) => k + 1);
  }, [payoutCountryCode, updateProfile, refreshProfile]);

  if (!hasValidRef) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#0d0d0d]">
        <div className="text-center">
          <p className="text-white/60 text-[15px]">Redirecting to Creator Program…</p>
          <Link
            href="/creators"
            className="mt-4 inline-block text-cyan-400 hover:underline text-sm"
          >
            Click here if not redirected
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#0d0d0d]">
        <div className="flex items-center gap-3 text-white/50 text-[15px]">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          Loading…
        </div>
      </div>
    );
  }

  if (userId && authReady && !loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#0d0d0d]">
        <div className="flex items-center gap-3 text-white/50 text-[15px]">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          Loading your profile…
        </div>
      </div>
    );
  }

  if (userId && authReady && !loading && profile && !countryOk) {
    return (
      <div className="min-h-screen overflow-y-auto bg-[#0d0d0d]">
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-pink-500/[0.04] blur-[100px]" />
        </div>

        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16 sm:pt-8 sm:pb-20">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight mb-6">
            Creator Onboarding
          </h1>
          <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 sm:p-10">
              <h2 className="text-lg font-semibold text-white mb-2">
                Where will you receive payouts?
              </h2>
              <p className="text-sm text-white/55 leading-relaxed mb-6">
                We create your Stripe account in this country first so bank linking matches your
                region (Stripe cannot change country later).
              </p>
              <label htmlFor="payout-country" className="sr-only">
                Payout country
              </label>
              <select
                id="payout-country"
                value={payoutCountryCode}
                onChange={(e) => setPayoutCountryCode(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#14171D] text-white text-[15px] px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <option value="">Select your country</option>
                {ALLOWED_PAYOUT_COUNTRIES_SORTED.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              {countryError ? <p className="mt-3 text-sm text-red-400/90">{countryError}</p> : null}
              <button
                type="button"
                onClick={handleSavePayoutCountry}
                disabled={countrySaving}
                className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black px-8 py-3.5 text-[15px] font-semibold hover:bg-white/95 transition-colors disabled:opacity-50"
              >
                {countrySaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Continue to Stripe setup"
                )}
              </button>
            </div>
            <aside className="hidden lg:block">
              <SupportPanel />
            </aside>
          </div>
          <div className="mt-8 lg:hidden">
            <SupportPanel />
          </div>
        </main>
      </div>
    );
  }

  if (!userId) {
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
              onClick={() => openSignIn()}
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

  if (!publishableKey) {
    return (
      <div className="min-h-screen overflow-y-auto bg-[#0d0d0d]">
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-pink-500/[0.04] blur-[100px]" />
        </div>

        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16 sm:pt-8 sm:pb-20">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight mb-6">
            Creator Onboarding
          </h1>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 sm:p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-red-400">!</span>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              We couldn&apos;t load payout setup
            </h2>
            <p className="text-white/60 text-sm max-w-md mx-auto">
              Stripe publishable key not configured
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#0d0d0d]">
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-pink-500/[0.04] blur-[100px]" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16 sm:pt-8 sm:pb-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Creator Onboarding
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              ← Creator dashboard
            </Link>
            <span className="text-white/20 hidden sm:inline" aria-hidden>
              ·
            </span>
            <Link
              href="/dashboard/earnings"
              className="text-white/50 hover:text-white/70 transition-colors"
            >
              Earnings
            </Link>
          </div>
        </div>
        <div
          className={`grid gap-6 lg:gap-8 ${pageState === "complete" ? "grid-cols-1" : "lg:grid-cols-[1fr,320px]"}`}
        >
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
                    <p className="text-white/60 text-sm">Preparing secure payout setup...</p>
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
                  className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 sm:p-10"
                >
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl text-red-400">!</span>
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">
                      We couldn&apos;t load payout setup
                    </h2>
                    <p className="text-white/60 text-sm mb-4 max-w-md mx-auto">
                      {error || "Please try again. If the issue persists, contact support."}
                    </p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-6 py-3 text-sm font-medium text-white transition-colors"
                    >
                      Retry with same country
                    </button>
                  </div>

                  <div className="mt-8 max-w-md mx-auto text-left rounded-xl border border-white/10 bg-black/20 p-5">
                    <h3 className="text-sm font-semibold text-white mb-2">Wrong payout country?</h3>
                    <p className="text-xs text-white/50 mb-4 leading-relaxed">
                      Your platform country (US) doesn&apos;t lock creators to US banks—each creator
                      picks a country that matches where they get paid. If Stripe rejected the
                      region, choose a different country below. We only show this on errors, not
                      while Stripe onboarding is in progress.
                    </p>
                    <label htmlFor="payout-country-error" className="sr-only">
                      Payout country
                    </label>
                    <select
                      id="payout-country-error"
                      value={payoutCountryCode}
                      onChange={(e) => setPayoutCountryCode(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-[#14171D] text-white text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500/40"
                    >
                      <option value="">Select country</option>
                      {ALLOWED_PAYOUT_COUNTRIES_SORTED.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {countryError ? (
                      <p className="mt-2 text-xs text-red-400/90">{countryError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleSavePayoutCountryAfterError()}
                      disabled={countrySaving}
                      className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-white text-black px-5 py-2.5 text-sm font-semibold hover:bg-white/95 transition-colors disabled:opacity-50"
                    >
                      {countrySaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save country & try again"
                      )}
                    </button>
                    <p className="mt-4 text-[11px] text-white/40 leading-relaxed">
                      If onboarding still looks like “accept payments as a business,” in Stripe go
                      to <strong className="text-white/55">Settings → Connect → Onboarding</strong>{" "}
                      and turn off <strong className="text-white/55">Payments</strong> for connected
                      accounts—keep <strong className="text-white/55">Transfers</strong> only so
                      creators are payout recipients, not merchants taking cards.
                    </p>
                  </div>
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
                  {pageState === "incomplete" ? (
                    <div className="px-4 sm:px-6 pt-4 pb-2 border-b border-white/10 bg-[#14171D]">
                      <p className="text-sm text-white/70">
                        If Stripe shows &quot;Information submitted&quot;, verification may take a
                        short time. You can return to Edgaze now—we&apos;ll enable payouts
                        automatically when Stripe finishes.
                      </p>
                    </div>
                  ) : null}
                  <div className="p-4 sm:p-6 min-h-[260px] overflow-y-auto bg-[#14171D]">
                    {connectInstance ? (
                      <EmbeddedOnboardingContent
                        connectInstance={connectInstance}
                        onExit={handleOnboardingExit}
                      />
                    ) : null}
                  </div>
                  <div className="px-4 sm:px-6 py-4 border-t border-white/10 bg-[#1a1f28] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-white/45">
                      This page isn&apos;t a dead end—leave anytime. We check payout status in the
                      background.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void checkConnectStatusAndMaybeComplete()}
                        className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                      >
                        Refresh payout status
                      </button>
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold text-black hover:bg-white transition-colors"
                      >
                        Go to dashboard
                      </Link>
                    </div>
                  </div>
                  <p className="px-4 sm:px-6 pb-4 text-xs text-white/40 bg-[#14171D]">
                    Your information is processed securely by Stripe for identity and payout
                    verification. By completing setup, you agree to Stripe&apos;s{" "}
                    <a
                      href="https://stripe.com/legal/connect-account"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Connected Account Agreement
                    </a>{" "}
                    and Edgaze&apos;s{" "}
                    <Link
                      href="/docs/creator-terms"
                      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Creator Terms
                    </Link>
                    ,{" "}
                    <Link
                      href="/docs/terms-of-service"
                      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Terms of Service
                    </Link>
                    ,{" "}
                    <Link
                      href="/docs/privacy-policy"
                      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Privacy Policy
                    </Link>
                    , and{" "}
                    <Link
                      href="/docs/payments-overview"
                      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Payment Policies
                    </Link>
                    .
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
                      <div
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 opacity-90 animate-pulse"
                        style={{ animationDuration: "2s" }}
                      />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/50 via-pink-400/50 to-cyan-400/50 blur-2xl" />
                      <div className="absolute inset-1 rounded-full bg-[#0d0d0d] flex items-center justify-center">
                        <CheckCircle2
                          className="w-12 h-12 sm:w-14 sm:h-14 text-cyan-400 drop-shadow-[0_0_24px_rgba(34,211,238,0.6)]"
                          strokeWidth={2}
                        />
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
                      Need help?{" "}
                      <Link href="/help" className="text-cyan-400 hover:underline">
                        Help center
                      </Link>
                      {" · "}
                      <a href="mailto:support@edgaze.ai" className="text-cyan-400 hover:underline">
                        support@edgaze.ai
                      </a>
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

export default function CreatorsOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-6 bg-[#0d0d0d]">
          <div className="flex items-center gap-3 text-white/50 text-[15px]">
            <Loader2 className="h-5 w-5 animate-spin shrink-0" />
            Loading…
          </div>
        </div>
      }
    >
      <CreatorsOnboardingPageContent />
    </Suspense>
  );
}
