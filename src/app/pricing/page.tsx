"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  DollarSign,
  HelpCircle,
  Layers,
  Rocket,
  ShoppingCart,
  Zap,
} from "lucide-react";
import Footer from "src/components/layout/Footer";
import { PayoutSystemCard } from "src/components/publish/PayoutSystemCard";

/* ─────────────────────────────────────────────────────────────────────────
 * DATA
 * ───────────────────────────────────────────────────────────────────────── */

const PLANS = [
  {
    id: "free",
    name: "Edgaze Free",
    priceMonthly: 0,
    priceYearly: 0,
    priceYearlyTotal: 0,
    priceNote: "Always free",
    who: "Creators exploring Edgaze and publishing workflows—sell and earn from day one",
    features: [
      "Browse and run public workflows",
      "Build and publish basic workflows",
      "Sell workflows and receive payouts",
      "Payout dashboard and revenue tracking",
      "Basic creator profile",
      "Community discovery",
      "Hosted runs when buyers purchase your workflows: 10",
      "Basic analytics",
      "Edgaze branding on shared workflows",
      "Standard support",
    ],
    cta: "Start Free",
    ctaHref: "/marketplace",
    ctaSecondary: true,
    popular: false,
  },
  {
    id: "plus",
    name: "Edgaze Plus",
    priceMonthly: 20,
    priceYearly: 16,
    priceYearlyTotal: 192,
    priceNote: "Billed monthly",
    who: "Serious AI creators who want to publish polished workflows and start monetizing",
    features: [
      "Everything in Free",
      "Hosted runs when buyers purchase your workflows: 15",
      "Advanced workflow builder features",
      "Workflow versioning",
      "Usage logs and execution history",
      "Workflow cloning permissions",
      "Private workflows",
      "Fork and remix controls",
      "Sell paywalled workflows",
      "Basic revenue analytics",
      "Custom workflow thumbnails and branding",
      "Priority support",
      "Early access to premium creator tools",
    ],
    cta: "Upgrade to Plus",
    ctaHref: "/welcome",
    ctaSecondary: false,
    popular: true,
  },
];

const WORKFLOW_STEPS = [
  {
    icon: ShoppingCart,
    headline: "Users purchase a workflow created by a creator",
    explanation:
      "When someone purchases a paid workflow on Edgaze, they immediately gain access to run that workflow. Workflows are not static prompts. They are executable systems built by creators using the Edgaze workflow builder. Each workflow purchase includes a bundle of hosted runs so the user can start using it immediately without configuring any infrastructure.",
  },
  {
    icon: Layers,
    headline: "10 or 15 hosted runs included with every purchase",
    explanation:
      "Every workflow purchase includes hosted runs: 10 on Free, 15 on Plus. A hosted run means the workflow executes on Edgaze infrastructure. The user does not need to connect APIs or manage hosting. Buyers can start using the workflow with zero setup. Runs are consumed each time the workflow executes.",
  },
  {
    icon: Zap,
    headline: "Flexible options to continue running workflows",
    explanation:
      "After the included hosted runs are used, users can continue in three ways: (1) Purchase additional hosted runs through Edgaze, keeping everything fully managed. (2) Bring Your Own Keys (BYOK)—connect your own API keys so the workflow runs on your infrastructure. (3) Usage-based billing for automatic charges as the workflow continues to execute. Beginners start instantly; advanced users keep full control.",
  },
  {
    icon: DollarSign,
    headline: "Creators monetize their workflows",
    explanation:
      "Creators sell workflows directly through the Edgaze marketplace. When a workflow is purchased, the creator receives the majority of the revenue. Edgaze takes a 20% marketplace fee on each transaction to cover platform infrastructure, distribution, hosting, and payment processing. Early creators may qualify for reduced fees as part of the early creator program.",
  },
];

