"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CreatorFinalCta() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-transparent to-pink-500/10 p-12 sm:p-16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.08),transparent_50%)]" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              Your workflows should be products.
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto">
              Build once. Publish once. Earn repeatedly.
              <br />
              Start your creator journey on Edgaze.
            </p>
            <Link
              href="/builder?onboarding=1"
              className="mt-10 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-12 py-5 text-lg font-semibold text-white shadow-[0_0_32px_rgba(56,189,248,0.35)] hover:shadow-[0_0_40px_rgba(56,189,248,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Join the Creator Program
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
