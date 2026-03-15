"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const CHIPS = [
  "Publish premium workflows",
  "Sell access to creations",
  "Built for AI power users",
  "Early creator advantages",
];

export default function CreatorsHero() {
  return (
    <section className="relative pt-24 sm:pt-32 pb-20 sm:pb-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]"
            >
              Build AI workflows.{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-pink-400 bg-clip-text text-transparent">
                Publish them. Monetize them.
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="mt-6 text-lg sm:text-xl text-white/60 leading-relaxed max-w-xl"
            >
              Join the Edgaze Creator Program to publish and monetize AI workflows. Built for prompt
              creators, automation builders, and AI power users.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mt-8 flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/creators/onboarding?from=creators"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-8 py-4 text-base font-semibold text-white shadow-[0_0_32px_rgba(56,189,248,0.35)] hover:shadow-[0_0_40px_rgba(56,189,248,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Join the Creator Program
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-white/90 hover:bg-white/10 hover:border-white/25 transition-colors"
              >
                Explore Marketplace
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              {CHIPS.map((chip, i) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70"
                >
                  {chip}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative hidden lg:block"
          >
            <div className="relative space-y-4">
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 flex items-center justify-center text-white font-bold text-sm">
                    $
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/90">Earnings</div>
                    <div className="text-base font-semibold text-white">$2,480 earned</div>
                    <div className="text-xs text-emerald-400/90">Payouts ready</div>
                  </div>
                </div>
              </div>
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
                <div className="text-sm font-medium text-white/80">Workflow</div>
                <div className="text-sm font-semibold text-white mt-1">
                  LinkedIn Content Generator
                </div>
                <div className="text-xs text-white/50 mt-1">1,204 runs</div>
              </div>
              <div className="relative rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 backdrop-blur-sm">
                <div className="text-sm font-medium text-cyan-400">Creator badge</div>
                <div className="text-sm font-semibold text-white mt-1">Verified Creator</div>
                <div className="text-xs text-white/60 mt-1">Ready to sell</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
