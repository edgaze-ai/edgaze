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
  CreditCard,
  Banknote,
  UserCog,
  FileText,
} from "lucide-react";
import { useAuth } from "src/components/auth/AuthContext";
import { stripeConfig } from "@/lib/stripe/config";

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
    const token = await getAccessToken();
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
        const res = await fetch("/api/creator/earnings");
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
  }, [authReady, userId]);

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
      const token = await getAccessToken();
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
      <div className="min-h-screen bg-earnings-page p-4 md:p-8">
        <div className="max-w-2xl mx-auto py-16">
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
              <h1 className="font-instrument text-2xl font-normal text-white mb-2">
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
      <div className="min-h-screen bg-earnings-page p-4 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <h1 className="font-instrument text-4xl md:text-5xl font-normal text-white mb-2 tracking-tight">
              Earnings Dashboard
            </h1>
            <p className="text-white/55 text-base md:text-lg max-w-xl">
              Track balances, payouts, and account details. Buyer checkout runs on Edgaze; your
              share is paid out from your Stripe connected account.
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
          <section className="mb-8">
            <h2 className="earnings-section-label mb-4">Overview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[180px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <Sparkles className="h-4 w-4 text-white/50" />
                  <span>Notifications</span>
                </div>
                <ConnectNotificationBanner />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[180px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <Wallet className="h-4 w-4 text-white/50" />
                  <span>Balances</span>
                </div>
                <ConnectBalances />
              </motion.div>
            </div>
          </section>

          {/* Payouts (ConnectPayments removed: creators are not card merchants on the connected account) */}
          <section className="mb-8">
            <h2 className="earnings-section-label mb-4">Sales & payouts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[220px]"
              >
                <div className="earnings-card-header">
                  <CreditCard className="h-4 w-4 text-white/50" />
                  <span>Checkout & earnings</span>
                </div>
                <div className="p-5 sm:p-6 text-sm text-white/60 leading-relaxed">
                  <p>
                    Buyers pay Edgaze at checkout. Your earnings (after Edgaze&apos;s platform fee)
                    are transferred to this Stripe account and show up under Balances and Payouts —
                    not under a &quot;Payments&quot; list on the connected account, because you are
                    not processing cards directly on this account.
                  </p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[400px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <Banknote className="h-4 w-4 text-white/50" />
                  <span>Payouts</span>
                </div>
                <ConnectPayouts />
              </motion.div>
            </div>
          </section>

          {/* Account + Documents */}
          <section className="mb-8">
            <h2 className="earnings-section-label mb-4">Account</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[320px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <UserCog className="h-4 w-4 text-white/50" />
                  <span>Account details</span>
                </div>
                <ConnectAccountManagement />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.35 }}
                className="earnings-card overflow-hidden min-h-[320px] overflow-y-auto"
              >
                <div className="earnings-card-header">
                  <FileText className="h-4 w-4 text-white/50" />
                  <span>Documents</span>
                </div>
                <ConnectDocuments />
              </motion.div>
            </div>
          </section>

          {/* Stripe Express CTA */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
            className="earnings-card earnings-card-cta p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5"
          >
            <div>
              <h2 className="font-instrument text-xl font-normal text-white mb-1">
                Full Stripe Dashboard
              </h2>
              <p className="text-white/55 text-sm">
                Open Stripe Express for advanced features, tax forms, and reporting.
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
            className="mt-10 text-xs text-white/35 flex items-center justify-center gap-1.5 flex-wrap"
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
