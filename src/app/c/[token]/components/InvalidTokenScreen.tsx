"use client";

import { motion } from "framer-motion";
import { XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface InvalidTokenScreenProps {
  reason: "invalid" | "expired" | "revoked" | "completed" | "claimed_by_other";
}

const messages = {
  invalid: {
    title: "Invalid invite",
    description: "This invite link is not valid. Please check the URL and try again.",
  },
  expired: {
    title: "Invite expired",
    description:
      "This invite has expired. Please contact the person who invited you for a new link.",
  },
  revoked: {
    title: "Invite revoked",
    description: "This invite has been revoked and is no longer valid.",
  },
  completed: {
    title: "Already used",
    description: "This invite has already been used to create an account.",
  },
  claimed_by_other: {
    title: "Already claimed",
    description: "This invite has been claimed by another user.",
  },
};

export default function InvalidTokenScreen({ reason }: InvalidTokenScreenProps) {
  const message = messages[reason] || messages.invalid;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      {/* Premium Glass Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:rounded-3xl sm:p-10"
      >
        {/* Ambient glow */}
        <div className="absolute -inset-20 bg-gradient-to-r from-red-400/10 via-orange-500/10 to-pink-500/10 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 text-center">
          {/* Error Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 flex justify-center"
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400 to-pink-500 blur-2xl"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.7, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-400/30 bg-red-500/10">
                <XCircle className="h-10 w-10 text-red-400" />
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-3 text-2xl font-bold text-white sm:mb-4 sm:text-3xl"
          >
            {message.title}
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6 text-sm text-white/60 sm:mb-8 sm:text-base"
          >
            {message.description}
          </motion.p>

          {/* Go to Edgaze Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link
              href="/marketplace"
              className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-6 py-3.5 text-base font-semibold text-black shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(56,189,248,0.6)] active:scale-[0.98] sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
            >
              <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="relative">Go to Edgaze</span>
              <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
