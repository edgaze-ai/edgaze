"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Mail } from "lucide-react";
import { HeroCollectToBox } from "src/components/home/HeroCollectToBox";
import Footer from "src/components/layout/Footer";

function SectionReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : reduce ? undefined : { opacity: 0, y: 32 }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export default function PressPage() {
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen w-full bg-[#040506] text-white">
      {/* Ultra-dark background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#040506]" />
        <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(ellipse_at_50%_30%,rgba(34,211,238,0.09),transparent_50%),radial-gradient(ellipse_at_50%_70%,rgba(236,72,153,0.06),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:80px_80px]" />
        <motion.div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full opacity-15 blur-[140px]"
          style={{
            background: "radial-gradient(circle, rgba(34,211,238,0.35) 0%, transparent 60%)",
          }}
          animate={reduce ? undefined : { scale: [1, 1.2, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-2/3 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full opacity-12 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 60%)",
          }}
          animate={reduce ? undefined : { scale: [1.1, 1, 1.1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 pt-4 md:pt-5">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <div className="flex items-center rounded-full pl-4 pr-4 py-2.5 md:pl-6 md:py-2.5 bg-white/[0.04] backdrop-blur-2xl border border-white/[0.05] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0 text-white hover:opacity-90 transition-opacity"
              aria-label="Edgaze home"
            >
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-8 w-8 md:h-9 md:w-9" />
              <span className="text-[14px] font-semibold tracking-tight md:text-[15px]">
                Edgaze
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-6">
              <Link
                href="/about"
                className="text-[13px] text-white/60 hover:text-white transition-colors"
              >
                About
              </Link>
              <Link
                href="/marketplace"
                className="text-[13px] text-white/60 hover:text-white transition-colors"
              >
                Marketplace
              </Link>
              <Link
                href="/marketplace"
                className="rounded-full px-4 py-2 text-[13px] font-medium text-white bg-white/8 hover:bg-white/12 border border-white/10 transition-colors"
              >
                Get started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="pt-24 md:pt-28">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8 pb-24">
          {/* Left: Press details | Right: Logo animation */}
          <section className="pt-8 md:pt-12 flex flex-col lg:flex-row lg:items-start gap-12 lg:gap-16">
            {/* Left: Press details */}
            <div className="flex-1 min-w-0">
              <SectionReveal>
                <span className="inline-block text-[10px] font-semibold tracking-[0.35em] uppercase text-cyan-400/70 mb-6">
                  Media Inquiries
                </span>
              </SectionReveal>
              <SectionReveal delay={0.05}>
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Press
                </h1>
              </SectionReveal>
              <SectionReveal delay={0.1}>
                <p className="mt-6 text-lg text-white/55 md:text-xl leading-relaxed">
                  Media inquiries, interviews, and press resources for Edgaze.
                </p>
              </SectionReveal>

              <SectionReveal delay={0.15}>
                <motion.div
                  className="mt-14 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl p-8 sm:p-10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_24px_80px_-24px_rgba(0,0,0,0.6)]"
                  whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/10 to-pink-500/10 border border-white/[0.06]">
                      <Mail className="h-5 w-5 text-cyan-400/80" />
                    </div>
                    <div>
                      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                        Press contact
                      </h2>
                      <p className="mt-4 text-xl font-semibold text-white md:text-2xl">
                        Arjun Kuttikkat
                      </p>
                      <p className="mt-1 text-sm text-white/50">Founder & CEO, Edgaze</p>
                      <a
                        href="mailto:info@arjunkuttikkat.com"
                        className="mt-4 inline-flex items-center gap-2 text-lg font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                      >
                        info@arjunkuttikkat.com
                      </a>
                      <p className="mt-4 text-sm text-white/45 leading-relaxed">
                        For interviews, media kits, press releases, and all press inquiries.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </SectionReveal>

              <SectionReveal delay={0.2}>
                <div className="mt-12 rounded-3xl border border-white/[0.05] bg-white/[0.015] backdrop-blur-xl p-8 sm:p-10">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                    About Edgaze
                  </h2>
                  <p className="mt-4 text-sm text-white/55 leading-relaxed">
                    Edgaze is the infrastructure for AI creators to build, publish, and monetize
                    workflows in one click. Built by Edge Platforms, Inc. Founded 2025. Website:{" "}
                    <a
                      href="https://edgaze.ai"
                      className="text-cyan-400/90 hover:text-cyan-300 transition-colors"
                    >
                      edgaze.ai
                    </a>
                    .
                  </p>
                </div>
              </SectionReveal>

              <SectionReveal delay={0.25}>
                <div className="mt-12">
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
                  >
                    ← About Edgaze
                  </Link>
                </div>
              </SectionReveal>
            </div>

            {/* Right: Hero animation from landing (no box) */}
            <div className="flex items-center justify-center lg:justify-end lg:sticky lg:top-28 shrink-0 w-full max-w-[500px]">
              <HeroCollectToBox noBox />
            </div>
          </section>

          <footer className="mt-24 pt-16 border-t border-white/[0.05]">
            <Footer />
          </footer>
        </div>
      </main>
    </div>
  );
}
