"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Blocks, FileEdit, Globe, Linkedin, Play, Zap } from "lucide-react";
import Footer from "src/components/layout/Footer";

const NODE_TX = {
  fill: "#101014",
  stroke: "rgba(255,255,255,0.11)",
  label: "rgba(255,255,255,0.48)",
  line: "rgba(255,255,255,0.20)",
};

function AboutSectionTitle({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <h2
      className={
        align === "center"
          ? "text-center text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl md:text-[2.125rem] md:leading-snug"
          : "text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl md:text-[2.125rem] md:leading-snug"
      }
    >
      {children}
    </h2>
  );
}

/** Single SVG: nodes + edges share one coordinate system so connectors never miss the boxes. */
function AboutHeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[440px] min-h-[min(72dvh,560px)] md:min-h-[480px] md:max-w-[480px]">
      <svg
        className="h-auto w-full"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="about-hero-center-glow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.32)" />
            <stop offset="40%" stopColor="rgba(236,72,153,0.18)" />
            <stop offset="68%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="about-edge-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.55)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="100%" stopColor="rgba(236,72,153,0.55)" />
          </linearGradient>
        </defs>

        <circle
          cx={200}
          cy={200}
          r={102}
          fill="url(#about-hero-center-glow)"
          className="about-hero-glow-pulse"
        />

        {/* Edges: anchor to box midpoints, meet hub faces */}
        <path
          d="M 112 74 C 102 125 105 175 118 200"
          stroke="url(#about-edge-accent)"
          strokeOpacity={0.85}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 288 68 C 250 68 222 88 200 118"
          stroke="url(#about-edge-accent)"
          strokeOpacity={0.85}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 335 292 C 335 248 315 215 282 200"
          stroke="url(#about-edge-accent)"
          strokeOpacity={0.85}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 68 288 C 68 258 118 282 200 282"
          stroke="url(#about-edge-accent)"
          strokeOpacity={0.75}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* INPUT */}
        <g className="about-hero-node-float" style={{ animationDelay: "0s" }}>
          <g transform="translate(20, 48)">
            <rect width={92} height={52} rx={12} fill={NODE_TX.fill} stroke={NODE_TX.stroke} />
            <text
              x={46}
              y={21}
              textAnchor="middle"
              fill={NODE_TX.label}
              fontSize={9}
              fontWeight={600}
              letterSpacing="0.14em"
              fontFamily="ui-sans-serif,system-ui,sans-serif"
            >
              INPUT
            </text>
            <rect x={18} y={34} width={56} height={4} rx={2} fill="rgba(255,255,255,0.2)" />
          </g>
        </g>

        {/* PROMPT */}
        <g className="about-hero-node-float" style={{ animationDelay: "0.35s" }}>
          <g transform="translate(288, 42)">
            <rect width={92} height={52} rx={12} fill={NODE_TX.fill} stroke={NODE_TX.stroke} />
            <text
              x={46}
              y={21}
              textAnchor="middle"
              fill={NODE_TX.label}
              fontSize={9}
              fontWeight={600}
              letterSpacing="0.14em"
              fontFamily="ui-sans-serif,system-ui,sans-serif"
            >
              PROMPT
            </text>
            <rect x={16} y={30} width={60} height={3} rx={1.5} fill="rgba(255,255,255,0.10)" />
            <rect x={16} y={37} width={48} height={3} rx={1.5} fill="rgba(255,255,255,0.08)" />
          </g>
        </g>

        {/* TOOL */}
        <g className="about-hero-node-float" style={{ animationDelay: "0.7s" }}>
          <g transform="translate(292, 292)">
            <rect width={86} height={44} rx={11} fill={NODE_TX.fill} stroke={NODE_TX.stroke} />
            <text
              x={43}
              y={26}
              textAnchor="middle"
              fill={NODE_TX.label}
              fontSize={9}
              fontWeight={600}
              letterSpacing="0.14em"
              fontFamily="ui-sans-serif,system-ui,sans-serif"
            >
              TOOL
            </text>
          </g>
        </g>

        {/* LOGIC */}
        <g className="about-hero-node-float" style={{ animationDelay: "0.5s" }}>
          <g transform="translate(24, 288)">
            <rect width={88} height={44} rx={11} fill={NODE_TX.fill} stroke={NODE_TX.stroke} />
            <text
              x={44}
              y={26}
              textAnchor="middle"
              fill={NODE_TX.label}
              fontSize={9}
              fontWeight={600}
              letterSpacing="0.14em"
              fontFamily="ui-sans-serif,system-ui,sans-serif"
            >
              LOGIC
            </text>
          </g>
        </g>

        {/* Center card (HTML for crisp logo + type) */}
        <foreignObject x={118} y={118} width={164} height={164}>
          <div
            className="about-hero-node-float flex h-full w-full flex-col items-center justify-center rounded-[1.25rem] border border-white/[0.14] bg-[#0b0c11] bg-clip-padding px-4 py-5 shadow-[0_0_0_1px_rgba(34,211,238,0.12)_inset,0_26px_90px_rgba(0,0,0,0.55),0_0_72px_-28px_rgba(34,211,238,0.2),0_0_72px_-28px_rgba(236,72,153,0.14)]"
            style={{ boxSizing: "border-box", animationDuration: "6.8s", animationDelay: "0.12s" }}
          >
            <img
              src="/brand/edgaze-mark.png"
              alt="Edgaze"
              className="h-[3.25rem] w-[3.25rem] object-contain md:h-14 md:w-14"
            />
            <div className="mt-3 text-[15px] font-semibold tracking-tight text-white/95">
              Edgaze
            </div>
            <div className="mt-1 text-[10px] text-white/45">Collect, publish, share</div>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}

