"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Blocks, FileEdit, Globe, Linkedin, Play, Zap } from "lucide-react";
import Footer from "src/components/layout/Footer";

/** One combined background (deep base + cyan/pink washes — no stacked black layers). */
const PAGE_BG_STYLE: React.CSSProperties = {
  backgroundColor: "#07080b",
  backgroundImage: [
    "radial-gradient(ellipse 130% 100% at 8% 15%, rgba(34,211,238,0.22), transparent 58%)",
    "radial-gradient(ellipse 120% 90% at 92% 12%, rgba(236,72,153,0.18), transparent 55%)",
    "radial-gradient(ellipse 100% 70% at 50% 100%, rgba(34,211,238,0.10), transparent 52%)",
  ].join(", "),
};

/**
 * Full-viewport-style hero illustration — landing-adjacent look, entirely static (no timers / motion libs).
 * No overflow clipping: the whole scene scrolls with the document.
 */
function AboutHeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[640px] min-h-[min(76dvh,680px)] md:min-h-[520px] md:max-w-none">
      {/* Local wash only inside the hero art (not a second full-page black). */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-90 md:rounded-3xl [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.06)]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 35% 30%, rgba(34,211,238,0.14), transparent 58%), radial-gradient(circle at 70% 40%, rgba(236,72,153,0.11), transparent 56%)",
        }}
        aria-hidden
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 520 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M 72 120 Q 180 100 260 258"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 448 96 Q 340 140 260 258"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 420 396 Q 360 320 260 258"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 88 384 Q 170 310 260 258"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Peripheral nodes — percentages keep layout stable at any size */}
      <div
        className="pointer-events-none absolute left-[6%] top-[14%] w-[30%] max-w-[9.5rem] rounded-2xl border border-white/10 bg-[#0b0f16]/90 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        aria-hidden
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
          Input
        </div>
        <div className="mt-1 h-1.5 w-2/3 rounded-full bg-gradient-to-r from-cyan-400/50 to-white/20" />
      </div>
      <div
        className="pointer-events-none absolute right-[5%] top-[10%] w-[34%] max-w-[11rem] rounded-2xl border border-white/10 bg-[#0b0f16]/90 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        aria-hidden
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
          Prompt
        </div>
        <div className="mt-1 space-y-1">
          <div className="h-1 rounded bg-white/10" />
          <div className="h-1 w-4/5 rounded bg-white/10" />
        </div>
      </div>
      <div
        className="pointer-events-none absolute bottom-[16%] right-[7%] w-[28%] max-w-[8.5rem] rounded-xl border border-white/10 bg-[#0b0f16]/90 px-3 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        aria-hidden
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
          Tool
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-[18%] left-[8%] flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/35" />
        ))}
      </div>

      {/* Center — same vocabulary as landing hero box */}
      <div className="absolute left-1/2 top-1/2 w-[min(82%,320px)] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-3xl border border-white/12 bg-[#0b0c11]/95 p-7 shadow-[0_26px_90px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.07]">
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl opacity-90"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 25%, rgba(34,211,238,0.18), transparent 62%), radial-gradient(circle at 75% 35%, rgba(236,72,153,0.12), transparent 64%)",
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-center text-center">
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-6 rounded-full blur-2xl opacity-80"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 35% 35%, rgba(34,211,238,0.35), transparent 62%), radial-gradient(circle at 70% 55%, rgba(236,72,153,0.28), transparent 62%)",
                }}
                aria-hidden
              />
              <img
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                className="relative h-16 w-16 object-contain md:h-[4.5rem] md:w-[4.5rem]"
              />
            </div>
            <div className="mt-4 text-lg font-semibold tracking-tight text-white/95">Edgaze</div>
            <div className="mt-1 text-xs text-white/55">Collect → publish → share</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen w-full text-white font-dm-sans" style={PAGE_BG_STYLE}>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.07] pt-[max(0.75rem,env(safe-area-inset-top))] [background-color:rgba(7,8,11,0.92)] md:border-transparent md:bg-transparent md:pt-5">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-5 md:px-8">
          <div className="flex min-w-0 items-center rounded-full py-2 pl-3 pr-3 sm:pl-4 sm:pr-4 md:border md:border-white/[0.08] md:bg-white/[0.06] md:py-2.5 md:pl-6 md:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-1.5 sm:gap-2 shrink-0 text-white hover:opacity-90 transition-opacity"
              aria-label="Edgaze home"
            >
              <img
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                className="h-8 w-8 md:h-9 md:w-9 shrink-0"
              />
              <span className="text-[13px] sm:text-[14px] font-semibold tracking-tight md:text-[15px] truncate">
                Edgaze
              </span>
            </Link>
            <nav className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4 md:gap-6">
              <Link
                href="/marketplace"
                className="hidden sm:inline text-[13px] text-white/70 hover:text-white transition-colors whitespace-nowrap"
              >
                Marketplace
              </Link>
              <Link
                href="/docs"
                className="hidden sm:inline text-[13px] text-white/70 hover:text-white transition-colors whitespace-nowrap"
              >
                Docs
              </Link>
              <Link
                href="/marketplace"
                className="rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-[13px] font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors whitespace-nowrap"
              >
                Get started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="pt-[calc(5rem+env(safe-area-inset-top))] md:pt-28">
        {/* Hero: full-bleed width like landing, single column scroll (no inner scrollport). */}
        <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-5 md:px-8 pb-16 md:pb-24">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
            <div className="order-2 min-w-0 md:order-1">
              <AboutHeroIllustration />
            </div>
            <div className="order-1 min-w-0 md:order-2 md:pt-4">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                About Edgaze
              </h1>
              <p className="mt-4 md:mt-5 text-lg text-white/80 md:text-xl leading-relaxed">
                Most AI workflows never leave the person who built them. They live in private Notion
                pages, screenshot folders, or long threads that nobody else can follow. The person
                who built them knows exactly how powerful they are. Everyone else has no idea they
                exist.
              </p>
              <div className="mt-6 md:mt-8 space-y-4 text-sm md:text-base text-white/65 leading-relaxed">
                <p>
                  Edgaze is a platform where creators build, publish, and distribute AI workflows as
                  real products. Not screenshots. Not copy-paste prompts. Actual runnable tools that
                  anyone can use with a single link.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1440px] px-5 md:px-8 pb-20">
          {/* What Edgaze Is */}
          <section className="py-16 md:py-28">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              What Edgaze Is
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="space-y-6">
                <p className="text-base text-white/70 leading-relaxed">
                  Edgaze is two things: a builder and a marketplace.
                </p>
                <p className="text-base text-white/70 leading-relaxed">
                  The builder is a visual editor where you design workflows using nodes—
                  <span className="text-cyan-300">Input</span>,{" "}
                  <span className="text-cyan-300">Prompt</span>,{" "}
                  <span className="text-cyan-300">Tool</span>, and{" "}
                  <span className="text-cyan-300">Logic</span>. You connect them, configure them,
                  and turn a sequence of AI steps into something reusable. No code required.
                </p>
                <p className="text-base text-white/70 leading-relaxed">
                  The marketplace is where those workflows live publicly. Every published workflow
                  gets its own page. Visitors land on it, enter their input, and run it instantly.
                  No setup, no prompt engineering, no explanation needed. The workflow just works.
                </p>
                <p className="text-base text-white/70 leading-relaxed">
                  Together, these two sides let a creator go from idea to published AI product in
                  one place.
                </p>
              </div>
              <div className="relative rounded-2xl border border-white/[0.10] bg-white/[0.03] p-8 min-h-[240px] flex items-center justify-center">
                <svg
                  className="absolute inset-0 h-full w-full text-white/14"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M 80 80 Q 140 80, 200 100"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M 200 100 Q 260 120, 320 140"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M 200 100 Q 180 180, 200 220"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
                <div className="relative flex flex-wrap gap-3 items-center justify-center">
                  {["Input", "Prompt", "Tool", "Logic"].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 md:px-5 md:py-3"
                    >
                      <span className="text-xs font-semibold tracking-widest text-white/50">
                        {label.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* How Edgaze Works */}
          <section className="py-16 md:py-28">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              How Edgaze Works
            </h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
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
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 h-full flex flex-col"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-white/10">
                      <item.icon className="h-5 w-5 text-white/80" />
                    </div>
                    <span className="text-xs font-semibold tracking-widest text-white/45">
                      STEP {item.step}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm text-white/65 leading-relaxed flex-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Creator Economy */}
          <section className="py-16 md:py-28">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              For Creators
            </h2>
            <div className="mt-12 space-y-6 max-w-3xl">
              <p className="text-base text-white/70 leading-relaxed">
                YouTube exists for video. Substack exists for writing. Until now, AI workflows had
                no equivalent—no dedicated place to publish them, no built-in way for others to
                discover and run them, and no clean path to earn from them.
              </p>
              <p className="text-base text-white/70 leading-relaxed">Edgaze fills that gap.</p>
              <p className="text-base text-white/70 leading-relaxed">
                When you publish on Edgaze, your workflow gets a permanent page. You share one link
                and users can run it immediately. If you want to monetize, you turn it on. Edgaze
                handles the payment infrastructure so you don&apos;t have to.
              </p>
              <p className="text-base text-white/70 leading-relaxed">
                The goal isn&apos;t just distribution. It&apos;s giving AI creators the same
                leverage that video creators and writers already have—a platform that does the
                infrastructure work so you can focus on building.
              </p>
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
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 h-full"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                    <item.icon className="h-5 w-5 text-white/70" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Philosophy */}
          <section className="py-16 md:py-28">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              Our Philosophy
            </h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                {
                  title: "Clarity",
                  desc: "AI tools should be obvious to use. If someone needs a manual, the tool isn\u2019t finished.",
                },
                {
                  title: "Quality",
                  desc: "A well-structured workflow does more than a single prompt. Connected steps, clear inputs, and defined logic produce consistently better results.",
                },
                {
                  title: "Distribution",
                  desc: "Building something great matters less if nobody can find or run it. Creators deserve infrastructure that gets their work in front of people.",
                },
              ].map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 h-full"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-cyan-400/80" />
                    <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                  </div>
                  <p className="mt-4 text-sm text-white/65 leading-relaxed">{pillar.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Founder */}
          <section className="py-16 md:py-28">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl text-center">
              Founder
            </h2>
            <div className="mt-12 flex flex-col items-center max-w-xl mx-auto text-center">
              <div className="relative">
                <div
                  className="pointer-events-none absolute -inset-0.5 rounded-full bg-gradient-to-r from-cyan-500/40 via-pink-500/40 to-cyan-500/40 opacity-50 blur-sm"
                  aria-hidden
                />
                <div className="relative rounded-full overflow-hidden w-32 h-32 ring-2 ring-white/10 bg-white/5">
                  <img
                    src="/misc/arjun.png"
                    alt="Arjun Kuttikkat"
                    className="h-full w-full object-cover"
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
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">Arjun Kuttikkat</h3>
              <p className="mt-1 text-sm text-white/55">Founder, Edgaze</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
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
                Arjun Kuttikkat is a Robotics and AI student at the University of Birmingham Dubai
                and the founder of Edgaze. He started building Edgaze after running into the same
                problem repeatedly—his most useful AI workflows lived in private documents and were
                impossible to share properly. He wanted one link, one page, and one click to run.
                When that didn&apos;t exist, he built it. Edgaze is the platform he needed and
                couldn&apos;t find.
              </p>
            </div>
          </section>

          {/* Future Vision */}
          <section className="py-16 md:py-28">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              The Future of AI Workflows
            </h2>
            <div className="mt-12 space-y-6 max-w-3xl">
              <p className="text-base text-white/70 leading-relaxed">
                The limiting factor for AI adoption isn&apos;t model quality anymore. The models are
                good. The problem is that the best workflows—the ones that actually solve real
                problems—are stuck in private documents, Twitter threads, and Notion pages that
                nobody outside a small circle ever sees.
              </p>
              <p className="text-base text-white/70 leading-relaxed">
                Distribution is the bottleneck. Fix that, and the people who&apos;ve been quietly
                building powerful AI workflows can finally get them in front of the people who need
                them.
              </p>
              <p className="text-base text-white/70 leading-relaxed">
                Edgaze is built around that premise. As more creators publish and more users run
                workflows, the platform gets more useful for everyone. Discovery improves. Trust
                builds. The gap between building a workflow and having the world use it closes.
              </p>
              <p className="text-base text-white/70 leading-relaxed">
                AI will produce a new generation of creators—people who don&apos;t write code or
                make videos, but design workflows. Edgaze is where they publish.
              </p>
            </div>
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-pink-500 hover:opacity-95 transition-opacity"
              >
                Explore the marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/creators/onboarding?from=about"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-pink-500 hover:opacity-95 transition-opacity"
              >
                Join as a creator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <footer className="pt-16 md:pt-20">
            <Footer />
          </footer>
        </div>
      </main>
    </div>
  );
}
