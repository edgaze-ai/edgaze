import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Image,
  PenLine,
  PlayCircle,
  Share2,
  Sparkles,
  Workflow,
} from "lucide-react";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Welcome to Edgaze | Launch Your First Workflow Product",
  description:
    "Start a guided creator launch on Edgaze. Choose a workflow idea, preview the output, publish a product page, and share a live runnable link.",
  path: "/welcome",
});

const launchHref = "/builder?onboarding=1";

const intents = [
  {
    title: "AI Image Style",
    description: "Sell a repeatable visual style with simple buyer inputs.",
    icon: Image,
  },
  {
    title: "Content Workflow",
    description: "Turn writing, research, or strategy prompts into a product.",
    icon: PenLine,
  },
  {
    title: "Custom Prompt",
    description: "Paste what you already use and make it runnable.",
    icon: Sparkles,
  },
];

const steps = [
  {
    title: "Create",
    description: "Paste a prompt or start from a template.",
    icon: Workflow,
  },
  {
    title: "Preview",
    description: "Run the workflow with structured inputs.",
    icon: PlayCircle,
  },
  {
    title: "Publish",
    description: "Set price, product copy, and go live.",
    icon: BadgeDollarSign,
  },
  {
    title: "Share",
    description: "Copy the live runnable product link.",
    icon: Share2,
  },
];

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050506] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),transparent_28%,rgba(236,72,153,0.14)_58%,transparent_78%),radial-gradient(ellipse_at_top,rgba(255,255,255,0.09),transparent_48%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="group inline-flex items-center gap-2 text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-pink-400 shadow-[0_0_22px_rgba(56,189,248,0.75)] transition-transform duration-300 group-hover:scale-125" />
            Edgaze
          </Link>
          <Link
            href="/marketplace"
            className="text-sm font-medium text-white/58 transition-colors duration-200 hover:text-white"
          >
            Marketplace
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 shadow-[0_1px_0_rgba(255,255,255,0.1)_inset]">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              Creator launch
            </div>
            <h1 className="mt-5 max-w-3xl text-[2.65rem] font-semibold leading-[0.96] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Launch your first workflow product.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/64 sm:text-lg sm:leading-8">
              Go from prompt or template to preview, pricing, product page, publish, and share link
              using the same Edgaze workflow system.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={launchHref}
                className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-semibold text-black shadow-[0_24px_80px_-28px_rgba(255,255,255,0.72)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/92 active:translate-y-0 sm:px-7"
              >
                Start guided launch
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/templates"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/14 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/86 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/28 hover:bg-white/[0.08] active:translate-y-0 sm:px-7"
              >
                Browse templates
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm text-white/50">
              <CheckCircle2 className="h-4 w-4 text-cyan-200" />
              Ends with a published runnable workflow link.
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/28 p-3 shadow-[0_30px_100px_-40px_rgba(34,211,238,0.35)] backdrop-blur-xl">
            <div className="rounded-[1.55rem] border border-white/10 bg-white/[0.045] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/38">
                    Choose a path
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">What do you sell?</h2>
                </div>
                <span className="rounded-full bg-gradient-to-r from-cyan-300/18 via-sky-400/18 to-pink-400/18 px-3 py-1 text-xs font-medium text-white/68">
                  5 min launch
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {intents.map((intent) => {
                  const Icon = intent.icon;
                  return (
                    <Link
                      key={intent.title}
                      href={launchHref}
                      className="group rounded-2xl border border-white/10 bg-black/24 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-white/[0.07] hover:shadow-[0_18px_70px_-38px_rgba(34,211,238,0.75)] active:translate-y-0"
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-100 transition-transform duration-300 group-hover:scale-110" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold tracking-tight text-white">
                              {intent.title}
                            </h3>
                            <ArrowRight className="h-4 w-4 shrink-0 text-white/34 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white/80" />
                          </div>
                          <p className="mt-1.5 text-sm leading-6 text-white/55">
                            {intent.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="pb-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <Icon className="h-5 w-5 text-pink-100 transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="mt-4 text-sm font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/50">{step.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-5 border-t border-white/10 bg-[#050506]/82 px-5 py-3 backdrop-blur-xl sm:hidden">
          <Link
            href={launchHref}
            className="group inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-black transition-all duration-300 active:scale-[0.99]"
          >
            Start guided launch
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </main>
  );
}