/** Builder diagram: Input, Prompt, Tool on one row; Logic under Prompt. All edges in-svg. */
function WorkflowBuilderDiagram() {
  const W = 520;
  const H = 280;
  const input = { x: 36, y: 64, w: 108, h: 52 };
  const prompt = { x: 206, y: 64, w: 108, h: 52 };
  const tool = { x: 376, y: 64, w: 108, h: 52 };
  const logic = { x: 206, y: 156, w: 108, h: 48 };

  const midX = (r: { x: number; y: number; w: number; h: number }) => r.x + r.w / 2;
  const midY = (r: { x: number; y: number; w: number; h: number }) => r.y + r.h / 2;
  const rightEdge = (r: { x: number; w: number }) => r.x + r.w;
  const bottomEdge = (r: { y: number; h: number }) => r.y + r.h;

  const iR = rightEdge(input);
  const pL = prompt.x;
  const pR = rightEdge(prompt);
  const tL = tool.x;
  const yMid = midY(input);
  const pMx = midX(prompt);
  const pBot = bottomEdge(prompt);
  const lTop = logic.y;

  return (
    <div className="rounded-[1.15rem] bg-gradient-to-br from-cyan-500/[0.2] via-white/[0.08] to-pink-500/[0.2] p-px shadow-[0_0_64px_-28px_rgba(34,211,238,0.18),0_0_64px_-28px_rgba(236,72,153,0.12)]">
      <div className="rounded-[1.1rem] bg-black p-4 md:p-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="workflow-edge-accent" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.65)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor="rgba(236,72,153,0.65)" />
            </linearGradient>
          </defs>
          {/* Input → Prompt */}
          <path
            d={`M ${iR} ${yMid} L ${pL} ${yMid}`}
            stroke="url(#workflow-edge-accent)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* Prompt → Tool */}
          <path
            d={`M ${pR} ${yMid} L ${tL} ${yMid}`}
            stroke="url(#workflow-edge-accent)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* Prompt → Logic */}
          <path
            d={`M ${pMx} ${pBot} L ${pMx} ${lTop}`}
            stroke="url(#workflow-edge-accent)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />

          {[input, prompt, tool, logic].map((r, idx) => {
            const labels = ["INPUT", "PROMPT", "TOOL", "LOGIC"];
            return (
              <g key={labels[idx]}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  rx={12}
                  fill={NODE_TX.fill}
                  stroke={NODE_TX.stroke}
                />
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2 + 4}
                  textAnchor="middle"
                  fill={NODE_TX.label}
                  fontSize={10}
                  fontWeight={600}
                  letterSpacing="0.12em"
                  fontFamily="ui-sans-serif,system-ui,sans-serif"
                >
                  {labels[idx]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen w-full bg-black text-white font-dm-sans">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.07] bg-black/95 pt-[max(0.75rem,env(safe-area-inset-top))] md:border-transparent md:bg-transparent md:pt-5">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-5 md:px-8">
          <div className="flex min-w-0 items-center rounded-full py-2 pl-3 pr-3 sm:pl-4 sm:pr-4 md:bg-gradient-to-r md:from-cyan-500/25 md:via-white/10 md:to-pink-500/25 md:p-px md:shadow-[0_0_48px_-16px_rgba(34,211,238,0.22),0_0_48px_-16px_rgba(236,72,153,0.15)]">
            <div className="flex w-full min-w-0 flex-1 items-center rounded-full md:border md:border-white/[0.07] md:bg-black/90 md:py-2.5 md:pl-6 md:pr-4 md:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
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
                  className="rounded-full bg-gradient-to-r from-cyan-500/25 via-white/10 to-pink-500/25 p-[1px] whitespace-nowrap transition-opacity hover:opacity-95"
                >
                  <span className="flex items-center rounded-full bg-black/90 px-3 py-1.5 text-[12px] font-medium text-white sm:px-4 sm:py-2 sm:text-[13px]">
                    Get started
                  </span>
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-[calc(5rem+env(safe-area-inset-top))] md:pt-28">
        {/* Hero: full-bleed width like landing, single column scroll (no inner scrollport). */}
        <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-5 pt-6 md:px-8 md:pt-10 pb-16 md:pb-24">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
            <div className="order-2 min-w-0 md:order-1">
              <AboutHeroIllustration />
            </div>
            <div className="order-1 min-w-0 md:order-2 pt-10 sm:pt-16 md:pt-20 lg:pt-28">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl md:text-5xl md:leading-[1.08]">
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
                  real products. Not screenshots. Not pasted prompts. Actual runnable tools that
                  anyone can use with a single link.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1440px] px-5 md:px-8 pb-20">
          {/* What Edgaze Is */}
          <section className="py-16 md:py-28">
            <AboutSectionTitle>What Edgaze Is</AboutSectionTitle>
            <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16 md:mt-14">
              <div className="space-y-6">
                <p className="text-base text-white/70 leading-relaxed">
                  Edgaze is two things: a builder and a marketplace.
                </p>
                <p className="text-base text-white/70 leading-relaxed">
                  The builder is a visual editor where you design workflows using nodes:{" "}
                  <span className="font-medium text-white/90">Input</span>,{" "}
                  <span className="font-medium text-white/90">Prompt</span>,{" "}
                  <span className="font-medium text-white/90">Tool</span>, and{" "}
                  <span className="font-medium text-white/90">Logic</span>. You connect them,
                  configure them, and turn a sequence of AI steps into something reusable. No code
                  required.
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
              <WorkflowBuilderDiagram />
            </div>
          </section>

          {/* How Edgaze Works */}
          <section className="py-16 md:py-28">
            <AboutSectionTitle>How Edgaze Works</AboutSectionTitle>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 md:mt-14">
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
                  className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-8 h-full flex flex-col shadow-[0_24px_50px_-28px_rgba(0,0,0,0.55)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.07]">
                      <item.icon className="h-5 w-5 text-white/85" />
                    </div>
                    <span className="text-xs font-semibold tracking-[0.14em] text-white/38">
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
            <AboutSectionTitle>For Creators</AboutSectionTitle>
            <div className="mt-12 space-y-6 max-w-3xl md:mt-14">
              <p className="text-base text-white/70 leading-relaxed">
                YouTube exists for video. Substack exists for writing. Until now, AI workflows had
                no equivalent: no dedicated place to publish them, no built-in way for others to
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
                leverage that video creators and writers already have: a platform that does the
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06]">
                    <item.icon className="h-5 w-5 text-white/80" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Philosophy */}
          <section className="py-16 md:py-28">
            <AboutSectionTitle>Our Philosophy</AboutSectionTitle>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 md:mt-14">
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
                    <Zap className="h-5 w-5 text-white/50" />
                    <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                  </div>
                  <p className="mt-4 text-sm text-white/65 leading-relaxed">{pillar.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Founder */}
          <section className="py-16 md:py-28">
            <AboutSectionTitle align="center">Founder</AboutSectionTitle>
            <div className="mt-12 flex flex-col items-center max-w-xl mx-auto text-center md:mt-14">
              <div className="rounded-full bg-gradient-to-br from-cyan-400/65 via-white/30 to-pink-500/65 p-[2px] shadow-[0_0_40px_-12px_rgba(34,211,238,0.4),0_0_40px_-12px_rgba(236,72,153,0.28)]">
                <div className="rounded-full overflow-hidden bg-black p-[2px]">
                  <div className="relative overflow-hidden rounded-full w-32 h-32 bg-white/5">
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
                problem repeatedly. His most useful AI workflows lived in private documents and were
                impossible to share properly. He wanted one link, one page, and one click to run.
                When that didn&apos;t exist, he built it. Edgaze is the platform he needed and
                couldn&apos;t find.
              </p>
            </div>
          </section>

          {/* Future Vision */}
          <section className="py-16 md:py-28">
            <AboutSectionTitle>The Future of AI Workflows</AboutSectionTitle>
            <div className="mt-12 space-y-6 max-w-3xl md:mt-14">
              <p className="text-base text-white/70 leading-relaxed">
                The limiting factor for AI adoption isn&apos;t model quality anymore. The models are
                good. The problem is that the best workflows, the ones that actually solve real
                problems, are stuck in private documents, Twitter threads, and Notion pages that
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
                AI will produce a new generation of creators, people who don&apos;t write code or
                make videos, but design workflows. Edgaze is where they publish.
              </p>
            </div>
            <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/marketplace"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-medium tracking-tight text-black shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_16px_40px_-12px_rgba(255,255,255,0.15)] transition-[background-color,transform] hover:bg-white/92 active:scale-[0.99]"
              >
                Explore the marketplace
                <ArrowRight className="h-4 w-4 opacity-55 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/creators/onboarding?from=about"
                className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/18 bg-transparent px-8 py-3.5 text-sm font-medium tracking-tight text-white transition-[border-color,background-color] hover:border-white/30 hover:bg-white/[0.05]"
              >
                Join as a creator
                <ArrowRight className="h-4 w-4 opacity-45 transition-transform group-hover:translate-x-0.5" />
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
