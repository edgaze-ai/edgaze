"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

interface WelcomeStepProps {
  creatorName: string;
  creatorPhotoUrl: string;
  onContinue: () => void;
}

export default function WelcomeStep({
  creatorName,
  creatorPhotoUrl,
  onContinue,
}: WelcomeStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex min-h-screen items-center justify-center px-4 py-4 sm:py-8"
    >
      <div className="w-full max-w-2xl">
        {/* Card — matches /creators design */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-12"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-pink-500/5" />

          {/* Content */}
          <div className="relative z-10 text-center">
            {/* Creator Avatar with Premium Effect */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mb-8 flex justify-center"
            >
              <div className="relative">
                {/* Subtle glow behind avatar */}
                <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-cyan-400/20 via-sky-500/20 to-pink-500/20 blur-3xl" />

                {/* Avatar */}
                <div className="relative">
                  <img
                    src={creatorPhotoUrl}
                    alt={creatorName}
                    className="h-32 w-32 rounded-full border-2 border-white/10 object-cover"
                  />

                  {/* Sparkle badge */}
                  <div className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-pink-500">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Welcome Text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-6 sm:mb-8"
            >
              <h1 className="mb-3 text-3xl font-bold text-white sm:mb-4 sm:text-5xl">
                Welcome to Edgaze,
              </h1>
              <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-sky-400 to-pink-500 bg-clip-text text-transparent sm:text-6xl">
                {creatorName}
              </div>
            </motion.div>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mb-8 text-sm text-white/60 sm:mb-10 sm:text-lg"
            >
              Join our exclusive community of AI creators and unlock the power of visual workflows
            </motion.p>

            {/* Continue Button — same as CreatorsHero */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={onContinue}
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-8 py-4 text-lg font-semibold text-white shadow-[0_0_32px_rgba(56,189,248,0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_0_48px_rgba(56,189,248,0.5)] active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-sky-500/20 to-pink-500/20 opacity-0 transition-opacity group-hover:opacity-100 blur-xl" />
              <span className="relative">Continue</span>
              <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </div>
        </motion.div>

        {/* Bottom hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-center text-sm text-white/40"
        >
          This is a private invitation. Keep it secure.
        </motion.div>
      </div>
    </motion.div>
  );
}