const MONETIZATION_CARDS = [
  {
    label: "Build",
    desc: "Build multi-step AI workflows with models, APIs, and logic blocks in the Edgaze visual canvas.",
  },
  { label: "Publish", desc: "Share your workflow with one link. Users run it instantly." },
  { label: "Monetize", desc: "Set a price. Edgaze handles payments. You keep 80%." },
  { label: "Scale", desc: "Reach more users through the marketplace and distribution." },
];

const WHY_CARDS = [
  {
    title: "Built for AI creators, not generic no-code users",
    desc: "Edgaze understands workflows, prompts, and AI. The platform is designed for the kind of tools you actually build.",
  },
  {
    title: "Distribution plus monetization in one platform",
    desc: "Publish, get discovered, and earn. No need to stitch together separate tools.",
  },
  {
    title: "Turn workflows into products, not screenshots",
    desc: "Every workflow gets a runnable product page. Share one link and users can run it immediately.",
  },
  {
    title: "Start free, scale when traction appears",
    desc: "Sell workflows and earn on the Free plan. Upgrade to Plus when you need advanced tools and more hosted runs per purchase.",
  },
  {
    title: "Designed for remix culture and discoverability",
    desc: "Your workflows can be forked and remixed. Discovery is built into the platform.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Do buyers need API keys to run workflows?",
    a: "No. Hosted runs allow workflows to run instantly without configuration. Buyers can run your workflow immediately after purchase with zero setup.",
  },
  {
    q: "What happens after hosted runs are used?",
    a: "Buyers can purchase additional hosted runs through Edgaze, connect their own API keys (BYOK), or enable usage-based billing for automatic charges as the workflow runs.",
  },
  {
    q: "When do creators get paid?",
    a: "Payouts are handled through Stripe Connect and sent to creators according to payout schedules. Automatic weekly payouts with a minimum threshold.",
  },
  {
    q: "Can I start for free?",
    a: "Yes. Edgaze Free lets you browse, build, publish, and sell workflows at no cost. Upgrade to Plus when you want advanced tools and more hosted runs per purchase.",
  },
  {
    q: "Does Edgaze take a fee on sales?",
    a: "Yes. Edgaze takes a 20% marketplace fee on each paid workflow sale. Creators keep 80%. Early creators may qualify for reduced fees.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plus is billed monthly. Cancel anytime and you'll retain access until the end of your billing period.",
  },
  {
    q: "What counts as a hosted run?",
    a: "A hosted run is when the workflow executes on Edgaze infrastructure. Each time someone runs your workflow and it executes on our servers, one run is consumed.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. The workflow builder is visual. You connect inputs, prompts, tools, and outputs. No coding required.",
  },
  {
    q: "Can teams use Edgaze?",
    a: "Teams and collaboration features are on the roadmap. For now, Edgaze focuses on individual creators.",
  },
  {
    q: "Will plan limits change over time?",
    a: "Limits may be adjusted as we grow. We'll communicate changes in advance. Existing subscribers are typically grandfathered.",
  },
  {
    q: "Can I migrate between plans later?",
    a: "Yes. You can upgrade from Free to Plus at any time. Downgrade options will be available as we mature the platform.",
  },
];

const COMPARISON_ROWS = [
  { feature: "Browse public workflows", free: true, plus: true },
  { feature: "Build workflows", free: true, plus: true },
  { feature: "Publish workflows", free: true, plus: true },
  { feature: "Hosted runs when buyers purchase your workflows", free: "10", plus: "15" },
  { feature: "Marketplace fee", free: "20%", plus: "20% (early creator discounts possible)" },
  { feature: "Advanced builder blocks", free: false, plus: true },
  { feature: "Workflow versioning", free: false, plus: true },
  { feature: "Usage logs and execution history", free: false, plus: true },
  { feature: "Workflow cloning permissions", free: false, plus: true },
  { feature: "Private workflows", free: false, plus: true },
  { feature: "Fork and remix controls", free: false, plus: true },
  { feature: "Marketplace discovery", free: true, plus: true },
  { feature: "Sell workflows and receive payouts", free: true, plus: true },
  { feature: "Revenue analytics", free: "Basic", plus: true },
  { feature: "Custom branding", free: false, plus: true },
  { feature: "Priority support", free: false, plus: true },
];

