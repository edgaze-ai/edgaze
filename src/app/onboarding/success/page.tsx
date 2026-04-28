"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthContext";
import { CheckCircle2 } from "lucide-react";

function PremiumBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#0b0b0d]" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
      <div className="absolute -bottom-40 right-[-120px] w-[520px] h-[520px] rounded-full bg-pink-500/[0.06] blur-[140px]" />
      <div className="absolute -inset-12 opacity-55 blur-3xl edge-grad-animated" />
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}

function GlowBehindCTA() {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden rounded-[28px]">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute -inset-10 opacity-80 blur-2xl edge-grad-animated" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/25 to-black/55" />
    </div>
  );
}

export default function OnboardingSuccessPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    refreshProfile().catch(() => {});
  }, [refreshProfile]);

  useEffect(() => {
    const main = document.querySelector("main");
    if (main) {
      main.style.overflowY = "auto";
      main.style.overflowX = "hidden";
      return () => {
        main.style.overflowY = "";
        main.style.overflowX = "";
      };
    }
    return;
  }, []);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12">
      <PremiumBackdrop />
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.9, 0.2, 1] }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center"
        >
          <div className="mx-auto mb-6 h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-cyan-300" />
          </div>

          <h1 className="text-[22px] font-semibold tracking-tight text-white">Connected</h1>
          <p className="mt-2 text-[14px] text-white/55 leading-relaxed">
            Your Stripe account is ready.
          </p>

          <div className="relative mt-7 rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
            <GlowBehindCTA />
            <button
              onClick={() => router.push("/dashboard/earnings")}
              className="w-full inline-flex items-center justify-center rounded-3xl bg-white text-black px-6 py-4 text-[15px] font-semibold hover:bg-white/95 transition-colors"
            >
              Continue
            </button>
          </div>

          <div className="mt-6 text-center">
            <a href="/help" className="text-[13px] text-white/45 hover:text-white/70">
              Help
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
