"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Blocks, FileEdit, Globe, Linkedin, Play, Zap } from "lucide-react";
import Footer from "src/components/layout/Footer";

function SectionReveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : reduce ? undefined : { opacity: 0, y: 28 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function HeroAnimation() {
  const reduce = useReducedMotion();

  return (
    <div className="relative h-[420px] md:h-[520px] flex items-center justify-center lg:justify-end pr-0 lg:pr-12">
      {/* Central composition */}
      <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center">
        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full border border-white/[0.06]"
          style={{
            background: "radial-gradient(circle at 50% 50%, transparent 45%, rgba(34,211,238,0.04) 55%, rgba(236,72,153,0.03) 70%, transparent 75%)",
          }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />
        {/* Edgaze logo — large, with gradient aura */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.div
            className="absolute -inset-16 rounded-full opacity-50 blur-3xl"
            style={{
              background: "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.2), rgba(236,72,153,0.12) 40%, transparent 65%)",
            }}
            animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_24px_80px_-24px_rgba(0,0,0,0.5)]">
            <img
              src="/brand/edgaze-mark.png"
              alt=""
              className="w-20 h-20 md:w-24 md:h-24 object-contain"
              aria-hidden
            />
          </div>
        </motion.div>

        {/* Glass card 1 — top right */}
        <motion.div
          className="absolute right-0 top-[8%] w-28 md:w-36 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)" }}
        >
          <motion.div
            className="h-2 w-12 rounded-full bg-gradient-to-r from-cyan-500/40 to-pink-500/30"
            animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="mt-2 text-[10px] font-medium tracking-widest text-white/40 uppercase">Build</div>
        </motion.div>

        {/* Glass card 2 — bottom left */}
        <motion.div
          className="absolute left-0 bottom-[12%] w-28 md:w-36 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)" }}
        >
          <motion.div
            className="h-2 w-10 rounded-full bg-gradient-to-r from-pink-500/40 to-cyan-500/30"
            animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
          <div className="mt-2 text-[10px] font-medium tracking-widest text-white/40 uppercase">Publish</div>
        </motion.div>

        {/* Glass card 3 — top left */}
        <motion.div
          className="absolute left-[5%] top-[15%] w-24 md:w-32 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-3 py-2.5"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-white/30"
                animate={reduce ? undefined : { opacity: [0.3, 0.8, 0.3], scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              />
            ))}
          </div>
        </motion.div>

        {/* Glass card 4 — bottom right */}
        <motion.div
          className="absolute right-[8%] bottom-[20%] w-24 md:w-32 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-3 py-2.5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="text-[9px] font-semibold tracking-wider text-white/35">Workflow</div>
        </motion.div>

        {/* Subtle floating nodes */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-white/[0.04] bg-white/[0.02]"
            style={{
              width: 8 + i * 4,
              height: 8 + i * 4,
              left: `${25 + i * 20}%`,
              top: `${30 + (i % 2) * 35}%`,
            }}
            animate={reduce ? undefined : { y: [0, -6, 0], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AboutPage() {

  return (
    <div className="min-h-screen w-full bg-[#07080b] text-white">
      {/* Background layers */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#07080b]" />
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.14),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.11),transparent_46%),radial-gradient(circle_at_55%_90%,rgba(34,211,238,0.06),transparent_52%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:92px_92px]" />
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute left-[15%] top-[20%] h-96 w-96 rounded-full opacity-30 blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.4) 0%, transparent 70%)" }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[20%] top-[30%] h-80 w-80 rounded-full opacity-25 blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)" }}
          animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[25%] left-[40%] h-64 w-64 rounded-full opacity-15 blur-[80px]"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.35) 0%, transparent 70%)" }}
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Simple header */}
      <header className="fixed left-0 right-0 top-0 z-50 pt-4 md:pt-5">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <div className="flex items-center rounded-full pl-4 pr-4 py-2.5 md:pl-6 md:py-2.5 bg-white/[0.06] backdrop-blur-2xl border border-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0 text-white hover:opacity-90 transition-opacity"
              aria-label="Edgaze home"
            >
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-8 w-8 md:h-9 md:w-9" />
              <span className="text-[14px] font-semibold tracking-tight md:text-[15px]">Edgaze</span>
            </Link>
            <nav className="ml-auto flex items-center gap-6">
              <Link href="/marketplace" className="text-[13px] text-white/70 hover:text-white transition-colors">
                Marketplace
              </Link>
              <Link href="/docs" className="text-[13px] text-white/70 hover:text-white transition-colors">
                Docs
              </Link>
              <Link
                href="/marketplace"
                className="rounded-full px-4 py-2 text-[13px] font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
              >
                Get started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="pt-24 md:pt-28">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8 pb-20">
          {/* Hero */}
          <section className="py-20 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.2fr] gap-12 lg:gap-16 items-center">
              {/* Left: Premium animation — Edgaze logo + glass elements */}
              <div className="order-2 lg:order-1">
                <HeroAnimation />
              </div>
              {/* Right: Copy */}
              <div className="order-1 lg:order-2 relative">
                <motion.div
                  className="absolute -left-8 -top-8 w-64 h-64 rounded-full opacity-30 blur-3xl pointer-events-none hidden lg:block"
                  style={{
                    background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 60%), radial-gradient(circle, rgba(236,72,153,0.08), transparent 60%)",
                  }}
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.h1
                  className="relative text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  About Edgaze
                </motion.h1>
                <motion.p
                  className="relative mt-6 text-xl text-white/80 md:text-2xl max-w-2xl leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  Most AI workflows never leave the person who built them. They live in private Notion pages, screenshot folders, or long threads that nobody else can follow. The person who built them knows exactly how powerful they are. Everyone else has no idea they exist.
                </motion.p>
                <motion.div
                  className="relative mt-10 max-w-2xl space-y-5 text-base text-white/65 leading-relaxed"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <p>
                    Edgaze is a platform where creators build, publish, and distribute AI workflows as real products. Not screenshots. Not copy-paste prompts. Actual runnable tools that anyone can use with a single link.
                  </p>
                </motion.div>
              </div>
            </div>
          </section>

          {/* What Edgaze Is */}
          <section className="py-20 md:py-28">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                What Edgaze Is
              </h2>
            </SectionReveal>
            <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="space-y-6">
                <SectionReveal delay={0.05}>
                  <p className="text-base text-white/70 leading-relaxed">
                    Edgaze is two things: a builder and a marketplace.
                  </p>
                </SectionReveal>
                <SectionReveal delay={0.1}>
                  <p className="text-base text-white/70 leading-relaxed">
                    The builder is a visual editor where you design workflows using nodes—<span className="text-cyan-300">Input</span>, <span className="text-cyan-300">Prompt</span>, <span className="text-cyan-300">Tool</span>, and <span className="text-cyan-300">Logic</span>. You connect them, configure them, and turn a sequence of AI steps into something reusable. No code required.
                  </p>
                </SectionReveal>
                <SectionReveal delay={0.15}>
                  <p className="text-base text-white/70 leading-relaxed">
                    The marketplace is where those workflows live publicly. Every published workflow gets its own page. Visitors land on it, enter their input, and run it instantly. No setup, no prompt engineering, no explanation needed. The workflow just works.
                  </p>
                </SectionReveal>
                <SectionReveal delay={0.2}>
                  <p className="text-base text-white/70 leading-relaxed">
                    Together, these two sides let a creator go from idea to published AI product in one place.
                  </p>
                </SectionReveal>
              </div>
              {/* Node mock visual */}
              <SectionReveal delay={0.1}>
                <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 min-h-[280px] flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.12),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(236,72,153,0.08),transparent_50%)]" />
                  <svg className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
                    <motion.path
                      d="M 80 80 Q 140 80, 200 100"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="1.5"
                      fill="none"
                      animate={{ opacity: [0.15, 0.35, 0.15] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.path
                      d="M 200 100 Q 260 120, 320 140"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="1.5"
                      fill="none"
                      animate={{ opacity: [0.15, 0.35, 0.15] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: 0.3, ease: "easeInOut" }}
                    />
                    <motion.path
                      d="M 200 100 Q 180 180, 200 220"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="1.5"
                      fill="none"
                      animate={{ opacity: [0.15, 0.35, 0.15] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: 0.6, ease: "easeInOut" }}
                    />
                  </svg>
                  <div className="relative flex flex-wrap gap-4 items-center justify-center">
                    {["Input", "Prompt", "Tool", "Logic"].map((label, i) => (
                      <motion.div
                        key={label}
                        className="rounded-xl border border-white/[0.1] bg-white/[0.05] backdrop-blur px-5 py-3 shadow-lg"
                        whileHover={{ scale: 1.03, borderColor: "rgba(34,211,238,0.3)" }}
                        transition={{ duration: 0.2 }}
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        <span className="text-xs font-semibold tracking-widest text-white/50">{label.toUpperCase()}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </SectionReveal>
            </div>
          </section>

          {/* How Edgaze Works */}
          <section className="py-20 md:py-28">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                How Edgaze Works
              </h2>
            </SectionReveal>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                {
                  step: 1,
                  icon: Blocks,
                  title: "Build",
                  desc: "Open the visual editor and design your workflow. Chain together inputs, prompts, tools, and logic nodes. Each node does one thing. Together they do something powerful.",
                },
                {
                  step: 2,
                  icon: FileEdit,
                  title: "Publish",
                  desc: "When your workflow is ready, publish it. Edgaze generates a clean public page with everything a user needs to run it. You control whether it\u2019s free or paid.",
                },
                {
                  step: 3,
                  icon: Play,
                  title: "Run",
                  desc: "Users land on your page, enter their input, and hit run. The workflow executes instantly. No API keys, no setup, no reading a tutorial first.",
                },
              ].map((item, i) => (
                <SectionReveal key={item.step} delay={i * 0.08}>
                  <motion.div
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-8 h-full flex flex-col"
                    whileHover={{ scale: 1.02, borderColor: "rgba(255,255,255,0.12)", boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-white/10">
                        <item.icon className="h-5 w-5 text-white/80" />
                      </div>
                      <span className="text-xs font-semibold tracking-widest text-white/45">STEP {item.step}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 text-sm text-white/65 leading-relaxed flex-1">{item.desc}</p>
                  </motion.div>
                </SectionReveal>
              ))}
            </div>
          </section>

          {/* Creator Economy */}
          <section className="py-20 md:py-28">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                For Creators
              </h2>
            </SectionReveal>
            <div className="mt-12 space-y-6 max-w-3xl">
              <SectionReveal delay={0.05}>
                <p className="text-base text-white/70 leading-relaxed">
                  YouTube exists for video. Substack exists for writing. Until now, AI workflows had no equivalent—no dedicated place to publish them, no built-in way for others to discover and run them, and no clean path to earn from them.
                </p>
              </SectionReveal>
              <SectionReveal delay={0.1}>
                <p className="text-base text-white/70 leading-relaxed">
                  Edgaze fills that gap.
                </p>
              </SectionReveal>
              <SectionReveal delay={0.15}>
                <p className="text-base text-white/70 leading-relaxed">
                  When you publish on Edgaze, your workflow gets a permanent page. You share one link and users can run it immediately. If you want to monetize, you turn it on. Edgaze handles the payment infrastructure so you don&apos;t have to.
                </p>
              </SectionReveal>
              <SectionReveal delay={0.2}>
                <p className="text-base text-white/70 leading-relaxed">
                  The goal isn&apos;t just distribution. It&apos;s giving AI creators the same leverage that video creators and writers already have—a platform that does the infrastructure work so you can focus on building.
                </p>
              </SectionReveal>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: FileEdit,
                  title: "Publish",
                  desc: "Your workflow becomes a product the moment you hit publish. One link is all you need to share it.",
                },
                {
                  icon: Globe,
                  title: "Reach",
                  desc: "Anyone can run your workflow. No setup on their end. No explanation required from you.",
                },
                {
                  icon: Zap,
                  title: "Monetize",
                  desc: "Set a price when you\u2019re ready. Edgaze handles payments through Stripe so earnings go directly to you.",
                },
              ].map((item, i) => (
                <SectionReveal key={item.title} delay={i * 0.08}>
                  <motion.div
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-6 h-full"
                    whileHover={{ borderColor: "rgba(255,255,255,0.12)" }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                      <item.icon className="h-5 w-5 text-white/70" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-white/60 leading-relaxed">{item.desc}</p>
                  </motion.div>
                </SectionReveal>
              ))}
            </div>
          </section>

          {/* Philosophy */}
          <section className="py-20 md:py-28">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                Our Philosophy
              </h2>
            </SectionReveal>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                { title: "Clarity", desc: "AI tools should be obvious to use. If someone needs a manual, the tool isn\u2019t finished." },
                { title: "Quality", desc: "A well-structured workflow does more than a single prompt. Connected steps, clear inputs, and defined logic produce consistently better results." },
                { title: "Distribution", desc: "Building something great matters less if nobody can find or run it. Creators deserve infrastructure that gets their work in front of people." },
              ].map((pillar, i) => (
                <SectionReveal key={pillar.title} delay={i * 0.08}>
                  <motion.div
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-8 h-full"
                    whileHover={{ scale: 1.02, borderColor: "rgba(255,255,255,0.12)" }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-cyan-400/80" />
                      <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                    </div>
                    <p className="mt-4 text-sm text-white/65 leading-relaxed">{pillar.desc}</p>
                  </motion.div>
                </SectionReveal>
              ))}
            </div>
          </section>

          {/* Founder */}
          <section className="py-20 md:py-28">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl text-center">
                Founder
              </h2>
            </SectionReveal>
            <SectionReveal delay={0.1}>
              <div className="mt-16 flex flex-col items-center max-w-xl mx-auto text-center">
                <motion.div
                  className="relative"
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500/50 via-pink-500/50 to-cyan-500/50 opacity-70 blur-sm" />
                  <div className="relative rounded-full overflow-hidden w-32 h-32 ring-2 ring-white/10 bg-white/5">
                    <img
                      src="/misc/arjun.png"
                      alt="Arjun Kuttikkat"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const t = e.currentTarget;
                        t.style.display = "none";
                        const fallback = t.nextElementSibling as HTMLElement;
                        if (fallback) {
                          fallback.classList.remove("hidden");
                          fallback.classList.add("flex");
                        }
                      }}
                    />
                    <div
                      className="hidden absolute inset-0 items-center justify-center text-2xl font-semibold text-white/70"
                      aria-hidden
                    >
                      AK
                    </div>
                  </div>
                </motion.div>
                <h3 className="mt-6 text-xl font-semibold text-white">Arjun Kuttikkat</h3>
                <p className="mt-1 text-sm text-white/55">Founder, Edgaze</p>
                <div className="mt-4 flex items-center justify-center gap-4">
                  <a
                    href="https://www.linkedin.com/in/arjun-kuttikkat/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="Arjun on LinkedIn"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </a>
                  <a
                    href="https://x.com/Arjun_kuttikkat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="Arjun on X"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    X
                  </a>
                </div>
                <p className="mt-6 text-base text-white/70 leading-relaxed">
                  Arjun Kuttikkat is a Robotics and AI student at the University of Birmingham Dubai and the founder of Edgaze. He started building Edgaze after running into the same problem repeatedly—his most useful AI workflows lived in private documents and were impossible to share properly. He wanted one link, one page, and one click to run. When that didn&apos;t exist, he built it. Edgaze is the platform he needed and couldn&apos;t find.
                </p>
              </div>
            </SectionReveal>
          </section>

          {/* Future Vision */}
          <section className="py-20 md:py-28">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                The Future of AI Workflows
              </h2>
            </SectionReveal>
            <div className="mt-12 space-y-6 max-w-3xl">
              <SectionReveal delay={0.05}>
                <p className="text-base text-white/70 leading-relaxed">
                  The limiting factor for AI adoption isn&apos;t model quality anymore. The models are good. The problem is that the best workflows—the ones that actually solve real problems—are stuck in private documents, Twitter threads, and Notion pages that nobody outside a small circle ever sees.
                </p>
              </SectionReveal>
              <SectionReveal delay={0.1}>
                <p className="text-base text-white/70 leading-relaxed">
                  Distribution is the bottleneck. Fix that, and the people who&apos;ve been quietly building powerful AI workflows can finally get them in front of the people who need them.
                </p>
              </SectionReveal>
              <SectionReveal delay={0.15}>
                <p className="text-base text-white/70 leading-relaxed">
                  Edgaze is built around that premise. As more creators publish and more users run workflows, the platform gets more useful for everyone. Discovery improves. Trust builds. The gap between building a workflow and having the world use it closes.
                </p>
              </SectionReveal>
              <SectionReveal delay={0.2}>
                <p className="text-base text-white/70 leading-relaxed">
                  AI will produce a new generation of creators—people who don&apos;t write code or make videos, but design workflows. Edgaze is where they publish.
                </p>
              </SectionReveal>
            </div>
            <SectionReveal delay={0.2}>
              <div className="mt-12 flex flex-wrap gap-4">
                <Link
                  href="/marketplace"
                  className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-pink-500 hover:opacity-95 transition-opacity"
                >
                  Explore the marketplace
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/creators"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors"
                >
                  Join as a creator
                </Link>
              </div>
            </SectionReveal>
          </section>

          {/* Footer */}
          <footer className="pt-20">
            <Footer />
          </footer>
        </div>
      </main>
    </div>
  );
}
