"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  User,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { useAuth } from "src/components/auth/AuthContext";
import ProfileImageUploader from "src/components/profile/ProfileImageUploader";
import ProfileAvatar from "src/components/ui/ProfileAvatar";

type State =
  | "loading"
  | "logged_out"
  | "no_avatar"
  | "ready_stripe"
  | "stripe_in_progress"
  | "complete";

export default function CreatorOnboardingPanel() {
  const router = useRouter();
  const { userId, profile, authReady, openSignIn, refreshProfile } = useAuth();
  const [connectStatus, setConnectStatus] = useState<{
    hasAccount?: boolean;
    status?: string;
    readyToProcessPayments?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setConnectStatus(null);
      return;
    }
    try {
      const res = await fetch("/api/stripe/v2/connect/status");
      if (res.ok) {
        const data = await res.json();
        setConnectStatus(data);
      }
    } catch {
      setConnectStatus(null);
    }
  }, [userId]);

  useEffect(() => {
    if (!authReady) return;
    if (!userId) {
      setLoading(false);
      setConnectStatus(null);
      return;
    }
    setLoading(true);
    fetchStatus().finally(() => setLoading(false));
  }, [authReady, userId, fetchStatus]);

  const state: State = (() => {
    if (!authReady || loading) return "loading";
    if (!userId) return "logged_out";
    if (!profile?.avatar_url || profile.avatar_url === "") return "no_avatar";
    if (connectStatus?.readyToProcessPayments) return "complete";
    if (connectStatus?.hasAccount && !connectStatus?.readyToProcessPayments)
      return "stripe_in_progress";
    return "ready_stripe";
  })();

  async function handleCta() {
    switch (state) {
      case "logged_out":
        openSignIn();
        break;
      case "no_avatar":
        router.push("/profile?from=creators");
        break;
      case "ready_stripe":
      case "stripe_in_progress":
        router.push("/creators/onboarding?from=creators");
        break;
      case "complete":
        router.push("/dashboard/earnings");
        break;
      default:
        break;
    }
  }

  const content = {
    loading: {
      title: "Checking your status...",
      desc: "One moment.",
      cta: "Continue",
      icon: Loader2,
    },
    logged_out: {
      title: "Sign in to start your creator setup",
      desc: "Sign in to join the Creator Program and start publishing workflows on Edgaze.",
      cta: "Continue",
      icon: User,
    },
    no_avatar: {
      title: "Complete your creator profile",
      desc: "Add a profile photo so creators and buyers can recognize you.",
      cta: "Complete profile",
      icon: User,
    },
    ready_stripe: {
      title: "Set up payouts to start selling",
      desc: "Connect your bank account via Stripe to receive payments when you sell workflows.",
      cta: "Start payout onboarding",
      icon: DollarSign,
    },
    stripe_in_progress: {
      title: "Complete your payout setup",
      desc: "You've started onboarding. Finish the remaining steps to receive payments.",
      cta: "Resume setup",
      icon: Loader2,
    },
    complete: {
      title: "You're ready to publish",
      desc: "Your creator account is fully set up. Publish workflows and start earning.",
      cta: "Go to creator dashboard",
      icon: CheckCircle2,
    },
  };

  const c = content[state];
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-pink-500/5" />
      <div className="relative p-8 sm:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-8 gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Creator onboarding
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={state}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed max-w-xl">
                  {c.desc}
                </p>
              </motion.div>
            </AnimatePresence>

            {state === "no_avatar" && (
              <div className="mt-6">
                <div className="flex items-center gap-4">
                  <ProfileAvatar
                    name={profile?.full_name || profile?.handle || "Creator"}
                    avatarUrl={profile?.avatar_url || null}
                    size={64}
                    handle={profile?.handle}
                    userId={userId || ""}
                  />
                  <div>
                    <p className="text-sm font-medium text-white/90">Add photo</p>
                    <ProfileImageUploader
                      kind="avatar"
                      onDone={() => refreshProfile()}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={handleCta}
                disabled={state === "loading" || stripeLoading}
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(56,189,248,0.35)] transition-all hover:shadow-[0_0_32px_rgba(56,189,248,0.45)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {state === "loading" || stripeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {c.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="hidden sm:flex shrink-0">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 ${
                state === "complete"
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : ""
              }`}
            >
              {state === "loading" || stripeLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              ) : (
                <Icon
                  className={`h-8 w-8 ${
                    state === "complete"
                      ? "text-emerald-400"
                      : "text-cyan-400/90"
                  }`}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
