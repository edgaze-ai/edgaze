"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js/pure";
import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import { Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "src/components/auth/AuthContext";
import { stripeConfig } from "@/lib/stripe/config";
import {
  connectEmbeddedAppearance,
  connectEmbeddedFonts,
} from "@/lib/stripe/connect-embedded-theme";

const DASHBOARD_SESSION_URL = "/api/stripe/v2/connect/dashboard-session";

type ConnectDashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export function ConnectDashboardShell({
  children,
  title,
  description,
}: ConnectDashboardShellProps) {
  const { authReady, userId, getAccessToken } = useAuth();
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (!authReady || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-earnings-page">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
            <Loader2 className="relative w-12 h-12 text-cyan-400 animate-spin" />
          </div>
          <p className="text-sm font-medium text-white/50 tracking-wide">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-earnings-page p-4 md:p-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="earnings-card p-8">
            <h1 className="text-2xl font-semibold text-white mb-2">Unable to load this page</h1>
            <p className="text-white/60 mb-6">{error}</p>
            <p className="text-sm text-white/40 mb-6">
              Complete payout setup first if you haven&apos;t already.
            </p>
            <Link
              href="/creators/onboarding?from=creators"
              className="earnings-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-white font-semibold"
            >
              Complete payout setup
              <ArrowRight className="w-4 h-4" />
            </Link>
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
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <Link
              href="/dashboard/earnings"
              className="text-xs font-medium uppercase tracking-widest text-white/45 hover:text-white/70 transition-colors mb-4 inline-block"
            >
              ← Back to Earnings Dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
              {title}
            </h1>
            {description && <p className="text-white/55 mt-1.5 text-base">{description}</p>}
          </header>
          <div className="earnings-card overflow-hidden min-h-[400px] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </ConnectComponentsProvider>
  );
}
