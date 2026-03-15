"use client";

import React from "react";
import { motion } from "framer-motion";
import { DollarSign, Repeat, FileCode2, Share2, Sliders, TrendingUp } from "lucide-react";

const BENEFITS = [
  {
    icon: DollarSign,
    title: "Monetize knowledge",
    desc: "Turn your prompts and workflows into paid products. Set your price and keep the majority of every sale.",
  },
  {
    icon: Repeat,
    title: "Build once, earn repeatedly",
    desc: "Publish once. Every run, every subscription, every sale adds up without extra work.",
  },
  {
    icon: FileCode2,
    title: "Publish polished products",
    desc: "Package workflows with clear inputs, outputs, and docs. Look professional from day one.",
  },
  {
    icon: Share2,
    title: "Get discovered",
    desc: "Marketplace distribution and search. Your creations surface to people looking for exactly what you build.",
  },
  {
    icon: Sliders,
    title: "Control access and pricing",
    desc: "Free, paywall, or subscription. You decide who gets in and what they pay.",
  },
  {
    icon: TrendingUp,
    title: "Build a creator business",
    desc: "Not just sharing prompts. Run a real business with sales, earnings, and growth.",
  },
];

export default function CreatorBenefits() {
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
            Why creators join
          </h2>
          <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
            Outcomes that matter to serious AI creators.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-cyan-500/20 hover:bg-white/[0.05] hover:shadow-[0_0_30px_rgba(34,211,238,0.06)] transition-all duration-300"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-white/10 mb-4 group-hover:border-cyan-400/30 transition-colors">
                <b.icon className="h-7 w-7 text-cyan-400/90" />
              </div>
              <h3 className="text-lg font-semibold text-white">{b.title}</h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
