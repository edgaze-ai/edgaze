"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { loadConnectAndInitialize } from "@stripe/connect-js/pure";
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js";
import {
  CheckCircle2,
  Loader2,
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

function PremiumOnboardingBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#0b0b0d]" />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 110% 70% at 50% -10%, rgba(34,211,238,0.10), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 70%, rgba(236,72,153,0.08), transparent 55%), radial-gradient(ellipse 70% 55% at 10% 80%, rgba(139,92,246,0.07), transparent 55%)",
        }}
      />
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
      <div className="absolute -bottom-40 right-[-120px] w-[520px] h-[520px] rounded-full bg-pink-500/[0.06] blur-[140px]" />
    </div>
  );
}

function GlowBehindCTA() {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden rounded-[28px]">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute -inset-10 opacity-80 blur-2xl edge-grad-animated" />
      <div className="absolute -inset-10 opacity-40 blur-3xl edge-grad-animated" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/25 to-black/55" />
    </div>
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

  const backHref = useMemo(() => (hasValidRef ? "/creators" : "/creators"), [hasValidRef]);

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
      <div className="min-h-screen flex items-center justify-center px-6">
        <PremiumOnboardingBackdrop />
        <div className="text-center">
          <p className="text-white/60 text-[15px]">Redirecting…</p>
          <Link href={backHref} className="mt-4 inline-block text-white/50 hover:text-white/70 text-sm">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <PremiumOnboardingBackdrop />
        <div className="flex items-center gap-3 text-white/50 text-[15px]">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          Loading…
        </div>
      </div>
    );
  }

  if (userId && authReady && !loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <PremiumOnboardingBackdrop />
        <div className="flex items-center gap-3 text-white/50 text-[15px]">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          Loading your profile…
        </div>
      </div>
    );
  }

  if (userId && authReady && !loading && profile && !countryOk) {
    return (
      <div className="min-h-screen overflow-y-auto">
        <PremiumOnboardingBackdrop />

        <main className="relative z-10 mx-auto w-full max-w-md px-5 pt-10 pb-14">
          <div className="text-center">
            <div className="mx-auto mb-5 h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
              <User className="h-6 w-6 text-white/60" />
            </div>
            <h1 className="text-[22px] font-semibold tracking-tight text-white">Payout country</h1>
            <p className="mt-2 text-[14px] text-white/55 leading-relaxed">
              Stripe uses this to open the right bank setup for your region.
            </p>
          </div>

          <div className="mt-8">
            <label htmlFor="payout-country" className="sr-only">
              Payout country
            </label>
            <select
              id="payout-country"
              value={payoutCountryCode}
              onChange={(e) => setPayoutCountryCode(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] text-white text-[15px] px-4 py-4 outline-none focus:ring-2 focus:ring-cyan-500/30"
            >
              <option value="">Select your country</option>
              {ALLOWED_PAYOUT_COUNTRIES_SORTED.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            {countryError ? <p className="mt-3 text-sm text-red-400/90">{countryError}</p> : null}
          </div>

          <div className="relative mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
            <GlowBehindCTA />
            <button
              type="button"
              onClick={handleSavePayoutCountry}
              disabled={countrySaving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-white text-black px-6 py-4 text-[15px] font-semibold transition-colors hover:bg-white/95 disabled:opacity-50"
            >
              {countrySaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Continue"
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            <Link href={backHref} className="text-[13px] text-white/45 hover:text-white/70">
              Back
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen w-full text-white flex flex-col items-center justify-center px-6 py-16">
        <PremiumOnboardingBackdrop />
        <div className="w-full max-w-md mx-auto text-center">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-10 sm:p-12 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-6">
              <User className="h-7 w-7 text-white/60" />
            </div>
            <h1 className="text-[22px] sm:text-[24px] font-semibold text-white tracking-tight">Payout setup</h1>
            <p className="mt-3 text-[15px] text-white/55 leading-relaxed max-w-sm mx-auto">
              Sign in to continue.
            </p>
            <div className="relative mt-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
              <GlowBehindCTA />
              <button
                type="button"
                onClick={() => openSignIn()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-white text-black px-6 py-4 text-[15px] font-semibold hover:bg-white/95 transition-colors"
              >
                <LogIn className="h-5 w-5" />
                Sign in
              </button>
            </div>
            <Link href={backHref} className="mt-6 inline-block text-[13px] text-white/45 hover:text-white/70 transition-colors">
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!publishableKey) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <PremiumOnboardingBackdrop />
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <h2 className="text-lg font-semibold text-white">Payout setup unavailable</h2>
          <p className="mt-2 text-sm text-white/60">Stripe publishable key not configured.</p>
          <Link href={backHref} className="mt-6 inline-block text-[13px] text-white/45 hover:text-white/70">
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto">
      <PremiumOnboardingBackdrop />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6 pt-6 pb-14 sm:pt-10">
        <div className="mx-auto w-full max-w-3xl">
          <AnimatePresence mode="wait">
            {pageState === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="min-h-[65svh] flex flex-col items-center justify-center text-center px-4"
              >
                <Loader2 className="h-6 w-6 animate-spin text-white/55" />
                <p className="mt-4 text-[14px] text-white/55">Preparing payout setup…</p>
              </motion.div>
            )}

            {pageState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="min-h-[65svh] flex flex-col items-center justify-center px-4"
              >
                <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                  <h2 className="text-[18px] font-semibold text-white tracking-tight">
                    Couldn&apos;t load Stripe onboarding
                  </h2>
                  <p className="mt-2 text-[13px] text-white/55 leading-relaxed">
                    {error || "Please try again."}
                  </p>

                  <div className="relative mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
                    <GlowBehindCTA />
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="w-full inline-flex items-center justify-center rounded-3xl bg-white text-black px-6 py-4 text-[14px] font-semibold hover:bg-white/95 transition-colors"
                    >
                      Retry
                    </button>
                  </div>

                  <div className="mt-6">
                    <label htmlFor="payout-country-error" className="sr-only">
                      Payout country
                    </label>
                    <select
                      id="payout-country-error"
                      value={payoutCountryCode}
                      onChange={(e) => setPayoutCountryCode(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] text-white text-[15px] px-4 py-4 outline-none focus:ring-2 focus:ring-cyan-500/30"
                    >
                      <option value="">Select a different country (optional)</option>
                      {ALLOWED_PAYOUT_COUNTRIES_SORTED.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {countryError ? (
                      <p className="mt-3 text-sm text-red-400/90">{countryError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleSavePayoutCountryAfterError()}
                      disabled={countrySaving}
                      className="mt-4 w-full inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-[13px] font-semibold text-white/80 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                    >
                      {countrySaving ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </span>
                      ) : (
                        "Save country"
                      )}
                    </button>
                  </div>

                  <div className="mt-6 text-center">
                    <Link href="/help" className="text-[13px] text-white/45 hover:text-white/70">
                      Help
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {(pageState === "incomplete" || pageState === "ready") && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="mx-auto w-full max-w-4xl"
              >
                {pageState === "incomplete" ? (
                  <div className="mb-4 text-center text-[13px] text-white/55 px-4">
                    If Stripe says “Information submitted”, verification can take a bit. You can leave
                    and we’ll keep checking in the background.
                  </div>
                ) : null}

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="min-h-[60svh] bg-[#14171D]">
                    <div className="p-4 sm:p-6">
                      {connectInstance ? (
                        <EmbeddedOnboardingContent
                          connectInstance={connectInstance}
                          onExit={handleOnboardingExit}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="relative p-3 sm:p-4 border-t border-white/10 bg-black/30">
                    <div className="relative rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
                      <GlowBehindCTA />
                      <button
                        type="button"
                        onClick={() => void checkConnectStatusAndMaybeComplete()}
                        className="w-full inline-flex items-center justify-center rounded-3xl bg-white text-black px-6 py-4 text-[14px] font-semibold hover:bg-white/95 transition-colors"
                      >
                        Check payout status
                      </button>
                    </div>

                    <div className="mt-3 text-center">
                      <Link href="/dashboard" className="text-[13px] text-white/45 hover:text-white/70">
                        Back to app
                      </Link>
                    </div>
                  </div>
                </div>

                <p className="mt-4 px-2 text-center text-[11px] text-white/35 leading-relaxed">
                  Stripe processes identity and payout verification. By completing setup you agree to{" "}
                  <a
                    href="https://stripe.com/legal/connect-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/45 hover:text-white/65 underline underline-offset-2"
                  >
                    Stripe Connect terms
                  </a>{" "}
                  and Edgaze policies.
                </p>
              </motion.div>
            )}

            {pageState === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                className="min-h-[75svh] flex items-center justify-center px-4"
              >
                <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden p-8 text-center">
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -inset-12 opacity-60 blur-3xl edge-grad-animated" />
                    <div className="absolute inset-0 bg-black/40" />
                  </div>

                  <div className="relative">
                    <div className="mx-auto mb-6 h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-cyan-300" />
                    </div>
                    <h2 className="text-[20px] font-semibold tracking-tight text-white">You&apos;re set</h2>
                    <p className="mt-2 text-[13px] text-white/55">Payouts are enabled on your account.</p>

                    <div className="relative mt-7 rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
                      <GlowBehindCTA />
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/earnings")}
                        className="w-full inline-flex items-center justify-center rounded-3xl bg-white text-black px-6 py-4 text-[14px] font-semibold hover:bg-white/95 transition-colors"
                      >
                        Continue
                      </button>
                    </div>

                    <div className="mt-5 text-center">
                      <Link href="/help" className="text-[13px] text-white/45 hover:text-white/70">
                        Help
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
