'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from '@stripe/connect-js';
import { ConnectComponentsProvider } from '@stripe/react-connect-js';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from 'src/components/auth/AuthContext';
import { stripeConfig } from '@/lib/stripe/config';

const DASHBOARD_SESSION_URL = '/api/stripe/v2/connect/dashboard-session';

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
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const publishableKey = stripeConfig.publishableKey;

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const token = await getAccessToken();
    const res = await fetch(DASHBOARD_SESSION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load dashboard');
    }
    if (!data.clientSecret) {
      throw new Error('No client secret returned');
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
          appearance: {
            variables: {
              colorText: '#f3f4f6',
              colorBackground: '#14171D',
              colorPrimary: '#22d3ee',
              colorDanger: '#f87171',
              borderRadius: '12px',
            },
          },
        });
        setConnectInstance(instance);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady, userId, publishableKey, fetchClientSecret]);

  if (!authReady || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-[#0d0d0d]">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] p-4 md:p-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
            <h1 className="text-xl font-bold text-white mb-2">
              Unable to load this page
            </h1>
            <p className="text-white/60 mb-6">{error}</p>
            <p className="text-sm text-white/40 mb-6">
              Complete payout setup first if you haven&apos;t already.
            </p>
            <Link
              href="/creators/onboarding?from=creators"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-white font-semibold hover:opacity-90 transition"
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
      <div className="min-h-[50vh] flex items-center justify-center bg-[#0d0d0d]">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      <div className="min-h-screen bg-[#0d0d0d] p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link
              href="/dashboard/earnings"
              className="text-sm text-white/50 hover:text-white/70 transition mb-4 inline-block"
            >
              ← Back to Earnings Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
            {description && (
              <p className="text-white/60 mt-1">{description}</p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#14171D] min-h-[400px] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </ConnectComponentsProvider>
  );
}
