"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useAuth } from "src/components/auth/AuthContext";

export default function CreatorFinalCta() {
  const router = useRouter();
  const { userId, profile, authReady, openSignIn } = useAuth();

  const handleCta = () => {
    if (!authReady) return;
    if (!userId) {
      openSignIn();
      return;
    }
    if (!profile?.avatar_url || profile.avatar_url === "") {
      router.push("/profile?from=creators");
      return;
    }
    if (profile?.can_receive_payments) {
      router.push("/dashboard/earnings");
      return;
    }
    router.push("/creators/onboarding?from=creators");
  };

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
            <button
              type="button"
              onClick={handleCta}
              className="mt-10 group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-12 py-5 text-lg font-semibold text-white shadow-[0_0_32px_rgba(56,189,248,0.4)] transition-all hover:shadow-[0_0_48px_rgba(56,189,248,0.5)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Become an Edgaze creator
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
