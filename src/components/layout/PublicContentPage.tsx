"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import { LandingNav } from "../landing-nav";
import type {
  PublicPageSection,
  PublicPageVisual,
  PublicSitePage,
} from "../../lib/public-site-pages";
import { buildBreadcrumbJsonLd } from "../../lib/seo";
import Footer from "./Footer";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function VisualFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[260px] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,11,13,0.98),rgba(5,6,8,1))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)] sm:h-[300px]">
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:88px_88px]" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function HeroVisual({ page }: { page: PublicSitePage }) {
  return (
    <VisualFrame>
      <div className="grid h-full grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="flex flex-col justify-between rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
              Platform view
            </div>
            <div className="mt-4 space-y-3">
              {page.heroHighlights.map((item) => (
                <div
                  key={item}
                  className="border-l border-cyan-300/30 pl-4 text-sm leading-6 text-white/74"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-5 text-xs text-white/42">{page.eyebrow}</div>
        </div>

        <div className="flex flex-col gap-4">
          {page.heroStats.map((stat) => (
            <div
              key={stat.label}
              className="flex-1 rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/36">
                {stat.label}
              </div>
              <div className="mt-5 text-sm font-medium leading-6 text-white/86">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </VisualFrame>
  );
}

function SequenceVisual() {
  return (
    <VisualFrame>
      <div className="flex h-full flex-col justify-between">
        {["Build", "Publish", "Discover", "Run"].map((item, index) => (
          <div key={item} className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-sm text-white/72">
              0{index + 1}
            </div>
            <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(34,211,238,0.28),rgba(255,255,255,0.06))]" />
            <div className="w-[36%] text-right text-sm text-white/78">{item}</div>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function SignalsVisual() {
  return (
    <VisualFrame>
      <div className="flex h-full items-end gap-4">
        {[44, 76, 58, 98, 72].map((height, index) => (
          <div key={height} className="flex flex-1 flex-col justify-end gap-3">
            <div
              className={cn(
                "rounded-t-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))]",
                index === 3 && "border-cyan-300/20 bg-cyan-400/10",
              )}
              style={{ height }}
            />
            <div className="h-1 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function StackVisual() {
  return (
    <VisualFrame>
      <div className="flex h-full flex-col justify-center gap-4">
        {[
          { label: "Inputs", active: false },
          { label: "Logic", active: true },
          { label: "Tools", active: false },
          { label: "Outputs", active: false },
        ].map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-[24px] border px-5 py-4 text-sm",
              item.active
                ? "border-cyan-300/20 bg-cyan-400/10 text-white"
                : "border-white/10 bg-white/[0.03] text-white/74",
            )}
          >
            {item.label}
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function ComparisonVisual() {
  return (
    <VisualFrame>
      <div className="grid h-full grid-cols-2 gap-4">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">Prompt</div>
          <div className="mt-6 space-y-4 text-sm text-white/64">
            <div>Single instruction</div>
            <div>Less context</div>
            <div>Harder to package</div>
          </div>
        </div>
        <div className="rounded-[26px] border border-cyan-300/18 bg-cyan-400/10 p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Workflow</div>
          <div className="mt-6 space-y-4 text-sm text-white/86">
            <div>Multi step system</div>
            <div>More context</div>
            <div>Easier to publish</div>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

function GridVisual() {
  return (
    <VisualFrame>
      <div className="grid h-full grid-cols-2 gap-4">
        {["Use case", "Audience", "Value", "Outcome"].map((item) => (
          <div key={item} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">{item}</div>
            <div className="mt-8 space-y-3">
              <div className="h-2 rounded-full bg-white/10" />
              <div className="h-2 w-4/5 rounded-full bg-white/10" />
              <div className="h-2 w-3/5 rounded-full bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function OrbitVisual() {
  return (
    <VisualFrame>
      <div className="flex h-full items-center justify-center">
        <div className="relative h-52 w-52 rounded-full border border-white/10">
          <div className="absolute inset-[22%] rounded-full border border-cyan-300/16" />
          <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-white/86">
            Edgaze
          </div>
          {[
            { label: "Docs", cls: "left-[38%] top-0" },
            { label: "Creators", cls: "right-0 top-[36%]" },
            { label: "Templates", cls: "left-[30%] bottom-0" },
            { label: "Marketplace", cls: "left-0 top-[36%]" },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "absolute rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/74",
                item.cls,
              )}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </VisualFrame>
  );
}

function BridgeVisual() {
  return (
    <VisualFrame>
      <div className="relative flex h-full items-center justify-between gap-8">
        <div className="w-[40%] rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Creators</div>
          <div className="mt-8 space-y-3">
            <div className="h-2 rounded-full bg-white/10" />
            <div className="h-2 w-4/5 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="absolute left-1/2 top-1/2 h-px w-[28%] -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(90deg,rgba(255,255,255,0.06),rgba(34,211,238,0.38),rgba(255,255,255,0.06))]" />
        <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/18 bg-cyan-400/10 text-cyan-100">
          <ArrowRight className="h-4 w-4" />
        </div>
        <div className="w-[40%] rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Buyers</div>
          <div className="mt-8 space-y-3">
            <div className="h-2 rounded-full bg-white/10" />
            <div className="h-2 w-4/5 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

function ConstellationVisual() {
  return (
    <VisualFrame>
      <div className="flex h-full items-center justify-center">
        <div className="relative h-48 w-48">
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/18 bg-cyan-400/10" />
          {["left-[42%] top-0", "right-0 top-[34%]", "left-[42%] bottom-0", "left-0 top-[34%]"].map(
            (cls, index) => (
              <div
                key={index}
                className={cn(
                  "absolute h-14 w-14 rounded-full border border-white/10 bg-white/[0.03]",
                  cls,
                )}
              />
            ),
          )}
          <div className="absolute left-[48%] top-[12%] h-[28%] w-px bg-white/10" />
          <div className="absolute left-[72%] top-[48%] h-px w-[20%] bg-white/10" />
          <div className="absolute left-[48%] bottom-[12%] h-[28%] w-px bg-white/10" />
          <div className="absolute left-[8%] top-[48%] h-px w-[20%] bg-white/10" />
        </div>
      </div>
    </VisualFrame>
  );
}

function SectionVisual({ visual }: { visual: PublicPageVisual }) {
  switch (visual) {
    case "sequence":
      return <SequenceVisual />;
    case "signals":
      return <SignalsVisual />;
    case "stack":
      return <StackVisual />;
    case "comparison":
      return <ComparisonVisual />;
    case "grid":
      return <GridVisual />;
    case "orbit":
      return <OrbitVisual />;
    case "bridge":
      return <BridgeVisual />;
    default:
      return <ConstellationVisual />;
  }
}

function ContentSection({ section, index }: { section: PublicPageSection; index: number }) {
  const reverse = index % 2 === 1;

  return (
    <section className="px-5 py-10 md:px-8 md:py-16 lg:py-20">
      <div
        className={cn(
          "mx-auto grid max-w-[1360px] items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.8fr)] lg:gap-16",
          reverse && "lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,0.95fr)]",
        )}
      >
        <Reveal className={cn("min-w-0", reverse && "lg:order-2")}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/42">
            {section.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.03em] text-white md:text-[2.3rem] md:leading-[1.08]">
            {section.title}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/64">{section.body}</p>
          <ul className="mt-8 space-y-3">
            {section.bullets.map((bullet) => (
              <li
                key={bullet}
                className="border-l border-white/12 pl-4 text-sm leading-7 text-white/72"
              >
                {bullet}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.06} className={cn("min-w-0", reverse && "lg:order-1")}>
          <SectionVisual visual={section.visual} />
        </Reveal>
      </div>
    </section>
  );
}

export default function PublicContentPage({ page }: { page: PublicSitePage }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [onTop, setOnTop] = useState(true);

  useEffect(() => {
    const onScroll = () => setOnTop(window.scrollY < 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const timeout = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const top = window.scrollY + el.getBoundingClientRect().top - 96;
      window.scrollTo({ top, behavior: "smooth" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const breadcrumbJsonLd = useMemo(
    () =>
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: page.h1, path: page.path },
      ]),
    [page.h1, page.path],
  );

  return (
    <div
      id="top"
      ref={scrollRef}
      className="min-h-screen w-full overflow-x-hidden bg-black text-white font-dm-sans"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#040507]" />
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.15),transparent_38%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.12),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(255,255,255,0.04),transparent_52%)]" />
      </div>

      <LandingNav onTop={onTop} scrollerRef={scrollRef} />

      <main className="pt-[calc(6.5rem+env(safe-area-inset-top))] md:pt-36">
        <section className="px-5 pb-12 pt-10 md:px-8 md:pb-20 md:pt-14">
          <div className="mx-auto grid max-w-[1360px] items-start gap-12 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-16">
            <Reveal className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/42">
                {page.eyebrow}
              </p>
              <h1 className="mt-5 max-w-5xl text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl md:text-6xl md:leading-[1.02]">
                {page.h1}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/66 sm:text-lg">
                {page.intro}
              </p>

              <div className="mt-8">
                <Link
                  href={page.heroCta.href}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/92"
                >
                  {page.heroCta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="min-w-0">
              <HeroVisual page={page} />
            </Reveal>
          </div>
        </section>

        {page.sections.map((section, index) => (
          <ContentSection key={`${page.path}-${section.title}`} section={section} index={index} />
        ))}

        <section className="px-5 py-14 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1360px] border-t border-white/10 pt-10 md:pt-14">
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/42">
                Continue exploring
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white">
                Follow the strongest next paths on Edgaze
              </h2>
            </Reveal>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {page.relatedLinks.map((link, index) => (
                <Reveal key={link.href} delay={0.05 * index}>
                  <Link
                    href={link.href}
                    className="group block rounded-[28px] border border-white/10 bg-white/[0.03] p-5 transition-colors duration-200 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                        <Compass className="h-4 w-4 text-white/78" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/35 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/75" />
                    </div>
                    <div className="mt-4 text-lg font-semibold text-white">{link.label}</div>
                    <p className="mt-2 text-sm leading-6 text-white/60">{link.description}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 pb-10 md:px-8">
        <div className="mx-auto max-w-[1360px]">
          <Footer />
        </div>
      </footer>
    </div>
  );
}
