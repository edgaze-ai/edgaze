'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from '@stripe/connect-js';
import {
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayments,
  ConnectPayouts,
  ConnectAccountManagement,
  ConnectDocuments,
  ConnectBalances,
} from '@stripe/react-connect-js';
import {
  ExternalLink,
  Loader2,
  HelpCircle,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from 'src/components/auth/AuthContext';
import { stripeConfig } from '@/lib/stripe/config';

const DASHBOARD_SESSION_URL = '/api/stripe/v2/connect/dashboard-session';
const EXPRESS_DASHBOARD_URL = '/api/stripe/connect/dashboard';

export default function EarningsDashboardPage() {
  const { authReady, userId, getAccessToken } = useAuth();
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expressLoading, setExpressLoading] = useState(false);

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

  const openExpressDashboard = useCallback(async () => {
    setExpressLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(EXPRESS_DASHBOARD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error(data.error || 'Failed to open dashboard');
      }
    } catch (err) {
      console.error('Express dashboard error:', err);
      setError(err instanceof Error ? err.message : 'Failed to open Stripe dashboard');
    } finally {
      setExpressLoading(false);
    }
  }, [getAccessToken]);

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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-8"
          >
            <h1 className="text-xl font-bold text-white mb-2">
              Unable to load earnings dashboard
            </h1>
            <p className="text-white/60 mb-6">{error}</p>
            <p className="text-sm text-white/40 mb-6">
              Make sure you&apos;ve completed payout setup first. If you
              haven&apos;t, complete onboarding to receive payouts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/creators/onboarding?from=creators"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-white font-semibold hover:opacity-90 transition"
              >
                Complete payout setup
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-white hover:bg-white/5 transition"
              >
                Try again
              </button>
            </div>
            <p className="mt-8 text-xs text-white/40">
              Need help?{' '}
              <Link href="/help" className="text-cyan-400 hover:underline">
                Help center
              </Link>
              {' · '}
              <a
                href="mailto:support@edgaze.ai"
                className="text-cyan-400 hover:underline"
              >
                support@edgaze.ai
              </a>
            </p>
          </motion.div>
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
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              <span className="bg-gradient-to-r from-cyan-400 via-pink-400/90 to-cyan-400 bg-clip-text text-transparent">
                Earnings Dashboard
              </span>
            </h1>
            <p className="text-white/60">
              Manage payments, payouts, and account details
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-white/10 overflow-hidden bg-[#14171D] min-h-[180px] overflow-y-auto"
            >
              <ConnectNotificationBanner />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-white/10 overflow-hidden bg-[#14171D] min-h-[180px] overflow-y-auto"
            >
              <ConnectBalances />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-white/10 overflow-hidden bg-[#14171D] min-h-[400px] overflow-y-auto"
            >
              <ConnectPayments />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl border border-white/10 overflow-hidden bg-[#14171D] min-h-[400px] overflow-y-auto"
            >
              <ConnectPayouts />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-white/10 overflow-hidden bg-[#14171D] min-h-[320px] overflow-y-auto"
            >
              <ConnectAccountManagement />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl border border-white/10 overflow-hidden bg-[#14171D] min-h-[320px] overflow-y-auto"
            >
              <ConnectDocuments />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div>
              <h2 className="text-lg font-bold text-white mb-1">
                View full Stripe Dashboard
              </h2>
              <p className="text-white/60 text-sm">
                Open Stripe Express for advanced features, tax forms, and more.
              </p>
            </div>
            <button
              onClick={openExpressDashboard}
              disabled={expressLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/90 to-purple-500/90 hover:from-cyan-400 hover:to-purple-400 px-6 py-3 text-white font-semibold transition shadow-[0_0_24px_rgba(34,211,238,0.2)] hover:shadow-[0_0_32px_rgba(34,211,238,0.3)] disabled:opacity-70"
            >
              {expressLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ExternalLink className="w-5 h-5" />
              )}
              View Express Dashboard
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-xs text-white/40 flex items-center justify-center gap-1 flex-wrap"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Need help?{' '}
            <Link href="/help" className="text-cyan-400 hover:underline">
              Help center
            </Link>
            {' · '}
            <a
              href="mailto:support@edgaze.ai"
              className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
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