/* ─────────────────────────────────────────────────────────────────────────
 * COMPONENTS
 * ───────────────────────────────────────────────────────────────────────── */

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

function SectionReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : reduce ? undefined : { opacity: 0, y: 24 }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export default function PricingPage() {
  const [billingYearly, setBillingYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen w-full bg-[#07080b] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#07080b]" />
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.14),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.11),transparent_46%),radial-gradient(circle_at_55%_90%,rgba(34,211,238,0.06),transparent_52%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:92px_92px]" />
        {!reduce && (
          <>
            <motion.div
              className="absolute left-[15%] top-[15%] h-80 w-80 rounded-full opacity-20 blur-[100px]"
              style={{
                background: "radial-gradient(circle, rgba(34,211,238,0.5) 0%, transparent 70%)",
              }}
              animate={{ x: [0, 25, 0], y: [0, -15, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[20%] top-[30%] h-72 w-72 rounded-full opacity-18 blur-[90px]"
              style={{
                background: "radial-gradient(circle, rgba(236,72,153,0.5) 0%, transparent 70%)",
              }}
              animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}
      </div>

      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 pt-4 md:pt-5">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
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
                href="/marketplace"
                className="text-[13px] text-white/70 hover:text-white transition-colors"
              >
                Marketplace
              </Link>
              <Link
                href="/docs"
                className="text-[13px] text-white/70 hover:text-white transition-colors"
              >
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
          <section className="py-16 md:py-24 text-center">
            <motion.h1
              className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            >
              Pricing for AI creators building real products
            </motion.h1>
            <motion.p
              className="mt-5 text-lg text-white/70 md:text-xl max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
            >
              Start free to explore and build. Upgrade when your workflows get traction and you want
              stronger monetization tools.
            </motion.p>

            {/* Billing toggle */}
            <motion.div
              className="mt-10 flex items-center justify-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <span className={cn("text-sm", !billingYearly ? "text-white" : "text-white/55")}>
                Monthly
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={billingYearly}
                onClick={() => setBillingYearly(!billingYearly)}
                className="relative h-7 w-12 rounded-full bg-white/10 ring-1 ring-white/15 transition-colors"
              >
                <motion.span
                  className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm"
                  animate={{ x: billingYearly ? 20 : 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </button>
              <span className="flex items-center gap-2">
                <span className={cn("text-sm", billingYearly ? "text-white" : "text-white/55")}>
                  Yearly
                </span>
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-300">
                  Save up to 20%
                </span>
              </span>
            </motion.div>

            {/* Trust microcopy */}
            <motion.div
              className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-white/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.18 }}
            >
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-cyan-400/70" />
                No setup friction
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-cyan-400/70" />
                Start free
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-cyan-400/70" />
                Upgrade when your workflows get traction
              </span>
            </motion.div>

            {/* Hero CTAs */}
            <motion.div
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Link
                href="/marketplace"
                className="group relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
              >
                <span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]" />
                <span className="absolute inset-[1px] rounded-full bg-[#0b0c11]" />
                <span className="relative flex items-center gap-2">
                  Start Free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors"
              >
                Explore Marketplace
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white/70 ring-1 ring-white/10 hover:bg-white/5 hover:text-white/90 transition-colors"
              >
                Book Demo
              </Link>
            </motion.div>
          </section>

          {/* Pricing cards */}
          <section className="py-16 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
              {PLANS.map((plan, i) => {
                const price = billingYearly ? plan.priceYearly : plan.priceMonthly;
                const priceNote =
                  plan.priceMonthly === 0
                    ? "Always free"
                    : billingYearly && plan.priceYearlyTotal > 0
                      ? `Billed $${plan.priceYearlyTotal}/year`
                      : plan.priceNote;
                const isPlus = plan.id === "plus";
                return (
                  <SectionReveal key={plan.id} delay={i * 0.06}>
                    <motion.div
                      className={cn(
                        "relative rounded-3xl p-8 h-full flex flex-col",
                        isPlus
                          ? "bg-white/[0.02] ring-1 ring-white/[0.06] opacity-70"
                          : "bg-white/[0.03] ring-1 ring-white/8 backdrop-blur-xl",
                        isPlus && "cursor-not-allowed",
                      )}
                      whileHover={
                        !isPlus ? { scale: 1.01, transition: { duration: 0.2 } } : undefined
                      }
                      transition={{ duration: 0.2 }}
                    >
                      <h3
                        className={cn(
                          "text-xl font-semibold",
                          isPlus ? "text-white/55" : "text-white",
                        )}
                      >
                        {plan.name}
                      </h3>
                      <p className={cn("mt-2 text-sm", isPlus ? "text-white/45" : "text-white/60")}>
                        {plan.who}
                      </p>
                      <div className="mt-6 flex items-baseline gap-1">
                        <span
                          className={cn(
                            "text-4xl font-semibold tracking-tight",
                            isPlus ? "text-white/50" : "text-white",
                          )}
                        >
                          ${price}
                        </span>
                        <span className={isPlus ? "text-white/40" : "text-white/50"}>/month</span>
                        {billingYearly && plan.priceYearlyTotal > 0 && (
                          <span
                            className={cn(
                              "ml-2 text-sm",
                              isPlus ? "text-white/40" : "text-white/45",
                            )}
                          >
                            (${plan.priceYearlyTotal}/yr)
                          </span>
                        )}
                      </div>
                      <p className={cn("mt-1 text-xs", isPlus ? "text-white/40" : "text-white/45")}>
                        {priceNote}
                      </p>
                      <ul className="mt-8 space-y-3 flex-1">
                        {plan.features.map((f) => (
                          <li
                            key={f}
                            className={cn(
                              "flex items-start gap-3 text-sm",
                              isPlus ? "text-white/50" : "text-white/75",
                            )}
                          >
                            <Check
                              className={cn(
                                "h-5 w-5 shrink-0",
                                isPlus ? "text-white/40" : "text-cyan-400/90",
                              )}
                            />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      {isPlus ? (
                        <span className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold bg-white/[0.04] ring-1 ring-white/[0.08] text-white/50 cursor-not-allowed">
                          Coming soon
                        </span>
                      ) : (
                        <Link
                          href={plan.ctaHref}
                          className={cn(
                            "mt-8 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all",
                            plan.ctaSecondary
                              ? "bg-white/8 ring-1 ring-white/10 text-white hover:bg-white/12"
                              : "text-white bg-[linear-gradient(135deg,rgba(34,211,238,0.9),rgba(236,72,153,0.85)] hover:opacity-95",
                          )}
                        >
                          {plan.cta}
                          {!plan.ctaSecondary && <ArrowRight className="h-4 w-4" />}
                        </Link>
                      )}
                    </motion.div>
                  </SectionReveal>
                );
              })}
            </div>
          </section>

          {/* Creator economics example */}
          <section className="py-16 md:py-24">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl text-center">
                Example earnings
              </h2>
              <p className="mt-4 text-center text-white/65 max-w-2xl mx-auto">
                How much creators earn when they sell workflows on Edgaze.
              </p>
            </SectionReveal>
            <SectionReveal delay={0.06}>
              <div className="mt-12 max-w-2xl mx-auto rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl overflow-hidden">
                <div className="p-8 sm:p-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                    <div className="rounded-xl bg-white/[0.04] ring-1 ring-white/8 p-5">
                      <p className="text-xs font-medium tracking-wider text-white/50 uppercase">
                        Workflow price
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-white">$10</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-pink-500/10 ring-1 ring-cyan-400/20 p-5">
                      <p className="text-xs font-medium tracking-wider text-cyan-400/80 uppercase">
                        Creator earnings per sale
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-cyan-300">$8</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="rounded-xl bg-white/[0.04] ring-1 ring-white/8 p-5 flex items-center justify-between">
                      <p className="text-sm text-white/70">100 sales</p>
                      <p className="text-2xl font-semibold text-white">$800</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] ring-1 ring-white/8 p-5 flex items-center justify-between">
                      <p className="text-sm text-white/70">1,000 sales</p>
                      <p className="text-2xl font-semibold text-white">$8,000</p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionReveal>
          </section>

          {/* How workflow purchases and usage work */}
          <section className="py-16 md:py-24">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl text-center">
                How workflow purchases and usage work
              </h2>
              <p className="mt-4 text-center text-white/65 max-w-2xl mx-auto">
                Every workflow purchase includes hosted runs so users can start instantly.
              </p>
            </SectionReveal>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {WORKFLOW_STEPS.map((step, i) => (
                <SectionReveal key={i} delay={i * 0.06}>
                  <motion.div
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-6 h-full flex flex-col"
                    whileHover={{
                      borderColor: "rgba(255,255,255,0.12)",
                      boxShadow: "0 0 0 1px rgba(34,211,238,0.08)",
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-white/10">
                      <step.icon className="h-5 w-5 text-white/85" />
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-white">{step.headline}</h3>
                    <p className="mt-3 text-sm text-white/65 leading-relaxed flex-1">
                      {step.explanation}
                    </p>
                  </motion.div>
                </SectionReveal>
              ))}
            </div>

            {/* Plus benefit card */}
            <SectionReveal delay={0.2}>
              <motion.div
                className="mt-10 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 backdrop-blur-xl p-6 sm:p-8"
                whileHover={{
                  borderColor: "rgba(34,211,238,0.35)",
                  boxShadow: "0 0 0 1px rgba(34,211,238,0.15)",
                }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/20">
                    <Rocket className="h-6 w-6 text-cyan-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Plus creators get additional hosted runs
                    </h3>
                    <p className="mt-2 text-sm text-white/70 leading-relaxed">
                      Creators on the Plus plan receive 15 hosted runs included with every workflow
                      purchase made after upgrading. This increases the value delivered to buyers
                      and helps creators improve conversion rates.
                    </p>
                  </div>
                </div>
              </motion.div>
            </SectionReveal>

            <p className="mt-6 text-xs text-white/45 text-center">
              Hosted run limits and monetization tools may vary depending on the creator&apos;s
              plan.
            </p>
          </section>

          {/* Monetization explainer */}
          <section className="py-16 md:py-24">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl text-center">
                Built to help creators earn, not just build
              </h2>
              <p className="mt-4 text-center text-white/65 max-w-2xl mx-auto">
                Free creators can already sell workflows, receive payouts, access the payout
                dashboard, and earn revenue. Plus adds advanced tools and more hosted runs per
                purchase.
              </p>
            </SectionReveal>
            <SectionReveal delay={0.04}>
              <div className="mt-12 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] overflow-hidden">
                <div className="relative -m-2 sm:-m-4 p-2 sm:p-4">
                  <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(ellipse_at_30%_0%,rgba(34,211,238,0.08),transparent_50%),radial-gradient(ellipse_at_70%_100%,rgba(236,72,153,0.06),transparent_50%)]" />
                  <div className="relative space-y-4">
                    <PayoutSystemCard variant="workflow" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {MONETIZATION_CARDS.map((card, i) => (
                        <motion.div
                          key={card.label}
                          className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-6 min-h-[180px]"
                          whileHover={{
                            borderColor: "rgba(255,255,255,0.12)",
                            boxShadow: "0 0 0 1px rgba(34,211,238,0.06)",
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="text-xs font-semibold tracking-widest text-cyan-400/90 uppercase">
                            {card.label}
                          </div>
                          <p className="mt-4 text-sm text-white/65 leading-relaxed flex-1">
                            {card.desc}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </SectionReveal>
          </section>

          {/* Feature comparison */}
          <section className="py-16 md:py-24">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl text-center">
                Compare plans
              </h2>
            </SectionReveal>
            <SectionReveal delay={0.06}>
              <div className="mt-12 overflow-x-auto">
                <div className="min-w-[520px] rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-5 py-4 text-sm font-semibold text-white/90">Feature</th>
                        <th className="px-5 py-4 text-sm font-semibold text-white/90 text-center">
                          Free
                        </th>
                        <th className="px-5 py-4 text-sm font-semibold text-cyan-300 text-center">
                          Plus
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_ROWS.map((row) => (
                        <tr
                          key={row.feature}
                          className="border-b border-white/[0.05] last:border-0"
                        >
                          <td className="px-5 py-4 text-sm text-white/80">{row.feature}</td>
                          <td className="px-5 py-4 text-center">
                            {row.free === true ? (
                              <Check className="inline h-5 w-5 text-cyan-400" />
                            ) : row.free === false ? (
                              <span className="text-white/30">—</span>
                            ) : (
                              <span className="text-sm text-white/60">{row.free}</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {row.plus === true ? (
                              <Check className="inline h-5 w-5 text-cyan-400" />
                            ) : row.plus === false ? (
                              <span className="text-white/30">—</span>
                            ) : (
                              <span className="text-sm text-cyan-300/90">{row.plus}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionReveal>
          </section>

          {/* Why creators choose Edgaze */}
          <section className="py-16 md:py-24">
            <SectionReveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl text-center">
                Why creators choose Edgaze
              </h2>
            </SectionReveal>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {WHY_CARDS.map((card, i) => (
                <SectionReveal key={card.title} delay={i * 0.05}>
                  <motion.div
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-6 h-full"
                    whileHover={{ borderColor: "rgba(255,255,255,0.12)", scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-base font-semibold text-white">{card.title}</h3>
                    <p className="mt-2 text-sm text-white/65 leading-relaxed">{card.desc}</p>
                  </motion.div>
                </SectionReveal>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="py-16 md:py-24">
            <SectionReveal>
              <div className="flex items-center gap-2 justify-center">
                <HelpCircle className="h-6 w-6 text-white/60" />
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                  Frequently asked questions
                </h2>
              </div>
            </SectionReveal>
            <div className="mt-12 max-w-2xl mx-auto space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <SectionReveal key={i} delay={i * 0.03}>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white hover:bg-white/[0.04] transition-colors"
                    >
                      {item.q}
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 shrink-0 text-white/50 transition-transform",
                          openFaq === i && "rotate-180",
                        )}
                      />
                    </button>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 pt-0 text-sm text-white/65 leading-relaxed">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </div>
                </SectionReveal>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="py-20 md:py-28">
            <SectionReveal>
              <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] p-12 md:p-16 text-center">
                <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.08),transparent_55%)]" />
                <div className="relative">
                  <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                    Start building on Edgaze for free
                  </h2>
                  <p className="mt-5 text-lg text-white/70 max-w-xl mx-auto">
                    Launch your first workflow, test demand, and upgrade when you&apos;re ready to
                    scale distribution and monetization.
                  </p>
                  <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="/marketplace"
                      className="group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white bg-[linear-gradient(135deg,rgba(34,211,238,0.9),rgba(236,72,153,0.85)] hover:opacity-95 transition-opacity"
                    >
                      Get Started Free
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors"
                    >
                      Contact Sales
                    </Link>
                  </div>
                </div>
              </div>
            </SectionReveal>
          </section>

          <footer className="pt-16">
            <Footer />
          </footer>
        </div>
      </main>
    </div>
  );
}
