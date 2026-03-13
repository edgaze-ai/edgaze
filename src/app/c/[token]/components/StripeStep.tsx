'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Link from 'next/link';
import { DollarSign, Settings } from 'lucide-react';

interface StripeStepProps {
  userId: string;
  inviteToken: string;
  onContinue: () => void;
}

const CHIPS = [
  'Stripe-powered payouts',
  '~3 minutes to connect',
  'Start earning immediately',
];

export default function StripeStep({ userId, inviteToken, onContinue }: StripeStepProps) {
  const [loading, setLoading] = useState(false);

  const handleDoLater = async () => {
    try {
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'done',
          stripe_choice: 'later',
        }),
      });
    } catch {
      // ignore
    }
    onContinue();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex min-h-[100dvh] items-center justify-center px-4 py-12 sm:py-16"
    >
      <div className="w-full max-w-xl">
        {/* Card — matches CreatorOnboardingPanel / CreatorsHero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-pink-500/5" />
          <div className="relative p-6 sm:p-10">
            {/* Animated icon — DollarSign with cyan-pink gradient treatment */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 22 }}
              className="mb-8 flex justify-center"
            >
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/10 to-pink-500/10 blur-2xl" />
                <motion.div
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] sm:h-28 sm:w-28"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-pink-500 sm:h-16 sm:w-16">
                    <DollarSign className="h-7 w-7 text-white sm:h-8 sm:w-8" strokeWidth={2} />
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Headline — gradient text like CreatorsHero */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mb-2 text-center text-2xl font-bold tracking-tight sm:text-3xl"
            >
              <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-pink-400 bg-clip-text text-transparent">
                Join the Creator Program
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mb-6 text-center text-lg font-medium text-white/90 sm:text-xl"
            >
              to receive payouts
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8 text-center text-[15px] leading-relaxed text-white/55 sm:text-base"
            >
              Connect your payout account to get paid when people purchase your workflows.
            </motion.p>

            {/* Chips — like CreatorsHero */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="mb-8 flex flex-wrap justify-center gap-2 sm:gap-3"
            >
              {CHIPS.map((chip, i) => (
                <motion.span
                  key={chip}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70"
                >
                  {chip}
                </motion.span>
              ))}
            </motion.div>

            {/* Primary CTA — same as /creators portal: links to creators onboarding */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="space-y-3"
            >
              <button
                type="button"
                disabled
                className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400/60 via-sky-500/60 to-pink-500/60 px-6 py-4 text-base font-semibold text-white/90 shadow-[0_0_32px_rgba(56,189,248,0.2)] cursor-not-allowed opacity-90"
              >
                Coming soon
              </button>

              <button
                onClick={handleDoLater}
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Settings className="h-4 w-4 text-white/60" />
                Do it later via Settings
              </button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 text-center text-[13px] text-white/40"
            >
              Connect anytime from{' '}
              <Link
                href="/settings"
                className="font-medium text-cyan-400/90 underline-offset-2 transition-colors hover:text-cyan-400"
              >
                Settings
              </Link>
            </motion.p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
