'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Wallet, Loader2 } from 'lucide-react';

interface StripeStepProps {
  userId: string;
  inviteToken: string;
  onContinue: () => void;
}

export default function StripeStep({ userId, inviteToken, onContinue }: StripeStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetupNow = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create onboarding link');
      }

      // Update onboarding state
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'stripe',
          stripe_choice: 'now',
          stripe_status: 'in_progress',
        }),
      });

      // Redirect to Stripe
      if (data.url) {
        window.location.href = data.url;
      } else if (data.status === 'active') {
        // Already active, continue
        await handleLater();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set up Stripe');
      setLoading(false);
    }
  };

  const handleLater = async () => {
    try {
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'done',
          stripe_choice: 'later',
        }),
      });

      onContinue();
    } catch (err: any) {
      setError(err.message || 'Failed to continue');
    }
  };

  return (
    <motion.div
      initial="enter"
      animate="center"
      exit="exit"
      variants={{
        enter: { opacity: 0, y: 24 },
        center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
        exit: { opacity: 0, y: -16, transition: { duration: 0.3, ease: 'easeIn' } },
      }}
      className="flex min-h-[100dvh] items-center justify-center px-4"
    >
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/15"
        >
          <Wallet className="h-8 w-8 text-cyan-400" />
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4 text-3xl font-bold text-white"
        >
          Get paid for your workflows
        </motion.h2>

        {/* Body */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8 text-sm opacity-60"
        >
          Connect Stripe to receive payouts when creators purchase your workflows. Takes about 3 minutes.
        </motion.p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 font-dm-sans text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <button
            onClick={handleSetupNow}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: '52px' }}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading...
              </>
            ) : (
              'Set up payouts now →'
            )}
          </button>

          <button
            onClick={handleLater}
            disabled={loading}
            className="w-full rounded-lg border border-white/[0.12] bg-transparent px-6 py-3 text-sm font-medium text-white opacity-60 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ minHeight: '52px' }}
          >
            I'll do this later
          </button>
        </motion.div>

        {/* Fine print */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          transition={{ delay: 0.6 }}
          className="mt-4 text-xs"
        >
          You can connect anytime from Settings
        </motion.p>
      </div>
    </motion.div>
  );
}
