'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Calendar, Shield, CheckCircle2, Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<any>(null);

  useEffect(() => {
    checkAccountStatus();
  }, []);

  async function checkAccountStatus() {
    try {
      const res = await fetch('/api/stripe/connect/status');
      if (res.ok) {
        const data = await res.json();
        setAccountStatus(data);
        
        if (data.status === 'active') {
          router.push('/onboarding/success');
        }
      }
    } catch (err) {
      console.error('Failed to check account status:', err);
    }
  }

  async function handleStartOnboarding() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start onboarding');
      }

      if (data.url) {
        window.location.href = data.url;
      } else if (data.status === 'active') {
        router.push('/onboarding/success');
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleRefreshLink() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/connect/refresh', {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh link');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const benefits = [
    {
      icon: DollarSign,
      title: '80% Revenue Share',
      description: 'Keep 80% of every sale. We only take 20% to cover platform costs.',
      gradient: 'from-cyan-500 to-blue-500'
    },
    {
      icon: Calendar,
      title: 'Weekly Payouts',
      description: 'Automatic transfers to your bank account every Monday.',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: TrendingUp,
      title: 'Global Payments',
      description: 'Accept payments from customers worldwide in multiple currencies.',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: Shield,
      title: 'Secure & Compliant',
      description: 'Stripe-powered security with PCI compliance and fraud protection.',
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  if (searchParams.get('error')) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Onboarding Error</h1>
          <p className="text-white/60 mb-6">
            {searchParams.get('error') === 'account_not_found' 
              ? 'Your Stripe account could not be found. Please try again.'
              : 'There was an error with your onboarding. Please contact support.'}
          </p>
          <button
            onClick={handleStartOnboarding}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Start Earning on Edgaze
            </span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Connect your bank account and start monetizing your AI workflows and prompts
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl blur-xl"
                   style={{ background: `linear-gradient(to right, var(--tw-gradient-stops))` }} />
              <div className="relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition">
                <div className={`w-12 h-12 bg-gradient-to-r ${benefit.gradient} rounded-lg flex items-center justify-center mb-4`}>
                  <benefit.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-white/60">{benefit.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            {accountStatus?.hasAccount && accountStatus?.status === 'pending' ? (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Complete Your Setup</h2>
                  <p className="text-white/60">
                    Your account is partially set up. Complete the remaining steps to start receiving payments.
                  </p>
                </div>
                <button
                  onClick={handleRefreshLink}
                  disabled={loading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Continue Setup'
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Connect Your Bank Account</h2>
                  <p className="text-white/60">
                    Securely connect your bank account via Stripe to receive payments
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleStartOnboarding}
                  disabled={loading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Start Onboarding
                    </>
                  )}
                </button>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                    <Shield className="w-4 h-4" />
                    <span>Powered by Stripe • Secure & Encrypted</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-white/40">
              By continuing, you agree to Stripe's{' '}
              <a href="https://stripe.com/legal/connect-account" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                Connected Account Agreement
              </a>
              {' '}and Edgaze's{' '}
              <a href="/legal/seller-terms" className="text-cyan-400 hover:underline">
                Seller Terms
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
