"use client";

import React from "react";
import { motion } from "framer-motion";
import { User, CreditCard, FileEdit, Share2 } from "lucide-react";

const STEPS = [
  {
    step: 1,
    icon: User,
    title: "Set up your creator identity",
    desc: "Add your profile, handle, and avatar.",
  },
  {
    step: 2,
    icon: CreditCard,
    title: "Complete payout onboarding",
    desc: "Connect your bank via Stripe. One-time setup, secure.",
  },
  {
    step: 3,
    icon: FileEdit,
    title: "Publish workflows",
    desc: "Build in Workflow Studio or Prompt Studio, then publish.",
  },
  {
    step: 4,
    icon: Share2,
    title: "Share, sell, and grow",
    desc: "List on the marketplace. Earn from every sale.",
  },
];

export default function CreatorFlow() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            How it works
          </h2>
          <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
            Simple, professional, and built to reduce friction.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500/20 to-pink-500/20 border border-white/10 text-sm font-bold text-white">
                  {s.step}
                </div>
                <s.icon className="h-5 w-5 text-white/50" />
              </div>
              <h3 className="text-base font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-white/60">{s.desc}</p>
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-white/20" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
