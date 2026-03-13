"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, CreditCard, TrendingUp } from "lucide-react";

const TRUST_ITEMS = [
  {
    label: "Early creator program",
    icon: Sparkles,
    accent: "from-amber-500/20 to-orange-500/10",
  },
  {
    label: "Built for AI power users",
    icon: Zap,
    accent: "from-cyan-500/20 to-sky-500/10",
  },
  {
    label: "Creator payouts powered by Stripe",
    icon: CreditCard,
    accent: "from-violet-500/20 to-fuchsia-500/10",
  },
  {
    label: "Sell workflows with built-in monetization",
    icon: TrendingUp,
    accent: "from-emerald-500/20 to-teal-500/10",
  },
];

export default function CreatorTrustBar() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="py-12 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {TRUST_ITEMS.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -2 }}
              className="group relative"
            >
              <div
                className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-5 py-4 transition-all duration-300
                  shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_4px_24px_rgba(0,0,0,0.2)]
                  hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_8px_32px_rgba(0,0,0,0.25)]`}
              >
                <div
                  className={`absolute inset-0 opacity-60 bg-gradient-to-br ${item.accent} group-hover:opacity-80 transition-opacity`}
                />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.04),transparent_70%)]" />
                <div className="relative flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} border border-white/10`}
                  >
                    <item.icon className="h-5 w-5 text-white/90" />
                  </div>
                  <span className="text-sm font-medium text-white/90 leading-snug">
                    {item.label}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
