"use client";

import { motion } from "framer-motion";
import { ArrowRight, Quote } from "lucide-react";

interface MessageStepProps {
  message: string;
  onContinue: () => void;
}

export default function MessageStep({ message, onContinue }: MessageStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex min-h-screen items-center justify-center px-4 py-4 sm:py-8"
    >
      <div className="w-full max-w-2xl">
        {/* Premium Glass Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-12"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-pink-500/5" />

          {/* Content */}
          <div className="relative z-10">
            {/* Quote Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8 flex justify-center"
            >
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-pink-500/20">
                <Quote className="h-8 w-8 text-cyan-400" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-6 text-center text-2xl font-bold text-white sm:mb-8 sm:text-4xl"
            >
              A personal message for you
            </motion.h2>

            {/* Message Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative mb-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-sm sm:p-8"
            >
              {/* Inner gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-transparent to-pink-500/5" />

              <p className="relative whitespace-pre-wrap text-base leading-relaxed text-white/80 sm:text-lg">
                {message}
              </p>
            </motion.div>

            {/* Continue Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex justify-center"
            >
              <button
                onClick={onContinue}
                className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_0_32px_rgba(56,189,248,0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_0_48px_rgba(56,189,248,0.5)] active:scale-[0.98] sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="relative">Get Started</span>
                <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
