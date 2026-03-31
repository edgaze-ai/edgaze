"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import Footer from "src/components/layout/Footer";

const CALENDLY_URL = "https://calendly.com/arjun-edgaze/edgaze-intro-call";

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (options: { url: string }) => void;
    };
  }
}

const PDF_PATH = "/brand/edgaze-pitch-deck.pdf";

const PitchDeckViewer = dynamic(() => import("src/components/invest/PitchDeckViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[240px] w-full items-center justify-center rounded-[10px] bg-white/[0.04] sm:min-h-[280px]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
    </div>
  ),
});

export default function InvestPage() {
  const [calendlyReady, setCalendlyReady] = useState(false);

  const openCalendly = useCallback(() => {
    if (typeof window === "undefined") return;
    window.Calendly?.initPopupWidget({ url: CALENDLY_URL });
  }, []);

  /* Same pattern as /creators: AppShell’s <main> can stay overflow-hidden on some navigations; force vertical scroll. */
  useEffect(() => {
    const main = document.querySelector("main");
    if (main) {
      main.style.overflowY = "auto";
      main.style.overflowX = "hidden";
      return () => {
        main.style.overflowY = "";
        main.style.overflowX = "";
      };
    }
    return;
  }, []);

  return (
    <div className="isolate min-h-screen w-full overflow-y-auto overflow-x-hidden bg-black text-white [scrollbar-gutter:stable]">
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="afterInteractive"
        onReady={() => setCalendlyReady(true)}
      />
      {/* Solid top band so fixed chrome never shows “layers” behind the pill (mobile-safe). */}
      <header className="fixed inset-x-0 top-0 z-[100] border-b border-white/[0.06] bg-black pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:pb-4">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
          <div className="flex w-full min-w-0 items-center gap-2 rounded-full pl-3.5 pr-1.5 py-1.5 sm:pl-4 sm:pr-2 sm:py-2 md:pl-5 md:pr-[10px] md:py-2.5 bg-white/[0.07] backdrop-blur-2xl border border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_4px_24px_-4px_rgba(0,0,0,0.25),0_12px_40px_-12px_rgba(0,0,0,0.75)]">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 shrink-0 text-white hover:opacity-90 transition-opacity"
              aria-label="Edgaze home"
            >
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-7 w-7 md:h-9 md:w-9" />
              <span className="text-[13px] font-semibold tracking-tight md:text-[15px]">
                Edgaze
              </span>
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
              <Link
                href="/docs"
                className="hidden sm:inline shrink-0 py-2 text-[13px] text-white/75 hover:text-white transition-colors"
              >
                Docs
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-medium text-white sm:px-5 sm:text-[13px] bg-white/10 hover:bg-white/15 border border-white/10 active:scale-[0.98] transition-all duration-200"
              >
                Open marketplace
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-[calc(6rem+env(safe-area-inset-top))] sm:pt-[calc(5rem+env(safe-area-inset-top))] md:pt-[calc(6.5rem+env(safe-area-inset-top))] lg:pt-[calc(7.25rem+env(safe-area-inset-top))]">
        <section
          id="top"
          className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-8 pt-10 sm:pt-8 md:pt-14 lg:pt-16 pb-10 md:pb-14 text-center"
        >
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-white sm:text-4xl md:text-5xl max-w-4xl mx-auto leading-[1.15]">
            The Distribution Layer for AI Workflows
          </h1>
          <p className="mt-3.5 text-sm sm:text-base md:text-lg text-white/65 max-w-2xl mx-auto leading-relaxed">
            A marketplace and execution layer where AI workflows become products
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href="#deck"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-6 py-3 text-sm font-semibold text-black shadow-[0_0_22px_rgba(56,189,248,0.45)] hover:shadow-[0_0_28px_rgba(56,189,248,0.55)] transition-shadow"
            >
              View Deck
            </a>
            <a
              href={PDF_PATH}
              download
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
            >
              Download PDF
            </a>
          </div>
        </section>

        <section
          id="deck"
          className="scroll-mt-[calc(5.5rem+env(safe-area-inset-top))] px-3 sm:px-5 md:px-8"
        >
          <div className="mx-auto w-full max-w-[min(100%,920px)] lg:max-w-[880px] xl:max-w-[900px]">
            <div className="relative rounded-xl sm:rounded-2xl p-[1px] bg-gradient-to-r from-cyan-400/45 via-sky-500/35 to-pink-500/45 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              <div className="overflow-hidden rounded-[10px] sm:rounded-[14px] bg-[#0a0a0a] px-1 py-2 sm:px-2 sm:py-3 ring-1 ring-white/[0.09]">
                <PitchDeckViewer pdfPath={PDF_PATH} />
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Traction"
          className="mt-8 md:mt-10 border-y border-white/[0.06] bg-black py-6 md:py-8"
        >
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-8">
            <ul className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-10 md:gap-16 text-center sm:text-left">
              <li className="text-sm md:text-base text-white/85">
                <span className="bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent font-semibold">
                  15+
                </span>{" "}
                <span className="text-white/70">workflows live</span>
              </li>
              <li className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent sm:self-stretch" />
              <li className="text-sm md:text-base text-white/85">
                <span className="bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent font-semibold">
                  344
                </span>{" "}
                <span className="text-white/70">creator outreach in 4 days</span>
              </li>
              <li className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent sm:self-stretch" />
              <li className="text-sm md:text-base text-white/85">
                <span className="bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent font-semibold">
                  8%
                </span>{" "}
                <span className="text-white/70">reply rate</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[640px] px-4 sm:px-6 md:px-8 py-14 md:py-24 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
            Interested in Edgaze?
          </h2>
          <a
            href="mailto:arjun@edgaze.ai"
            className="mt-6 inline-block text-lg md:text-xl font-semibold text-white hover:text-white/90 underline underline-offset-4 decoration-cyan-400/50 hover:decoration-pink-400/60 transition-colors"
          >
            arjun@edgaze.ai
          </a>
          <div className="mt-8">
            <button
              type="button"
              onClick={openCalendly}
              disabled={!calendlyReady}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              Book a call
            </button>
          </div>
          <p className="mt-12 text-xs md:text-sm text-white/45 max-w-md mx-auto leading-relaxed">
            Backed by early traction and active creator onboarding
          </p>
        </section>

        <footer className="pb-10 md:pb-12">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
            <Footer />
          </div>
        </footer>
      </main>
    </div>
  );
}
