"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js/pure";
import {
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayouts,
  ConnectAccountManagement,
  ConnectDocuments,
  ConnectBalances,
} from "@stripe/react-connect-js";
import {
  ExternalLink,
  Loader2,
  HelpCircle,
  Mail,
  ArrowRight,
  Sparkles,
  Wallet,
  Banknote,
  UserCog,
  FileText,
} from "lucide-react";
import { useAuth } from "src/components/auth/AuthContext";
import { stripeConfig } from "@/lib/stripe/config";
import {
  connectEmbeddedAppearance,
  connectEmbeddedFonts,
} from "@/lib/stripe/connect-embedded-theme";

const DASHBOARD_SESSION_URL = "/api/stripe/v2/connect/dashboard-session";
const EXPRESS_DASHBOARD_URL = "/api/stripe/connect/dashboard";

type PendingClaim = {
  pendingClaimCents: number;
  claimDeadline: string | null;
  daysRemaining: number;
};

export default function EarningsDashboardPage() {
  const { authReady, userId, getAccessToken } = useAuth();
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expressLoading, setExpressLoading] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);

  const publishableKey = stripeConfig.publishableKey;

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const token = await getAccessToken({ eagerRefresh: true });
    const res = await fetch(DASHBOARD_SESSION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load dashboard");
    }
    if (!data.clientSecret) {
      throw new Error("No client secret returned");
    }
    return data.clientSecret;
  }, [getAccessToken]);

  useEffect(() => {
    if (!authReady || !userId) return;

    (async () => {
      try {
        const token = await getAccessToken({ eagerRefresh: true });
        const res = await fetch("/api/creator/earnings", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.pendingClaimCents > 0) {
            setPendingClaim({
              pendingClaimCents: data.pendingClaimCents,
              claimDeadline: data.claimDeadline ?? null,
              daysRemaining: data.daysRemaining ?? 0,
            });
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [authReady, userId, getAccessToken]);

  useEffect(() => {
    if (!authReady || !userId || !publishableKey || !fetchClientSecret) {
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const instance = loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret,
          appearance: connectEmbeddedAppearance,
          fonts: connectEmbeddedFonts,
        });
        setConnectInstance(instance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady, userId, publishableKey, fetchClientSecret]);

  const openExpressDashboard = useCallback(async () => {
    setExpressLoading(true);
    try {
      const token = await getAccessToken({ eagerRefresh: true });
      const res = await fetch(EXPRESS_DASHBOARD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error(data.error || "Failed to open dashboard");
      }
    } catch (err) {
      console.error("Express dashboard error:", err);
      setError(err instanceof Error ? err.message : "Failed to open Stripe dashboard");
    } finally {
      setExpressLoading(false);
    }
  }, [getAccessToken]);

  if (!authReady || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-earnings-page">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
            <Loader2 className="relative w-12 h-12 text-cyan-400 animate-spin" />
          </div>
          <p className="text-sm font-medium text-white/50 tracking-wide">Loading your dashboard</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-earnings-page px-5 py-10 sm:px-8 md:py-16">
        <div className="max-w-2xl mx-auto">
          {pendingClaim && pendingClaim.pendingClaimCents > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="earnings-card-pending mb-8"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-cyan-300/90 mb-1">
                Pending earnings
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight mb-2">
                ${(pendingClaim.pendingClaimCents / 100).toFixed(2)}
              </div>
              <p className="text-white/70 text-sm mb-3">
                Complete Creator Program onboarding to withdraw.
              </p>
              <p className="text-white/50 text-xs mb-4">
                Deadline:{" "}
                {pendingClaim.claimDeadline
                  ? new Date(pendingClaim.claimDeadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}{" "}
                ({pendingClaim.daysRemaining} days remaining)
              </p>
              <Link
                href="/creators/onboarding"
                className="inline-flex items-center gap-2 rounded-xl earnings-btn-primary px-5 py-2.5 text-sm font-semibold text-white"
              >
                Complete payout setup
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          )}
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="earnings-card p-8"
            >
              <h1 className="text-2xl font-semibold text-white mb-2">
                Unable to load earnings dashboard
              </h1>
              <p className="text-white/60 mb-6">{error}</p>
              <p className="text-sm text-white/40 mb-6">
                Make sure you&apos;ve completed payout setup first. If you haven&apos;t, complete
                onboarding to receive payouts.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/creators/onboarding?from=creators"
                  className="inline-flex items-center justify-center gap-2 rounded-xl earnings-btn-primary px-6 py-3 text-white font-semibold"
                >
                  Complete payout setup
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-6 py-3 text-white hover:bg-white/5 transition-colors"
                >
                  Try again
                </button>
              </div>
              <p className="mt-8 text-xs text-white/40">
                Need help?{" "}
                <Link href="/help" className="text-cyan-400 hover:underline">
                  Help center
                </Link>
                {" · "}
                <a href="mailto:support@edgaze.ai" className="text-cyan-400 hover:underline">
                  support@edgaze.ai
                </a>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!connectInstance) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-earnings-page">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      <div className="min-h-screen bg-earnings-page px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-11 md:mb-12"
          >
            <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-white mb-3 tracking-tight">
              Earnings Dashboard
            </h1>
            <p className="text-white/[0.52] text-[15px] sm:text-base leading-relaxed max-w-2xl">
              Balances, payouts, and payout account settings. Sales are collected by Edgaze at
              checkout; your share settles in this connected Stripe account.
            </p>
          </motion.header>

          {/* Pending earnings — premium callout */}
          {pendingClaim && pendingClaim.pendingClaimCents > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.35 }}
              className="earnings-card-pending mb-8"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-cyan-300/90">
                      Pending earnings
                    </span>
                  </div>
                  <div className="text-3xl md:text-4xl font-bold text-white tabular-nums tracking-tight mb-1">
                    ${(pendingClaim.pendingClaimCents / 100).toFixed(2)}
                  </div>
                  <p className="text-white/70 text-sm mb-2">
                    Complete Creator Program onboarding to withdraw to your bank.
                  </p>
                  <p className="text-white/50 text-xs">
                    Deadline:{" "}
                    {pendingClaim.claimDeadline
                      ? new Date(pendingClaim.claimDeadline).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}{" "}
                    · {pendingClaim.daysRemaining} days left
                  </p>
                </div>
                <Link
                  href="/creators/onboarding"
                  className="earnings-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shrink-0"
                >
                  Complete payout setup
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* Overview: Notifications + Balances */}
          <section className="mb-10 md:mb-11">
            <h2 className="earnings-section-label mb-4">Overview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[200px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <Sparkles className="h-4 w-4 text-cyan-400/55 shrink-0" />
                  <span>Notifications</span>
                </div>
                <div className="earnings-connect-body">
                  <ConnectNotificationBanner />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[200px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <Wallet className="h-4 w-4 text-cyan-400/55 shrink-0" />
                  <span>Balances</span>
                </div>
                <div className="earnings-connect-body">
                  <ConnectBalances />
                </div>
              </motion.div>
            </div>
          </section>

          <section className="mb-10 md:mb-11">
            <h2 className="earnings-section-label mb-4">Payouts</h2>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="earnings-card overflow-hidden min-h-[440px] overflow-y-auto"
            >
              <div className="earnings-card-header">
                <Banknote className="h-4 w-4 text-cyan-400/55 shrink-0" />
                <span>Payout history & schedule</span>
              </div>
              <div className="earnings-connect-body">
                <ConnectPayouts />
              </div>
            </motion.div>
          </section>

          {/* Account + Documents */}
          <section className="mb-10 md:mb-11">
            <h2 className="earnings-section-label mb-4">Account</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[360px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <UserCog className="h-4 w-4 text-cyan-400/55 shrink-0" />
                  <span>Account details</span>
                </div>
                <div className="earnings-connect-body">
                  <ConnectAccountManagement />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[360px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <FileText className="h-4 w-4 text-cyan-400/55 shrink-0" />
                  <span>Documents</span>
                </div>
                <div className="earnings-connect-body">
                  <ConnectDocuments />
                </div>
              </motion.div>
            </div>
          </section>

          {/* Stripe Express CTA */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
            className="earnings-card earnings-card-cta p-7 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
          >
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-1.5">
                Full Stripe Dashboard
              </h2>
              <p className="text-white/[0.52] text-sm leading-relaxed max-w-md">
                Open Stripe Express for tax forms, full reporting, and account tools.
              </p>
            </div>
            <button
              onClick={openExpressDashboard}
              disabled={expressLoading}
              className="earnings-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-white font-semibold disabled:opacity-70 shrink-0"
            >
              {expressLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ExternalLink className="w-5 h-5" />
              )}
              View Express Dashboard
            </button>
          </motion.section>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-xs text-white/35 flex items-center justify-center gap-1.5 flex-wrap"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <Link href="/help" className="text-white/50 hover:text-cyan-400 transition-colors">
              Help center
            </Link>
            <span className="text-white/25">·</span>
            <a
              href="mailto:support@edgaze.ai"
              className="inline-flex items-center gap-1 text-white/50 hover:text-cyan-400 transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              support@edgaze.ai
            </a>
          </motion.p>
        </div>
      </div>
    </ConnectComponentsProvider>
  );
}
