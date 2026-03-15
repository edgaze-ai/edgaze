"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import Footer from "src/components/layout/Footer";

const PRESS_EMAIL = "press@edgaze.ai";

export default function PressPage() {
  return (
    <div className="h-screen w-full overflow-y-auto overflow-x-hidden bg-[#07080b] text-white">
      {/* Edgaze design: cyan + pink gradient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#07080b]" />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 120% 70% at 20% 15%, rgba(34,211,238,0.14) 0%, transparent 50%), radial-gradient(ellipse 100% 70% at 80% 20%, rgba(236,72,153,0.12) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 50% 90%, rgba(236,72,153,0.08) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full opacity-25 blur-[150px]"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.35) 0%, rgba(236,72,153,0.2) 50%, transparent 70%)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      {/* Header — match about page */}
      <header className="fixed left-0 right-0 top-0 z-50 pt-4 md:pt-5">
        <div className="mx-auto max-w-[1440px] px-5 md:px-8">
          <div className="flex items-center rounded-full pl-4 pr-4 py-2.5 md:pl-6 md:py-2.5 bg-white/[0.06] backdrop-blur-2xl border border-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]">
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
                className="text-[13px] text-white/70 hover:text-white transition-colors"
              >
                About
              </Link>
              <Link
                href="/marketplace"
                className="text-[13px] text-white/70 hover:text-white transition-colors"
              >
                Marketplace
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
        <div className="mx-auto max-w-[720px] px-5 md:px-8 pb-12">
          <section className="py-16 md:py-20">
            <span
              className="inline-block text-[10px] font-semibold tracking-[0.35em] uppercase mb-6"
              style={{ color: "rgba(34,211,238,0.9)" }}
            >
              Media Inquiries
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-[3.25rem]">
              Press
            </h1>
            <p className="mt-6 text-lg text-white/60 md:text-xl leading-relaxed">
              Media inquiries, interviews, and press resources for Edgaze.
            </p>

            {/* Press contact — email only once, as CTA */}
            <div
              className="mt-14 rounded-3xl border border-white/[0.08] backdrop-blur-2xl p-8 sm:p-10 shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_24px_80px_-24px_rgba(0,0,0,0.5)]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(255,255,255,0.02) 40%, rgba(236,72,153,0.05) 100%)",
              }}
            >
              <div className="flex items-start gap-5">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(34,211,238,0.12) 0%, rgba(236,72,153,0.1) 100%)",
                  }}
                >
                  <Mail className="h-6 w-6" style={{ color: "rgba(236,72,153,0.95)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                    Press contact
                  </h2>
                  <p className="mt-4 text-sm text-white/55 leading-relaxed">
                    For interviews, media kits, press releases, and all press inquiries.
                  </p>
                  <a
                    href={`mailto:${PRESS_EMAIL}`}
                    className="mt-5 inline-block text-lg font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ color: "rgba(236,72,153,0.95)" }}
                  >
                    {PRESS_EMAIL}
                  </a>
                </div>
              </div>
            </div>

            {/* About Edgaze */}
            <div
              className="mt-12 rounded-3xl border border-white/[0.06] backdrop-blur-xl p-8 sm:p-10"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(34,211,238,0.03) 40%, rgba(236,72,153,0.03) 100%)",
              }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                About Edgaze
              </h2>
              <p className="mt-4 text-sm text-white/60 leading-relaxed">
                Edgaze is the infrastructure for AI creators to build, publish, and monetize
                workflows in one click. Built by Edge Platforms, Inc. Founded 2025. Website:{" "}
                <a
                  href="https://edgaze.ai"
                  className="font-medium hover:opacity-90 transition-opacity"
                  style={{ color: "rgba(236,72,153,0.95)" }}
                >
                  edgaze.ai
                </a>
                .
              </p>
            </div>

            {/* Proper CTA button — match about page style */}
            <div className="mt-14">
              <Link
                href="/about"
                className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95"
                style={{
                  background: "linear-gradient(to right, rgb(34,211,238), rgb(236,72,153))",
                }}
              >
                About Edgaze
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </section>
        </div>

        <footer className="mt-0 pt-12 pb-12 border-t border-white/[0.06]">
          <div className="mx-auto max-w-[1440px] px-5 md:px-8">
            <Footer />
          </div>
        </footer>
      </main>
    </div>
  );
}
