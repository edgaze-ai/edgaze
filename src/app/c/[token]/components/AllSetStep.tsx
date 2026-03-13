'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2 } from 'lucide-react';

interface AllSetStepProps {
  stripeChoice: 'now' | 'later' | 'unset';
  onGoToMarketplace: () => void;
}

export default function AllSetStep({ stripeChoice, onGoToMarketplace }: AllSetStepProps) {
  const confettiTriggered = useRef(false);

  useEffect(() => {
    if (confettiTriggered.current) return;
    confettiTriggered.current = true;

    // First burst from both sides
    setTimeout(() => {
      confetti({
        particleCount: 120,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#00E5CC', '#ffffff', '#00B8A5', '#7FFFD4'],
      });

      confetti({
        particleCount: 120,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#00E5CC', '#ffffff', '#00B8A5', '#7FFFD4'],
      });
    }, 300);

    // Second burst from center
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 90,
        spread: 45,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#00E5CC', '#ffffff', '#00B8A5', '#7FFFD4'],
      });
    }, 900);
  }, []);

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-lg text-center"
      >
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 15 }}
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center"
        >
          <svg className="h-20 w-20" viewBox="0 0 80 80">
            {/* Circle */}
            <motion.circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="#00E5CC"
              strokeWidth="3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5, duration: 0.6, ease: 'easeInOut' }}
            />
            {/* Checkmark */}
            <motion.path
              d="M 25 40 L 35 50 L 55 30"
              fill="none"
              stroke="#00E5CC"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 1.1, duration: 0.4, ease: 'easeInOut' }}
            />
          </svg>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="mb-4 text-4xl font-bold text-white md:text-5xl"
        >
          You&apos;re officially a creator.
        </motion.h1>

        {/* Subline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
          className="mb-8 text-base opacity-50"
        >
          Welcome to Edgaze. Time to build something.
        </motion.p>

        {/* Stripe reminder if they chose later */}
        {stripeChoice === 'later' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7 }}
            className="mb-6 rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-4"
          >
            <p className="mb-2 text-sm text-white/80">
              Don&apos;t forget to connect payouts
            </p>
            <a
              href="/settings"
              className="text-sm font-medium text-cyan-400 hover:underline"
            >
              Set up now →
            </a>
          </motion.div>
        )}

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8 }}
          onClick={onGoToMarketplace}
          className="group relative inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-cyan-600"
        >
          Go to Marketplace
          <motion.span
            className="inline-block"
            initial={{ x: 0 }}
            whileHover={{ x: 4 }}
            transition={{ duration: 0.2 }}
          >
            →
          </motion.span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
