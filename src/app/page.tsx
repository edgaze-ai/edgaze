"use client";

import React, {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  FileText,
  Hand,
  LayoutList,
  MousePointer2,
  Play,
  ScrollText,
} from "lucide-react";
import { useAuth } from "src/components/auth/AuthContext";
import TrendingThisWeekSection from "src/components/home/TrendingThisWeekSection";
import { LandingNav } from "src/components/landing-nav";
import Footer from "src/components/layout/Footer";
import EdgazeCodeInfoPopover from "src/components/ui/EdgazeCodeInfoPopover";
import ProfileLink from "src/components/ui/ProfileLink";
import { getSiteOrigin } from "src/lib/site-origin";
import { createSupabaseBrowserClient } from "src/lib/supabase/browser";
import type { CanvasRef } from "src/components/builder/ReactFlowCanvas";
import { extractWorkflowInputs } from "src/lib/workflow/input-extraction";
import { toRuntimeGraph } from "src/lib/workflow/customer-runtime";
import { handleWorkflowRunStream } from "src/lib/workflow/run-stream-client";
import { finalizeClientWorkflowRunFromExecutionResult } from "src/lib/workflow/finalize-client-run-result";
import { getDeviceFingerprintHash } from "src/lib/workflow/device-tracking";
import type { WorkflowRunState } from "src/lib/workflow/run-types";

const TurnstileWidget = dynamic(() => import("src/components/apply/TurnstileWidget"), {
  ssr: false,
});

const ReactFlowCanvas = dynamic(() => import("src/components/builder/ReactFlowCanvas"), {
  ssr: false,
});

const CustomerWorkflowRunModal = dynamic(
  () => import("src/components/runtime/customer/CustomerWorkflowRunModal"),
  { ssr: false },
);

const CustomerWorkflowRuntimeSurface = dynamic(
  () => import("src/components/runtime/customer/CustomerWorkflowRuntimeSurface"),
  { ssr: false },
);

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type ScrollCtx = {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
};

const ScrollContext = createContext<ScrollCtx | null>(null);

function useScrollCtx() {
  const ctx = useContext(ScrollContext);
  if (!ctx) throw new Error("ScrollContext missing");
  return ctx;
}

function Gradients() {
  return (
    <>
      <div className="absolute inset-0 -z-10 bg-[#07080b]" />
      <div className="absolute inset-0 -z-10 opacity-[0.52] [background-image:radial-gradient(circle_at_16%_10%,rgba(17,82,92,0.72),transparent_30%),radial-gradient(circle_at_84%_10%,rgba(82,32,58,0.64),transparent_34%),radial-gradient(circle_at_20%_58%,rgba(10,58,68,0.32),transparent_34%),radial-gradient(circle_at_82%_66%,rgba(50,22,41,0.26),transparent_38%)]" />
      <div className="absolute inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:92px_92px]" />
      <div className="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_55%)]" />
      <div className="absolute inset-0 -z-10 [background-image:linear-gradient(180deg,rgba(4,5,8,0.94)_0%,rgba(6,8,12,0.86)_22%,rgba(7,8,11,0.72)_56%,rgba(7,8,11,0.92)_100%)]" />
    </>
  );
}

function Container({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full", wide ? "max-w-[1400px]" : "max-w-7xl", className)}>
      {children}
    </div>
  );
}

function useSmoothAnchorScroll(offsetPx?: number) {
  const { scrollerRef } = useScrollCtx();
  const offset = typeof offsetPx === "number" ? offsetPx : 92;

  function onAnchorClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const a = e.currentTarget;
    const href = a.getAttribute("href") || "";
    if (!href.startsWith("#")) return;

    const id = href.slice(1);
    const el = document.getElementById(id);
    const scroller = scrollerRef.current;
    if (!el) return;

    e.preventDefault();

    if (!scroller) {
      const top = window.scrollY + el.getBoundingClientRect().top - offset;
      window.history.pushState(null, "", href);
      window.scrollTo({ top, behavior: "smooth" });
      return;
    }

    const scrollerTop = scroller.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    const top = elTop - scrollerTop + scroller.scrollTop - offset;

    window.history.pushState(null, "", href);
    scroller.scrollTo({ top, behavior: "smooth" });
  }

  return { onAnchorClick };
}

function SmoothLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { onAnchorClick } = useSmoothAnchorScroll(92);
  const isHash = href.startsWith("#");
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isHash) onAnchorClick(e);
    onClick?.();
  };

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}

function PrimaryButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <SmoothLink
      href={href}
      className="group relative inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
    >
      <motion.span
        className="absolute inset-0 rounded-full p-[1px] bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]"
        whileHover={{ scale: 1.015 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      />
      <motion.span
        className="absolute inset-[1px] rounded-full bg-[#0b0c11]"
        whileHover={{
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 24px rgba(34,211,238,0.12)",
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      />
      <motion.span
        className="relative inline-flex items-center gap-2"
        whileHover={{ y: -1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
        <ArrowRight className="h-4 w-4 opacity-90 transition-transform duration-300 group-hover:translate-x-0.5" />
      </motion.span>
    </SmoothLink>
  );
}

function SecondaryButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <SmoothLink
      href={href}
      className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/8 transition-colors"
    >
      {children}
    </SmoothLink>
  );
}

function RotatingText({
  phrases,
  intervalMs = 2600,
  transitionMs = 280,
  className,
}: {
  phrases: readonly string[];
  intervalMs?: number;
  transitionMs?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  const widestPhrase = useMemo(() => {
    return phrases.reduce(
      (widest, phrase) => (phrase.length > widest.length ? phrase : widest),
      "",
    );
  }, [phrases]);

  useEffect(() => {
    if (prefersReducedMotion || phrases.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setIsTransitionEnabled(true);
      setDisplayIndex((prev) => prev + 1);
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [intervalMs, phrases.length, prefersReducedMotion]);

  if (!phrases.length) return null;

  const stackedPhrases = [...phrases, phrases[0]];
  const activeIndex = displayIndex % phrases.length;

  return (
    <span
      className={cn("relative inline-grid overflow-hidden whitespace-nowrap align-top", className)}
      style={{
        height: "1.08em",
        lineHeight: 1.08,
      }}
      aria-live="off"
      aria-atomic="true"
    >
      <span className="invisible block">{widestPhrase}</span>
      <span
        className="pointer-events-none absolute inset-0 flex flex-col will-change-transform"
        style={{
          transform: `translate3d(0, -${displayIndex * 100}%, 0)`,
          transition: prefersReducedMotion
            ? "none"
            : isTransitionEnabled
              ? `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : "none",
        }}
        aria-hidden="true"
        onTransitionEnd={() => {
          if (prefersReducedMotion) return;
          if (displayIndex !== phrases.length) return;
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
          setIsTransitionEnabled(false);
          timeoutRef.current = window.setTimeout(() => {
            setDisplayIndex(0);
            timeoutRef.current = null;
          }, 0);
        }}
      >
        {stackedPhrases.map((phrase, index) => (
          <span key={`${phrase}-${index}`} className="block flex-none">
            {phrase}
          </span>
        ))}
      </span>
      <span className="sr-only">{phrases[activeIndex]}</span>
    </span>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function CardFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-[#0b0c11] ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
      <div className="text-[10px] tracking-widest text-white/50">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  desc,
  children,
  wide,
  className,
}: {
  id: string;
  eyebrow?: string;
  title?: string;
  desc?: string;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("px-5 py-16 sm:py-20 md:py-24", className)}
      style={{ scrollMarginTop: 92 }}
    >
      <Container wide={wide}>
        {(eyebrow || title || desc) && (
          <div className="max-w-2xl">
            {eyebrow ? (
              <div className="text-xs font-semibold tracking-widest text-white/55">{eyebrow}</div>
            ) : null}
            {title ? (
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {title}
              </h2>
            ) : null}
            {desc ? <p className="mt-3 text-base leading-relaxed text-white/70">{desc}</p> : null}
          </div>
        )}
        <div className="mt-10 sm:mt-12">{children}</div>
      </Container>
    </section>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setSize({ w: box.width, h: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

type DemoConfig = {
  title: string;
  description: string;
  defaultInput: string;
  outputLines: string[];
  badge?: string;
  compact?: boolean;
  autoRun?: boolean;
};

function RuntimeDemoCard({
  title,
  description,
  defaultInput,
  outputLines,
  badge,
  compact,
  autoRun,
}: DemoConfig) {
  const reduce = useReducedMotion();
  const [input, setInput] = useState(defaultInput);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const autoRunRef = useRef(false);
  const outputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!autoRun || autoRunRef.current) return;
    const timer = window.setTimeout(() => {
      autoRunRef.current = true;
      setVisibleLines([]);
      setPhase("running");
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [autoRun]);

  useEffect(() => {
    if (phase !== "running") return;
    let index = 0;
    const timer = window.setInterval(
      () => {
        index += 1;
        setVisibleLines(outputLines.slice(0, index));
        if (index >= outputLines.length) {
          window.clearInterval(timer);
          setPhase("done");
        }
      },
      reduce ? 80 : compact ? 260 : 320,
    );
    return () => window.clearInterval(timer);
  }, [compact, outputLines, phase, reduce]);

  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.scrollTo({
      top: outputRef.current.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [reduce, visibleLines]);

  const run = () => {
    setVisibleLines([]);
    setPhase("running");
  };

  const shellClass = compact
    ? "rounded-[28px] bg-white/[0.04] ring-1 ring-white/10 p-4 sm:p-5"
    : "rounded-[32px] bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6";

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden",
        shellClass,
        phase === "running" && "shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
      )}
      animate={
        phase === "running" && !reduce
          ? {
              boxShadow: [
                "0 0 0 rgba(34,211,238,0)",
                "0 0 36px rgba(34,211,238,0.16)",
                "0 0 0 rgba(34,211,238,0)",
              ],
            }
          : undefined
      }
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="absolute -inset-16 opacity-60 blur-3xl [background-image:radial-gradient(circle_at_25%_25%,rgba(34,211,238,0.14),transparent_55%),radial-gradient(circle_at_78%_28%,rgba(236,72,153,0.12),transparent_56%)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            {badge ? (
              <div className="text-[10px] font-semibold tracking-[0.22em] text-white/45">
                {badge}
              </div>
            ) : null}
            <div
              className={cn(
                "font-semibold text-white",
                compact ? "mt-1 text-base" : "mt-1 text-lg",
              )}
            >
              {title}
            </div>
            <div className={cn("mt-1 text-white/65", compact ? "text-xs" : "text-sm")}>
              {description}
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold text-white/70">
            Live runtime
          </div>
        </div>

        <div
          className={cn(
            "mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10",
            compact ? "p-3" : "p-4",
          )}
        >
          <div className="text-[10px] font-semibold tracking-[0.2em] text-white/45">INPUT</div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={compact ? 2 : 3}
            className={cn(
              "mt-2 w-full resize-none bg-transparent text-white/82 outline-none placeholder:text-white/28",
              compact ? "text-xs leading-5" : "text-sm leading-6",
            )}
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <motion.button
            type="button"
            onClick={run}
            whileTap={reduce ? undefined : { scale: 0.98 }}
            className={cn(
              "relative overflow-hidden rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))] font-semibold text-white",
              compact ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-sm",
            )}
          >
            <motion.span
              className="absolute inset-0"
              animate={phase === "running" && !reduce ? { opacity: [0.18, 0.4, 0.18] } : undefined}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.22), transparent 60%)",
              }}
            />
            <span className="relative">{phase === "running" ? "Running" : "Run"}</span>
          </motion.button>

          <div className={cn("text-white/48", compact ? "text-[11px]" : "text-xs")}>
            No setup. Just click.
          </div>
        </div>

        <motion.div
          className={cn(
            "mt-4 rounded-2xl bg-[#090b10]/88 ring-1 ring-white/10",
            compact ? "p-3" : "p-4",
          )}
          animate={
            phase !== "idle" && !reduce ? { borderColor: "rgba(255,255,255,0.16)" } : undefined
          }
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold tracking-[0.2em] text-white/45">OUTPUT</div>
            <div className={cn("text-white/35", compact ? "text-[10px]" : "text-[11px]")}>
              {phase === "idle" ? "Waiting" : phase === "running" ? "Streaming" : "Ready"}
            </div>
          </div>

          <div
            ref={outputRef}
            className={cn(
              "mt-3 overflow-y-auto text-white/76",
              compact ? "h-24 text-xs leading-5" : "h-36 text-sm leading-6",
            )}
          >
            {phase === "idle" ? (
              <div className="text-white/30">Run it to see what the buyer sees.</div>
            ) : (
              <div className="space-y-2">
                {visibleLines.map((line, index) => (
                  <motion.div
                    key={`${line}-${index}`}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={reduce ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="rounded-xl bg-white/[0.03] px-3 py-2"
                  >
                    {line}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function EditorialCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] bg-white/[0.03] p-5 ring-1 ring-white/10 sm:p-6">
      {eyebrow ? (
        <div className="text-[11px] font-semibold tracking-[0.2em] text-white/40">{eyebrow}</div>
      ) : null}
      <div className="mt-2 text-lg font-semibold text-white">{title}</div>
      <div className="mt-3 text-sm leading-6 text-white/68">{children}</div>
    </div>
  );
}

function NarrativeStep({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="p-1 sm:p-2">
      <div className="text-[11px] font-semibold tracking-[0.22em] text-white/38">{index}</div>
      <div className="mt-3 text-base font-semibold text-white sm:text-lg">{title}</div>
      <div className="mt-2 max-w-sm text-sm leading-6 text-white/64">{body}</div>
    </div>
  );
}

const HOW_IT_WORKS_STEPS = [
  {
    index: "01",
    title: "Start with your prompt or workflow",
    body: "Use what you already share today.",
  },
  {
    index: "02",
    title: "Make it runnable",
    body: "Add inputs, pricing, and output.",
  },
  {
    index: "03",
    title: "Share one product page",
    body: "People can try it, then buy it.",
  },
] as const;

function HowItWorksConnectedSection() {
  const reduce = useReducedMotion();
  const connectorPath = "M50 4 L50 12 L29 12 L29 26 L29 42 L71 42 L71 58 L71 74 L29 74 L29 88";

  const desktopPanelStyle = {
    filter: "brightness(1) saturate(1)",
    transform: "translateY(0px)",
    transition: "filter 260ms ease, transform 260ms ease",
  } as const;

  const desktopTextStyle = {
    opacity: 1,
    transform: "translateY(0px)",
    transition: "opacity 240ms ease, transform 240ms ease",
  } as const;

  const renderInputMonitor = () => (
    <div className="h-full rounded-[24px] border border-white/10 bg-[#0d1016] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between text-[11px] text-white/38">
        <span>Input</span>
        <span>ready</span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded-[16px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(34,211,238,0.07),rgba(255,255,255,0.02))] px-3 py-3">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-white/36">PROMPT</div>
          <div className="mt-2 text-sm text-white/76">YouTube viral content engine</div>
        </div>
        <div className="rounded-[16px] border border-cyan-300/18 bg-[#0a1117] px-3 py-3">
          <div className="text-[11px] font-semibold text-white/40">Video URL</div>
          <div className="mt-2 text-sm text-white/88">youtube.com/watch?v=8gMN8W1v4i4</div>
        </div>
        <div className="flex items-center justify-between rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3">
          <div>
            <div className="text-[11px] text-white/38">Output</div>
            <div className="mt-1 text-sm text-white/78">hooks, shorts, posts</div>
          </div>
          <div className="rounded-full border border-cyan-300/14 px-2.5 py-1 text-[11px] text-cyan-100/70">
            text
          </div>
        </div>
      </div>
    </div>
  );

  const renderBuilderMonitor = () => (
    <div className="h-full rounded-[24px] border border-white/10 bg-[#0d1016] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between text-[11px] text-white/38">
        <span>Builder</span>
        <span>configured</span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_1fr] gap-3">
        <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3">
          <div className="text-[11px] text-white/38">Input</div>
          <div className="mt-1 text-sm text-white/76">YouTube URL</div>
        </div>
        <div className="rounded-[16px] border border-pink-300/14 bg-[linear-gradient(180deg,rgba(236,72,153,0.08),rgba(255,255,255,0.02))] px-3 py-3">
          <div className="text-[11px] text-white/38">Price</div>
          <div className="mt-1 text-sm text-white/76">$7.99 one-time</div>
        </div>
      </div>
      <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl border border-cyan-300/22 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(255,255,255,0.02))]" />
          <div className="h-px flex-1 bg-white/10" />
          <div className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03]" />
          <div className="h-px flex-1 bg-white/10" />
          <div className="h-8 w-8 rounded-xl border border-pink-300/22 bg-[linear-gradient(180deg,rgba(236,72,153,0.12),rgba(255,255,255,0.02))]" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/48">
          <div className="rounded-[12px] border border-cyan-300/16 bg-[#0a1117] px-2 py-2 text-center text-cyan-100/66">
            input
          </div>
          <div className="rounded-[12px] border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
            logic
          </div>
          <div className="rounded-[12px] border border-pink-300/16 bg-white/[0.03] px-2 py-2 text-center text-pink-100/64">
            output
          </div>
        </div>
      </div>
    </div>
  );

  const renderProductMonitor = () => (
    <div className="h-full rounded-[24px] border border-white/10 bg-[#0d1016] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between text-[11px] text-white/38">
        <span>Product page</span>
        <span>live</span>
      </div>
      <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
        <div className="text-sm font-semibold text-white">YouTube Viral Content Engine</div>
        <div className="mt-2 text-sm text-white/64">Try before buying.</div>
        <div className="mt-4 flex items-center justify-between rounded-[14px] border border-pink-300/14 bg-[linear-gradient(180deg,rgba(236,72,153,0.08),rgba(255,255,255,0.02))] px-3 py-3">
          <div>
            <div className="text-[11px] text-white/40">Demo run</div>
            <div className="mt-1 text-sm text-white/86">Run once before purchase</div>
          </div>
          <div className="text-sm font-semibold text-white">$7.99</div>
        </div>
        <div className="mt-3 rounded-[14px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] px-3 py-2.5 text-sm text-white/72">
          One clean product page for trial, payment, and sharing.
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="relative hidden lg:block">
        <div className="relative mx-auto max-w-[1180px] pt-20">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
            <div className="grid h-16 w-16 place-items-center rounded-full border border-white/12 bg-[#0b0d12] shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
                <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={24} height={24} />
              </div>
            </div>
          </div>

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d={connectorPath}
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <g opacity={reduce ? 0.14 : 0.24}>
              <motion.ellipse
                cx="29"
                cy="42"
                rx="4.8"
                ry="3"
                fill="url(#howItWorksFogGradient)"
                filter="url(#howItWorksFogBlur)"
                animate={reduce ? undefined : { opacity: [0.14, 0.3, 0.14] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.ellipse
                cx="71"
                cy="58"
                rx="5.2"
                ry="3.2"
                fill="url(#howItWorksFogGradient)"
                filter="url(#howItWorksFogBlur)"
                animate={reduce ? undefined : { opacity: [0.1, 0.26, 0.1] }}
                transition={{
                  duration: 5.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.45,
                }}
              />
            </g>
            <path
              d={connectorPath}
              fill="none"
              stroke="url(#howItWorksFlowGradient)"
              strokeWidth="4.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{
                opacity: reduce ? 0 : 0.3,
                filter: "url(#howItWorksFlowBlur)",
              }}
            />
            <path
              d={connectorPath}
              fill="none"
              stroke="url(#howItWorksFlowGradient)"
              strokeWidth="1.95"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{
                filter:
                  "drop-shadow(0 0 12px rgba(34,211,238,0.24)) drop-shadow(0 0 18px rgba(236,72,153,0.16))",
              }}
            />
            <defs>
              <linearGradient
                id="howItWorksFlowGradient"
                x1="0"
                y1="-40"
                x2="0"
                y2="140"
                gradientUnits="userSpaceOnUse"
              >
                {!reduce ? (
                  <animateTransform
                    attributeName="gradientTransform"
                    type="translate"
                    values="0 -42; 0 42; 0 -42"
                    dur="4.2s"
                    repeatCount="indefinite"
                  />
                ) : null}
                <stop offset="0%" stopColor="rgba(34,211,238,0.94)" />
                <stop offset="10%" stopColor="rgba(115,240,252,0.98)" />
                <stop offset="20%" stopColor="rgba(245,248,255,1)" />
                <stop offset="30%" stopColor="rgba(236,72,153,0.96)" />
                <stop offset="40%" stopColor="rgba(34,211,238,0.94)" />
                <stop offset="50%" stopColor="rgba(245,248,255,1)" />
                <stop offset="60%" stopColor="rgba(236,72,153,0.96)" />
                <stop offset="72%" stopColor="rgba(34,211,238,0.94)" />
                <stop offset="84%" stopColor="rgba(245,248,255,0.98)" />
                <stop offset="100%" stopColor="rgba(236,72,153,0.94)" />
              </linearGradient>
              <radialGradient id="howItWorksFogGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(245,248,255,0.7)" />
                <stop offset="44%" stopColor="rgba(34,211,238,0.18)" />
                <stop offset="100%" stopColor="rgba(236,72,153,0)" />
              </radialGradient>
              <filter id="howItWorksFlowBlur" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
              <filter id="howItWorksFogBlur" x="-200%" y="-200%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="2.4" />
              </filter>
            </defs>
          </svg>

          <div className="space-y-16">
            <div className="grid min-h-[230px] grid-cols-12 items-center gap-8">
              <div className="col-span-6">
                <div
                  className="relative rounded-[30px] border border-white/10 bg-[#090b10] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
                  style={desktopPanelStyle}
                >
                  <div className="absolute right-[-1px] top-[18px] h-px w-8 bg-white/10" />
                  <div className="absolute right-6 top-[17px] h-2.5 w-2.5 rounded-full border border-white/14 bg-[#10141d]" />
                  {renderInputMonitor()}
                </div>
              </div>
              <div className="col-span-4 col-start-9" style={desktopTextStyle}>
                <div className="text-[11px] font-semibold tracking-[0.22em] text-white/46">
                  {HOW_IT_WORKS_STEPS[0].index}
                </div>
                <div className="mt-4 text-[1.45rem] font-semibold tracking-[-0.03em] text-white">
                  {HOW_IT_WORKS_STEPS[0].title}
                </div>
                <div className="mt-3 max-w-sm text-base leading-7 text-white/62">
                  {HOW_IT_WORKS_STEPS[0].body}
                </div>
              </div>
            </div>

            <div className="grid min-h-[230px] grid-cols-12 items-center gap-8">
              <div className="col-span-4" style={desktopTextStyle}>
                <div className="text-[11px] font-semibold tracking-[0.22em] text-white/46">
                  {HOW_IT_WORKS_STEPS[1].index}
                </div>
                <div className="mt-4 text-[1.45rem] font-semibold tracking-[-0.03em] text-white">
                  {HOW_IT_WORKS_STEPS[1].title}
                </div>
                <div className="mt-3 max-w-sm text-base leading-7 text-white/62">
                  {HOW_IT_WORKS_STEPS[1].body}
                </div>
              </div>
              <div className="col-span-6 col-start-7">
                <div
                  className="relative rounded-[30px] border border-white/10 bg-[#090b10] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
                  style={desktopPanelStyle}
                >
                  <div className="absolute left-[-1px] top-1/2 h-px w-8 -translate-y-1/2 bg-white/10" />
                  <div className="absolute left-6 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/14 bg-[#10141d]" />
                  <div className="absolute bottom-[-1px] left-1/2 h-8 w-px -translate-x-1/2 bg-white/10" />
                  <div className="absolute bottom-6 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-white/14 bg-[#10141d]" />
                  {renderBuilderMonitor()}
                </div>
              </div>
            </div>

            <div className="grid min-h-[230px] grid-cols-12 items-center gap-8">
              <div className="col-span-6">
                <div
                  className="relative rounded-[30px] border border-white/10 bg-[#090b10] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
                  style={desktopPanelStyle}
                >
                  <div className="absolute right-[-1px] top-1/2 h-px w-8 -translate-y-1/2 bg-white/10" />
                  <div className="absolute right-6 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/14 bg-[#10141d]" />
                  {renderProductMonitor()}
                </div>
              </div>
              <div className="col-span-4 col-start-9" style={desktopTextStyle}>
                <div className="text-[11px] font-semibold tracking-[0.22em] text-white/46">
                  {HOW_IT_WORKS_STEPS[2].index}
                </div>
                <div className="mt-4 text-[1.45rem] font-semibold tracking-[-0.03em] text-white">
                  {HOW_IT_WORKS_STEPS[2].title}
                </div>
                <div className="mt-3 max-w-sm text-base leading-7 text-white/62">
                  {HOW_IT_WORKS_STEPS[2].body}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative space-y-8 lg:hidden">
        <div className="absolute bottom-0 left-[11px] top-0 w-px bg-white/10" />
        <motion.div
          className="absolute inset-y-0 left-[5px] w-[13px] rounded-full bg-[radial-gradient(circle,rgba(245,248,255,0.12)_0%,rgba(34,211,238,0.08)_36%,rgba(236,72,153,0.05)_58%,rgba(236,72,153,0)_76%)] blur-[10px]"
          style={{
            backgroundSize: "100% 240px",
          }}
          animate={reduce ? undefined : { backgroundPositionY: ["0px", "240px"] }}
          transition={
            reduce
              ? undefined
              : {
                  duration: 4.2,
                  repeat: Infinity,
                  ease: "linear",
                }
          }
        />
        <motion.div
          className="absolute inset-y-0 left-[10px] w-[3px] rounded-full bg-[linear-gradient(180deg,rgba(34,211,238,0.96)_0%,rgba(115,240,252,0.98)_12%,rgba(245,248,255,1)_24%,rgba(236,72,153,0.96)_36%,rgba(34,211,238,0.94)_50%,rgba(245,248,255,1)_66%,rgba(236,72,153,0.94)_82%,rgba(34,211,238,0.96)_100%)]"
          style={{
            backgroundSize: "100% 240px",
            boxShadow: "0 0 12px rgba(34,211,238,0.34), 0 0 22px rgba(236,72,153,0.2)",
          }}
          animate={reduce ? undefined : { backgroundPositionY: ["0px", "240px"] }}
          transition={
            reduce
              ? undefined
              : {
                  duration: 4.2,
                  repeat: Infinity,
                  ease: "linear",
                }
          }
        />
        {HOW_IT_WORKS_STEPS.map((step, index) => (
          <div key={step.index} className="relative pl-8">
            <div
              className="absolute left-0 top-2 h-[22px] w-[22px] rounded-full border border-white/12 bg-[#0b0c11]"
              style={{ opacity: 1, transition: "opacity 240ms ease" }}
            >
              <div className="absolute inset-[5px] rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,0.95),rgba(236,72,153,0.9))]" />
            </div>
            <div style={desktopTextStyle}>
              <div className="text-[11px] font-semibold tracking-[0.22em] text-white/46">
                {step.index}
              </div>
              <div className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">
                {step.title}
              </div>
              <div className="mt-2 text-sm leading-6 text-white/62">{step.body}</div>
            </div>
            <div className="mt-5 rounded-[26px] bg-[#090b10] p-3 ring-1 ring-white/10">
              <div style={desktopPanelStyle}>
                {index === 0
                  ? renderInputMonitor()
                  : index === 1
                    ? renderBuilderMonitor()
                    : renderProductMonitor()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductTransformationSurface() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [typedCount, setTypedCount] = useState(0);
  const [runtimeBeat, setRuntimeBeat] = useState<"preparing" | "llm" | "image">("preparing");
  const typedUrl = "https://www.youtube.com/watch?v=8gMN8W1v4i4";
  const outputSections = [
    {
      title: "Hook rewrites",
      detail: "(5 variants)",
      body: ['"Nobody tells you this about X"', '"I tried X for 7 days..."'],
    },
    {
      title: "Shorts scripts",
      detail: "(3 clips)",
      body: ["timestamped + structured"],
    },
    {
      title: "Twitter thread",
      detail: "",
      body: ["clean, ready to post"],
    },
    {
      title: "LinkedIn post",
      detail: "",
      body: ["founder-style narrative"],
    },
    {
      title: "Title + thumbnail ideas",
      detail: "",
      body: ["high CTR angles"],
    },
  ];

  useEffect(() => {
    if (reduce) return;
    const sequence = [2500, 2650, 8000, 7000];
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = (index: number) => {
      if (cancelled) return;
      setStage(index);
      timeoutId = setTimeout(() => {
        schedule((index + 1) % 4);
      }, sequence[index] ?? 2000);
    };

    schedule(0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    if (stage !== 2) return;

    const preparingTimer = setTimeout(() => setRuntimeBeat("preparing"), 0);
    const llmTimer = setTimeout(() => setRuntimeBeat("llm"), 1000);
    const imageTimer = setTimeout(() => setRuntimeBeat("image"), 6000);

    return () => {
      clearTimeout(preparingTimer);
      clearTimeout(llmTimer);
      clearTimeout(imageTimer);
    };
  }, [reduce, stage]);

  useEffect(() => {
    if (reduce) return;
    if (stage !== 1) {
      const resetId = setTimeout(() => setTypedCount(0), 0);
      return () => clearTimeout(resetId);
    }

    const startDelay = 220;
    const stepMs = 38;
    let index = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      setTypedCount(0);
      intervalId = setInterval(() => {
        index += 1;
        setTypedCount(Math.min(index, typedUrl.length));
        if (index >= typedUrl.length && intervalId) clearInterval(intervalId);
      }, stepMs);
    }, startDelay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [reduce, stage, typedUrl]);

  const runtimeGraph = useMemo<NonNullable<WorkflowRunState["graph"]>>(
    () => ({
      nodes: [
        {
          id: "llm-hooks",
          type: "edgCard",
          position: { x: 0, y: 0 },
          data: {
            specId: "llm-chat",
            title: "Hook rewrites",
            config: { model: "gpt-5-mini" },
          },
        },
        {
          id: "llm-shorts",
          type: "edgCard",
          position: { x: 280, y: 0 },
          data: {
            specId: "llm-chat",
            title: "Shorts scripts",
            config: { model: "gpt-5-mini" },
          },
        },
        {
          id: "llm-posts",
          type: "edgCard",
          position: { x: 560, y: 0 },
          data: {
            specId: "llm-chat",
            title: "Thread + LinkedIn",
            config: { model: "gpt-5-mini" },
          },
        },
        {
          id: "llm-image",
          type: "edgCard",
          position: { x: 840, y: 0 },
          data: {
            specId: "llm-image",
            title: "Thumbnail concept frame",
            config: { model: "nano-banana-2", aspectRatio: "16:9" },
          },
        },
      ],
      edges: [
        { id: "e-hooks-shorts", source: "llm-hooks", target: "llm-shorts", type: "gradient" },
        { id: "e-shorts-posts", source: "llm-shorts", target: "llm-posts", type: "gradient" },
        { id: "e-posts-image", source: "llm-posts", target: "llm-image", type: "gradient" },
      ],
    }),
    [],
  );

  const runtimeSurfaceState = useMemo<WorkflowRunState>(() => {
    if (runtimeBeat === "preparing") {
      return {
        workflowId: "hero-youtube-viral-content-engine",
        workflowName: "YouTube Viral Content Engine",
        phase: "executing",
        status: "running",
        connectionState: "live",
        steps: [
          { id: "prep-1", title: "Preparing workflow", status: "done" },
          { id: "prep-2", title: "Allocating runtime", status: "done" },
        ],
        logs: [],
        graph: runtimeGraph,
      };
    }

    if (runtimeBeat === "image") {
      return {
        workflowId: "hero-youtube-viral-content-engine",
        workflowName: "YouTube Viral Content Engine",
        phase: "executing",
        status: "running",
        connectionState: "live",
        currentStepId: "llm-image",
        steps: [
          { id: "llm-hooks", title: "Hook rewrites", status: "done" },
          { id: "llm-shorts", title: "Shorts scripts", status: "done" },
          { id: "llm-posts", title: "Thread + LinkedIn", status: "done" },
          { id: "llm-image", title: "Thumbnail concept frame", status: "running" },
        ],
        logs: [],
        graph: runtimeGraph,
      };
    }

    return {
      workflowId: "hero-youtube-viral-content-engine",
      workflowName: "YouTube Viral Content Engine",
      phase: "executing",
      status: "running",
      connectionState: "live",
      currentStepId: "llm-hooks",
      steps: [
        { id: "llm-hooks", title: "Hook rewrites", status: "running" },
        { id: "llm-shorts", title: "Shorts scripts", status: "running" },
        { id: "llm-posts", title: "Thread + LinkedIn", status: "running" },
        { id: "llm-image", title: "Thumbnail concept frame", status: "queued" },
      ],
      logs: [],
      graph: runtimeGraph,
    };
  }, [runtimeBeat, runtimeGraph]);

  return (
    <div className="relative min-h-[500px] overflow-hidden rounded-[34px] p-3 sm:min-h-[560px] sm:p-4">
      <div className="pointer-events-none absolute inset-3 rounded-[30px] opacity-50 [background-image:radial-gradient(circle_at_14%_18%,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(236,72,153,0.18),transparent_24%),radial-gradient(circle_at_52%_84%,rgba(255,255,255,0.06),transparent_32%)] sm:inset-4 sm:rounded-[30px]" />
      <div className="pointer-events-none absolute inset-3 rounded-[30px] opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px] sm:inset-4 sm:rounded-[30px]" />

      <div className="relative min-h-[472px] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] shadow-[0_30px_100px_rgba(0,0,0,0.5)] sm:min-h-[528px]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white/24" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
          </div>
          <div className="text-[11px] font-medium text-white/44">edgaze.ai/marketplace</div>
        </div>

        <div className="relative h-[420px] overflow-hidden sm:h-[472px]">
          <motion.div
            className="pointer-events-none absolute left-[-12%] top-[8%] h-[68%] w-[34%] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.16),transparent_68%)] blur-3xl"
            animate={reduce ? undefined : { x: [0, 48, 0], y: [0, -18, 0] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="pointer-events-none absolute right-[-10%] top-[14%] h-[64%] w-[32%] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.14),transparent_70%)] blur-3xl"
            animate={reduce ? undefined : { x: [0, -42, 0], y: [0, 16, 0] }}
            transition={{ duration: 9.2, repeat: Infinity, ease: "easeInOut" }}
          />

          {stage === 0 ? (
            <motion.div
              className="absolute inset-0 px-3 py-3 sm:px-4 sm:py-4"
              initial={reduce ? false : { opacity: 0.96 }}
              animate={reduce ? undefined : { opacity: 1 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              <motion.div
                className="grid h-full gap-3 lg:grid-cols-[minmax(0,1.28fr)_284px]"
                animate={reduce ? undefined : { opacity: 1 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
              >
                <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0b0d13] shadow-[0_22px_80px_rgba(0,0,0,0.35)]">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div className="flex items-center gap-3 text-[12px] text-white/40">
                      <span>Marketplace</span>
                      <span className="hidden text-white/24 sm:inline">
                        edgaze.ai/raul_ia_prod/yt
                      </span>
                    </div>
                    <div className="text-[12px] text-white/35">Share</div>
                  </div>

                  <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                    <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(135deg,#07131b_0%,#0b0f17_48%,#11111a_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
                      <div className="flex h-full flex-col gap-5">
                        <div className="min-w-0 space-y-3">
                          <div className="text-[12px] font-semibold tracking-[0.22em] text-cyan-200/65">
                            YOUTUBE WORKFLOW
                          </div>
                          <div className="max-w-[7.8ch] text-[2.5rem] font-semibold tracking-[-0.065em] leading-[0.9] text-white sm:text-[2.72rem]">
                            YouTube Viral Content Engine
                          </div>
                          <div className="max-w-full truncate text-[11px] leading-5 text-white/50">
                            Turn one video into hooks, shorts, threads, founder posts, and title
                            ideas people click.
                          </div>
                        </div>

                        <div className="relative mt-1 w-full max-w-[260px]">
                          <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_32%_22%,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_82%_28%,rgba(236,72,153,0.18),transparent_38%)] blur-2xl" />
                          <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,19,0.76),rgba(10,12,18,0.44))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-center gap-2 text-[11px] text-white/42">
                              <div className="rounded bg-[#ff0000] px-1.5 py-0.5 font-semibold text-white">
                                YouTube
                              </div>
                              <span>Growth breakdown</span>
                            </div>
                            <div className="mt-3 h-32 rounded-[16px] border border-emerald-300/10 bg-[linear-gradient(180deg,rgba(11,15,20,0.72),rgba(10,12,18,0.42))] p-3">
                              <div className="relative h-full">
                                <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:32px_32px]" />
                                <svg
                                  className="absolute inset-0 h-full w-full"
                                  viewBox="0 0 300 160"
                                  aria-hidden
                                >
                                  <path
                                    d="M10 128 L46 110 L84 118 L118 88 L154 96 L188 68 L222 56 L262 30"
                                    fill="none"
                                    stroke="rgba(163,230,53,0.95)"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <div className="absolute left-3 top-3 text-[12px] font-semibold text-white/78">
                                  Estimated viral lift
                                </div>
                                <div className="absolute right-3 top-3 text-[24px] font-semibold tracking-[-0.05em] text-lime-300">
                                  +238%
                                </div>
                                <div className="absolute bottom-3 left-3 text-[12px] text-white/56">
                                  hooks, threads, clips
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.3)]">
                  <div className="text-sm font-semibold text-white">Unlock this workflow</div>
                  <div className="mt-1 text-[12px] text-white/55">
                    Access attaches to your Edgaze account.
                  </div>

                  <div className="mt-5 flex items-end gap-2">
                    <div className="text-[12px] text-white/40">Price</div>
                    <div className="text-3xl font-semibold tracking-[-0.05em] text-white">
                      $7.99
                    </div>
                    <div className="pb-1 text-[12px] text-white/45">one-time</div>
                  </div>

                  <div className="mt-5 space-y-2.5">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.94),rgba(236,72,153,0.9))] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_22px_rgba(34,211,238,0.38)]"
                    >
                      Open in Workflow Studio
                    </button>

                    <div className="relative">
                      <motion.button
                        type="button"
                        className="flex w-full items-center justify-center gap-3 rounded-full border border-amber-500/40 bg-[linear-gradient(180deg,rgba(78,52,10,0.9),rgba(63,42,8,0.96))] px-4 py-3 text-[14px] font-semibold text-amber-200 shadow-[0_6px_28px_rgba(251,191,36,0.18)]"
                        animate={
                          reduce
                            ? undefined
                            : {
                                scale: [1, 1, 1, 0.965, 1.01, 1],
                                boxShadow: [
                                  "0 6px 28px rgba(251,191,36,0.16)",
                                  "0 8px 34px rgba(251,191,36,0.26)",
                                  "0 8px 34px rgba(251,191,36,0.26)",
                                  "0 3px 14px rgba(251,191,36,0.18)",
                                  "0 7px 30px rgba(251,191,36,0.24)",
                                  "0 6px 28px rgba(251,191,36,0.16)",
                                ],
                              }
                        }
                        transition={{
                          duration: 2.5,
                          ease: [0.22, 1, 0.36, 1],
                          times: [0, 0.68, 0.78, 0.86, 0.92, 1],
                        }}
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Try a one-time demo
                      </motion.button>

                      <motion.div
                        className="pointer-events-none absolute -left-3 top-1/2 z-20"
                        animate={
                          reduce
                            ? undefined
                            : {
                                x: [0, 18, 28, 28],
                                y: [0, 4, 8, 8],
                                scale: [0.96, 1, 1, 0.9],
                                opacity: [0.7, 1, 1, 1],
                              }
                        }
                        transition={{
                          duration: 2.5,
                          ease: "linear",
                        }}
                      >
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/70 text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-md">
                          <MousePointer2 className="h-4 w-4" />
                        </div>
                      </motion.div>
                    </div>

                    <button
                      type="button"
                      className="flex w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/78"
                    >
                      Share
                    </button>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
                    <div className="font-semibold text-white/82">What you get</div>
                    <div className="mt-2 space-y-1.5 leading-relaxed">
                      <div>• 10 hosted runs included</div>
                      <div>• Use your own API key after hosted runs are finished</div>
                      <div>• Workflow Studio in preview mode</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}

          {stage === 1 ? (
            <motion.div
              className="absolute inset-0 px-3 py-3 sm:px-4 sm:py-4"
              initial={reduce ? false : { opacity: 0.92 }}
              animate={reduce ? undefined : { opacity: 1 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <div className="flex h-full items-center justify-center">
                <motion.div
                  className="w-full max-w-[620px] rounded-[30px] border border-white/10 bg-[#090a0e]/94 p-3 shadow-[0_40px_140px_rgba(0,0,0,0.62)] sm:p-5"
                  initial={reduce ? false : { scale: 0.985, y: 8 }}
                  animate={reduce ? undefined : { scale: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-white">
                        YouTube → Viral Content Engine
                      </div>
                      <div className="mt-1 text-[12px] text-white/42">
                        Paste a YouTube URL to run the workflow.
                      </div>
                    </div>
                    <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/70">
                      ×
                    </div>
                  </div>

                  <div className="px-2 pt-5">
                    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5">
                      <div className="text-[12px] font-semibold tracking-[0.16em] text-white/42">
                        INPUT REQUIRED
                      </div>
                      <div className="mt-3 text-[22px] font-semibold tracking-[-0.04em] text-white sm:text-[1.9rem]">
                        Enter the YouTube video URL
                      </div>
                      <div className="mt-3 text-sm leading-6 text-white/58">
                        We&apos;ll pull the transcript, extract the strongest angles, then package
                        the outputs for publishing.
                      </div>

                      <motion.div
                        className="mt-6 rounded-[24px] border border-cyan-300/18 bg-[#0b0f16] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                        initial={reduce ? false : { scale: 0.965, y: 12 }}
                        animate={reduce ? undefined : { scale: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <div className="text-[11px] font-semibold text-white/40">YouTube URL</div>
                        <div className="mt-2 flex min-h-[28px] items-center overflow-hidden text-[15px] font-medium text-white/92 sm:text-[17px]">
                          <span>{typedUrl.slice(0, typedCount)}</span>
                          {!reduce ? (
                            <motion.span
                              className="ml-0.5 inline-block h-[18px] w-px bg-cyan-200/80"
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                            />
                          ) : null}
                        </div>
                      </motion.div>

                      <div className="mt-5 flex justify-end">
                        <div className="relative">
                          <motion.button
                            type="button"
                            className="rounded-full bg-[linear-gradient(180deg,rgba(255,212,92,0.98),rgba(237,181,45,0.96))] px-5 py-2.5 text-sm font-semibold text-[#241504] shadow-[0_8px_26px_rgba(251,191,36,0.28)]"
                            animate={
                              reduce
                                ? undefined
                                : {
                                    scale: [1, 1, 1, 1.08, 0.972, 1],
                                    boxShadow: [
                                      "0 8px 26px rgba(251,191,36,0.28)",
                                      "0 8px 26px rgba(251,191,36,0.28)",
                                      "0 8px 26px rgba(251,191,36,0.28)",
                                      "0 16px 42px rgba(251,191,36,0.34)",
                                      "0 5px 16px rgba(251,191,36,0.22)",
                                      "0 8px 26px rgba(251,191,36,0.28)",
                                    ],
                                  }
                            }
                            transition={{
                              duration: 2.65,
                              ease: [0.22, 1, 0.36, 1],
                              times: [0, 0.68, 0.8, 0.88, 0.94, 1],
                            }}
                          >
                            Run demo
                          </motion.button>

                          {!reduce ? (
                            <motion.div
                              className="pointer-events-none absolute -left-3 top-1/2"
                              animate={{
                                x: [0, 0, 0, 16, 24, 24],
                                y: [0, 0, 0, 5, 8, 8],
                                scale: [0.94, 0.94, 0.94, 1, 1, 0.92],
                                opacity: [0, 0, 0, 1, 1, 1],
                              }}
                              transition={{
                                duration: 2.65,
                                ease: [0.22, 1, 0.36, 1],
                                times: [0, 0.68, 0.74, 0.86, 0.94, 1],
                              }}
                            >
                              <div className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/70 text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-md">
                                <MousePointer2 className="h-4 w-4" />
                              </div>
                            </motion.div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : null}

          {stage === 2 ? (
            <motion.div
              className="absolute inset-0 px-3 py-4 sm:px-4"
              initial={reduce ? false : { opacity: 0.92 }}
              animate={reduce ? undefined : { opacity: 1 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <div className="flex h-full items-center justify-center">
                <div className="relative h-[330px] w-full max-w-[700px] overflow-hidden rounded-[26px] border border-white/10 bg-[#050608] shadow-[0_32px_120px_rgba(0,0,0,0.58)] sm:h-[420px] sm:rounded-[30px]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(34,211,238,0.1),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(236,72,153,0.12),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))]" />
                  <div className="hero-runtime-stage absolute left-1/2 top-1/2">
                    <CustomerWorkflowRuntimeSurface
                      state={runtimeSurfaceState}
                      hideActionZone
                      showInlineExecutionCancel={false}
                    />
                  </div>
                  <style
                    dangerouslySetInnerHTML={{
                      __html: `
                          .hero-runtime-stage {
                            width: 900px;
                            height: 640px;
                            transform: translate3d(-50%, -50%, 0) scale(0.32);
                            transform-origin: center;
                          }
                          .hero-runtime-stage [class*="max-md:max-w-[310px]"] {
                            max-width: 900px !important;
                          }
                          .hero-runtime-stage [class*="h-[min(32vh,200px)]"] {
                            height: 320px !important;
                            min-height: 320px !important;
                            border-radius: 30px !important;
                          }
                          .hero-runtime-stage [class*="md:text-[52px]"] {
                            font-size: 52px !important;
                            line-height: 1 !important;
                          }
                          .hero-runtime-stage [class*="md:text-[16px]"][class*="md:leading-7"] {
                            margin-top: 1.25rem !important;
                            max-width: 58ch !important;
                            font-size: 16px !important;
                            line-height: 1.75rem !important;
                          }
                          @media (min-width: 380px) {
                            .hero-runtime-stage {
                              transform: translate3d(-50%, -50%, 0) scale(0.39);
                            }
                          }
                          @media (min-width: 480px) {
                            .hero-runtime-stage {
                              transform: translate3d(-50%, -50%, 0) scale(0.48);
                            }
                          }
                          @media (min-width: 640px) {
                            .hero-runtime-stage {
                              transform: translate3d(-50%, -50%, 0) scale(0.63);
                            }
                          }
                          @media (min-width: 1024px) {
                            .hero-runtime-stage {
                              transform: translate3d(-50%, -50%, 0) scale(0.68);
                            }
                          }
                        `,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ) : null}

          {stage === 3 ? (
            <motion.div
              className="absolute inset-0 px-3 py-3 sm:px-4 sm:py-4"
              initial={reduce ? false : { opacity: 0 }}
              animate={reduce ? undefined : { opacity: 1 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="h-full rounded-[26px] border border-white/10 bg-[#0b0d13] p-3 shadow-[0_22px_80px_rgba(0,0,0,0.35)] sm:p-4">
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold tracking-[0.18em] text-white/40">
                        RESULT READY
                      </div>
                      <div className="mt-2 text-[1.7rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.2rem]">
                        Your distribution pack is ready to publish
                      </div>
                    </div>
                    <div className="rounded-full border border-emerald-400/18 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
                      ready
                    </div>
                  </div>

                  <div className="mt-4 text-sm leading-6 text-white/58">
                    One YouTube video in. Five polished assets out.
                  </div>

                  <div className="mt-5 h-[262px] overflow-hidden rounded-[24px] border border-white/10 bg-[#090b10] sm:h-[300px]">
                    <motion.div
                      className="space-y-3 p-3.5 sm:p-4"
                      animate={reduce ? undefined : { y: ["0%", "-44%", "-44%"] }}
                      transition={{
                        duration: 7,
                        ease: [0.22, 1, 0.36, 1],
                        times: [0, 0.72, 1],
                      }}
                    >
                      <div className="rounded-[20px] border border-cyan-300/12 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-4">
                        <div className="text-sm font-semibold text-white">
                          1. {outputSections[0]?.title}{" "}
                          <span className="text-white/54">{outputSections[0]?.detail}</span>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {outputSections[0]?.body.map((line) => (
                            <div
                              key={line}
                              className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm font-medium text-white/82"
                            >
                              {line}
                            </div>
                          ))}
                          <div className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm font-medium text-white/64">
                            “The YouTube growth loop creators miss in year one”
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm font-semibold text-white">
                          2. {outputSections[1]?.title}{" "}
                          <span className="text-white/54">{outputSections[1]?.detail}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {[
                            "00:12 Hook: the hidden growth mistake",
                            "00:34 Story beat: what changed after 7 days",
                            "01:08 CTA: use the framework in one click",
                          ].map((line) => (
                            <div
                              key={line}
                              className="rounded-[16px] border border-white/8 bg-[#0d1016] px-3 py-3 text-sm text-white/74"
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm font-semibold text-white">
                          3. {outputSections[2]?.title}
                        </div>
                        <div className="mt-3 rounded-[18px] border border-white/8 bg-[#0d1016] p-4">
                          <div className="space-y-2 text-sm leading-6 text-white/76">
                            <div>
                              1/ Most creators publish prompts. The best ones publish products.
                            </div>
                            <div>
                              2/ This workflow turns one video into hooks, shorts, and posts
                              instantly.
                            </div>
                            <div>
                              3/ That means faster testing, cleaner distribution, and better
                              monetization.
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm font-semibold text-white">
                          4. {outputSections[3]?.title}
                        </div>
                        <div className="mt-3 rounded-[18px] border border-white/8 bg-[#0d1016] p-4 text-sm leading-6 text-white/74">
                          I used to think content systems were mostly about volume. They are not.
                          The real leverage comes from turning one strong source asset into multiple
                          distribution-ready outputs without losing voice.
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-pink-300/12 bg-[linear-gradient(135deg,rgba(236,72,153,0.08),rgba(255,255,255,0.02))] p-4">
                        <div className="text-sm font-semibold text-white">
                          5. {outputSections[4]?.title}
                        </div>
                        <div className="mt-3 space-y-3">
                          {[
                            "Why nobody scales YouTube without this system",
                            "I tested viral repurposing for 7 days",
                            "The AI workflow turning one video into six assets",
                          ].map((line) => (
                            <div
                              key={line}
                              className="rounded-[16px] border border-white/8 bg-[#0d1016] px-3 py-3 text-sm text-white/76"
                            >
                              {line}
                            </div>
                          ))}
                          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(135deg,#07131b_0%,#0d1018_48%,#15111b_100%)] p-3">
                            <div className="text-[11px] font-semibold tracking-[0.16em] text-cyan-200/62">
                              THUMBNAIL IDEA
                            </div>
                            <div className="mt-3 rounded-[16px] border border-white/10 bg-[#090b10] p-3">
                              <div className="text-[13px] font-semibold leading-5 text-white">
                                I tried this for 7 days...
                              </div>
                              <div className="mt-3 flex h-28 items-end rounded-[14px] bg-[radial-gradient(circle_at_26%_24%,rgba(34,211,238,0.28),transparent_40%),radial-gradient(circle_at_78%_24%,rgba(236,72,153,0.28),transparent_38%),linear-gradient(180deg,#0f1720,#11121a)] p-3">
                                <div className="text-[24px] font-semibold tracking-[-0.06em] text-lime-300">
                                  +238%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreatorSwitchMatrix() {
  const rows = [
    {
      icon: FileText,
      label: "PDF / prompt pack",
      left: "Buyers read the instructions",
      right: "Buyers run the workflow",
    },
    {
      icon: ScrollText,
      label: "Docs / files",
      left: "Value is trapped in a PDF, prompt pack, or doc",
      right: "Value lives inside a runnable product page",
    },
    {
      icon: LayoutList,
      label: "Static listing",
      left: "Creators sell once and hope it works",
      right: "Creators see usage, runs, and buyer behavior",
    },
    {
      icon: ArrowRight,
      label: "Posts and links",
      left: "Traffic gets scattered across links and posts",
      right: "Discovery, usage, and payment stay together",
    },
  ];

  return (
    <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
      <div className="hidden md:grid md:grid-cols-2">
        <div className="border-b border-r border-white/10 bg-white/[0.02] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/68">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Static files</div>
              <div className="text-xs text-white/44">
                PDFs, prompt packs, docs, and scattered posts
              </div>
            </div>
          </div>
        </div>
        <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(236,72,153,0.06))] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/[0.04]">
              <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={20} height={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Edgaze</div>
              <div className="text-xs text-white/52">
                Runnable product pages with trial, usage, and payment
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/10">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.left} className="px-4 py-4 sm:px-5 md:px-0 md:py-0">
              <div className="mb-3 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] text-white/34 md:hidden">
                <Icon className="h-3.5 w-3.5" />
                <span>{row.label}</span>
              </div>

              <div className="hidden md:grid md:grid-cols-2">
                <div className="border-r border-white/10 px-6 py-5">
                  <div className="mb-2 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] text-white/30">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{row.label}</span>
                  </div>
                  <div className="text-sm leading-7 text-white/58">{row.left}</div>
                </div>
                <div className="bg-[linear-gradient(180deg,rgba(34,211,238,0.05),rgba(236,72,153,0.04))] px-6 py-5">
                  <div className="text-sm font-semibold leading-7 text-white">{row.right}</div>
                </div>
              </div>

              <div className="space-y-3 md:hidden">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-white/34">
                    STATIC FILES
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/60">{row.left}</div>
                </div>
                <div className="rounded-[20px] border border-white/12 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(236,72,153,0.06))] px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white/48">
                    <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={14} height={14} />
                    <span>EDGAZE</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-white">{row.right}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TODO: Replace fallback neutral icons with official Gumroad / Notion / PDF / social assets if those logos are added to the project. */}
    </div>
  );
}

function CreatorDashboardSurface() {
  const reduce = useReducedMotion();
  const canvasRef = useRef<CanvasRef | null>(null);
  const [isCreatorCanvasReady, setIsCreatorCanvasReady] = useState(false);
  const payoutTarget = 1432.98;
  const countDurationMs = 2100;
  const holdDurationMs = 1500;
  const resetFadeMs = 220;
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const creatorWorkflow = HOME_DEMO_WORKFLOWS[3] ?? HOME_DEMO_WORKFLOWS[0] ?? null;

  useEffect(() => {
    if (!isCreatorCanvasReady || !creatorWorkflow?.graph) return;
    canvasRef.current?.loadGraph?.(creatorWorkflow.graph);
  }, [creatorWorkflow, isCreatorCanvasReady]);

  const handleCreatorCanvasRef = useCallback((instance: CanvasRef | null) => {
    canvasRef.current = instance;
    setIsCreatorCanvasReady(Boolean(instance));
  }, []);

  useEffect(() => {
    if (reduce) return;

    let rafId = 0;
    let holdTimeout = 0;
    let resetTimeout = 0;
    let restartTimeout = 0;
    let cancelled = false;

    const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

    const startCycle = () => {
      if (cancelled) return;

      setDisplayValue(0);
      setIsVisible(true);
      setProgress(0);

      const startedAt = performance.now();

      const step = (now: number) => {
        if (cancelled) return;

        const progress = clamp((now - startedAt) / countDurationMs, 0, 1);
        setDisplayValue(payoutTarget * easeOutCubic(progress));
        setProgress(progress);

        if (progress < 1) {
          rafId = window.requestAnimationFrame(step);
          return;
        }

        setDisplayValue(payoutTarget);
        setProgress(1);
        holdTimeout = window.setTimeout(() => {
          if (cancelled) return;

          setIsVisible(false);
          resetTimeout = window.setTimeout(() => {
            if (cancelled) return;

            setDisplayValue(0);
            setProgress(0);
            restartTimeout = window.setTimeout(startCycle, 60);
          }, resetFadeMs);
        }, holdDurationMs);
      };

      rafId = window.requestAnimationFrame(step);
    };

    startCycle();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(holdTimeout);
      window.clearTimeout(resetTimeout);
      window.clearTimeout(restartTimeout);
    };
  }, [countDurationMs, holdDurationMs, payoutTarget, reduce, resetFadeMs]);

  const formattedValue = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(displayValue),
    [displayValue],
  );
  const displayedAmount = reduce ? "$1,432.98" : formattedValue;
  const displayedProgress = reduce ? 1 : progress;

  return (
    <div className="mx-auto max-w-[860px]">
      <CardFrame className="overflow-hidden p-0">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#0b0d12_0%,#08090d_100%)] px-5 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_16%_18%,rgba(34,211,238,0.16),transparent_26%),radial-gradient(circle_at_84%_18%,rgba(236,72,153,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)]" />

          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_18px_60px_rgba(0,0,0,0.34)]">
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />
              <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 rounded-[18px] border border-white/12 bg-[linear-gradient(180deg,rgba(9,11,16,0.94),rgba(9,11,16,0.82))] px-3 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-white/38">
                    CREATOR WORKFLOW
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {creatorWorkflow?.title ?? "Workflow graph"}
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium tracking-[0.16em] text-white/48">
                  Live graph
                </div>
              </div>

              <div className="h-[280px] sm:h-[320px]">
                <ReactFlowCanvas
                  ref={handleCreatorCanvasRef}
                  mode="preview"
                  compact
                  previewPanEnabled={false}
                />
              </div>
            </div>

            <div className="relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-10 text-center shadow-[0_18px_60px_rgba(0,0,0,0.34)] sm:min-h-[300px] sm:px-10">
              <div className="text-[11px] font-semibold tracking-[0.22em] text-white/42">
                Pending payouts
              </div>

              <motion.div
                aria-label={displayedAmount}
                className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl"
                animate={reduce ? { opacity: 1 } : { opacity: isVisible ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : resetFadeMs / 1000, ease: [0.22, 1, 0.36, 1] }}
              >
                {displayedAmount}
              </motion.div>

              <div className="mt-4 text-sm text-white/56 sm:text-base">From workflow purchases</div>

              <div className="mt-7 w-full max-w-[320px]">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
                  <span>Payout cycle</span>
                  <span>{Math.round(displayedProgress * 100)}%</span>
                </div>
                <div className="mt-2.5 h-2.5 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                  <div
                    className="relative h-full rounded-full"
                    style={{
                      width: `${displayedProgress * 100}%`,
                      background:
                        "linear-gradient(90deg, rgba(34,211,238,0.96) 0%, rgba(122,219,245,0.98) 38%, rgba(236,72,153,0.92) 100%)",
                      boxShadow: "0 0 16px rgba(34,211,238,0.22), 0 0 26px rgba(236,72,153,0.12)",
                      transition: reduce ? "none" : `width ${resetFadeMs}ms ease-out`,
                    }}
                  >
                    <div
                      className="absolute inset-y-0 right-0 w-12"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 55%, rgba(255,255,255,0.06) 100%)",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium tracking-[0.16em] text-white/46">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                <span>Stripe connected</span>
              </div>
            </div>
          </div>
        </div>
      </CardFrame>
    </div>
  );
}

function ProductProofSection({
  workflow,
  onRun,
  homepageRunError,
}: {
  workflow: LandingDemoWorkflow | null;
  onRun: (workflow: LandingDemoWorkflow) => void;
  homepageRunError: string | null;
}) {
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-4 text-center text-sm text-white/62 sm:mb-5">
        Click Run to see how a buyer experiences a workflow.
      </div>
      <WorkflowStudioEmbedCard workflow={workflow} onRun={onRun} />
      {homepageRunError ? (
        <div className="mx-auto mt-5 max-w-2xl text-center text-sm text-white/78">
          {homepageRunError}
        </div>
      ) : null}
    </div>
  );
}

function CompactWhyEdgazeWins() {
  return (
    <div className="mx-auto max-w-[1080px]">
      <CreatorSwitchMatrix />
    </div>
  );
}

type LandingDemoWorkflow = {
  id: string;
  title: string;
  description: string | null;
  owner_handle: string | null;
  edgaze_code: string | null;
  graph: any;
  cachedRunOutput: string;
};

function demoNode(
  id: string,
  specId: string,
  position: { x: number; y: number },
  data: { title: string; summary: string; config: Record<string, any>; type?: string },
) {
  return {
    id,
    type: data.type ?? "edgCard",
    position,
    data: {
      specId,
      title: data.title,
      version: "1.0.0",
      summary: data.summary,
      config: data.config,
      connectedNames: [],
    },
  };
}

function demoEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string) {
  const edge: Record<string, any> = {
    id: `e-${source}-${target}-${sourceHandle ?? "out"}-${targetHandle ?? "in"}`,
    source,
    target,
    type: "default",
  };
  if (sourceHandle) edge.sourceHandle = sourceHandle;
  if (targetHandle) edge.targetHandle = targetHandle;
  return edge;
}

function getWorkflowDefaultInputValues(workflow: LandingDemoWorkflow) {
  const defaults: Record<string, unknown> = {};
  for (const input of extractWorkflowInputs(workflow.graph?.nodes || [])) {
    defaults[input.nodeId] = input.defaultValue ?? "";
  }
  return defaults;
}

function getWorkflowOutputNode(workflow: LandingDemoWorkflow) {
  return (workflow.graph?.nodes || []).find((node: any) => node?.data?.specId === "output");
}

function getWorkflowPrimaryRunnerNode(workflow: LandingDemoWorkflow) {
  return (
    (workflow.graph?.nodes || []).find((node: any) => node?.data?.specId === "llm-chat") ??
    getWorkflowOutputNode(workflow)
  );
}

function normalizeHomepageInputValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

function buildDemoSvgDataUrl(title: string, subtitle: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" fill="none">
  <rect width="1200" height="900" rx="44" fill="#06080D"/>
  <rect width="1200" height="900" rx="44" fill="url(#bg)"/>
  <rect x="90" y="90" width="1020" height="720" rx="34" fill="rgba(11,14,20,0.82)" stroke="rgba(255,255,255,0.12)"/>
  <rect x="150" y="160" width="440" height="250" rx="28" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
  <rect x="640" y="160" width="410" height="500" rx="30" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)"/>
  <rect x="150" y="450" width="440" height="110" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
  <rect x="150" y="590" width="210" height="76" rx="20" fill="url(#cta)"/>
  <text x="150" y="122" fill="rgba(255,255,255,0.62)" font-size="24" font-family="Inter, Arial, sans-serif" letter-spacing="4">CREATIVE OUTPUT</text>
  <text x="150" y="230" fill="white" font-size="68" font-family="Inter, Arial, sans-serif" font-weight="700">${title}</text>
  <text x="150" y="305" fill="rgba(255,255,255,0.78)" font-size="30" font-family="Inter, Arial, sans-serif">${subtitle}</text>
  <text x="150" y="518" fill="rgba(255,255,255,0.78)" font-size="28" font-family="Inter, Arial, sans-serif">Generated from the homepage workflow demo</text>
  <text x="185" y="638" fill="#081018" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="700">Open marketplace</text>
  <circle cx="845" cy="318" r="94" fill="rgba(88,216,255,0.24)"/>
  <circle cx="914" cy="292" r="74" fill="rgba(244,114,182,0.24)"/>
  <circle cx="802" cy="430" r="64" fill="rgba(255,255,255,0.08)"/>
  <rect x="712" y="518" width="260" height="18" rx="9" fill="rgba(255,255,255,0.18)"/>
  <rect x="712" y="556" width="208" height="18" rx="9" fill="rgba(255,255,255,0.12)"/>
  <rect x="712" y="594" width="236" height="18" rx="9" fill="rgba(255,255,255,0.12)"/>
  <defs>
    <linearGradient id="bg" x1="132" y1="0" x2="1062" y2="900" gradientUnits="userSpaceOnUse">
      <stop stop-color="#10343D"/>
      <stop offset="0.52" stop-color="#0A0D13"/>
      <stop offset="1" stop-color="#31172A"/>
    </linearGradient>
    <linearGradient id="cta" x1="150" y1="590" x2="360" y2="666" gradientUnits="userSpaceOnUse">
      <stop stop-color="#58D8FF"/>
      <stop offset="1" stop-color="#F472B6"/>
    </linearGradient>
  </defs>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const HOMEPAGE_DEMO_CONTEXT_BASE = `${getSiteOrigin()}/api/homepage-demo-context`;

const HOME_DEMO_WORKFLOWS: LandingDemoWorkflow[] = [
  {
    id: "home-demo:launch-brief",
    title: "Launch page generator",
    description:
      "Builds a landing page from a rough brief, audience signal, and live page scaffolding.",
    owner_handle: "edgaze",
    edgaze_code: "launch-brief",
    cachedRunOutput: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Edgaze Launch Page</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #06080d;
        --panel: rgba(255,255,255,0.06);
        --border: rgba(255,255,255,0.12);
        --text: #f8fafc;
        --muted: rgba(248,250,252,0.72);
        --accent-a: #7566ff;
        --accent-b: #f36db6;
        --accent-c: rgba(255,255,255,0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        background:
          radial-gradient(circle at 18% 18%, rgba(38, 28, 82, 0.48), transparent 34%),
          radial-gradient(circle at 84% 20%, rgba(104, 33, 72, 0.42), transparent 36%),
          radial-gradient(circle at 54% 72%, rgba(255,255,255,0.03), transparent 32%),
          linear-gradient(180deg, #06080d, #0a0d13 58%, #05070c);
        color: var(--text);
      }
      .wrap {
        max-width: 1040px;
        margin: 0 auto;
        padding: 48px 24px 64px;
      }
      .hero {
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
        border-radius: 32px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0,0,0,0.42);
      }
      .hero-inner {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 28px;
        padding: 42px;
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.04);
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.66);
      }
      h1 {
        margin: 18px 0 0;
        font-size: clamp(2.4rem, 4vw, 4.2rem);
        line-height: 0.98;
      }
      p {
        margin: 16px 0 0;
        color: var(--muted);
        font-size: 1.05rem;
        line-height: 1.75;
      }
      .proof {
        display: grid;
        gap: 12px;
        margin-top: 26px;
      }
      .proof div, .metric, .panel, .cta {
        border: 1px solid var(--border);
        background: var(--panel);
        border-radius: 20px;
      }
      .proof div { padding: 14px 16px; }
      .cta-row {
        display: flex;
        gap: 12px;
        margin-top: 28px;
      }
      .cta {
        padding: 14px 18px;
        font-weight: 700;
        text-decoration: none;
        color: var(--text);
      }
      .cta.primary {
        background: linear-gradient(135deg, var(--accent-a), var(--accent-b));
        color: #f8fafc;
        box-shadow: 0 12px 40px rgba(117, 102, 255, 0.24);
      }
      .preview {
        display: grid;
        gap: 14px;
      }
      .metric-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .metric {
        padding: 14px 16px;
      }
      .metric strong {
        display: block;
        font-size: 1.25rem;
      }
      .panel {
        padding: 18px;
      }
      .mock {
        min-height: 260px;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.08);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
          linear-gradient(135deg, rgba(11,13,20,0.96), rgba(29,18,35,0.92));
        padding: 22px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .card {
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,0.08);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
          rgba(5,8,13,0.82);
        padding: 18px;
      }
      .stack { display: grid; gap: 12px; }
      @media (max-width: 860px) {
        .hero-inner { grid-template-columns: 1fr; padding: 28px; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="hero">
        <div class="hero-inner">
          <div>
            <span class="eyebrow">Creator storefront</span>
            <h1>Turn your prompts into products people can actually run.</h1>
            <p>Edgaze gives useful prompts and workflows a clean page, one link or code, and a marketplace where people can discover, trust, and buy them.</p>
            <div class="proof">
              <div>Publish prompts and workflows as clean product pages instead of screenshots and docs.</div>
              <div>Let people run what you built with less friction than dead prompt packs.</div>
              <div>Track what gets opened, run, and bought from one creator surface.</div>
            </div>
            <div class="cta-row">
              <a class="cta primary" href="#">Become a creator</a>
              <a class="cta" href="#">Open marketplace</a>
            </div>
          </div>
          <div class="preview">
            <div class="metric-grid">
              <div class="metric"><strong>847</strong><span>views</span></div>
              <div class="metric"><strong>203</strong><span>runs</span></div>
              <div class="metric"><strong>$1,847</strong><span>earnings</span></div>
            </div>
            <div class="mock">
              <div class="stack">
                <div class="card">
                  <strong style="display:block;font-size:1rem;">Landing page builder</strong>
                  <p style="margin-top:8px;">Inputs, run flow, pricing, and proof all in one polished surface.</p>
                </div>
                <div class="card">
                  <strong style="display:block;font-size:1rem;">Why this converts</strong>
                  <p style="margin-top:8px;">Buyers understand the value fast. Creators share one page instead of a messy thread.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </body>
</html>`,
    graph: {
      nodes: [
        demoNode(
          "brief",
          "input",
          { x: 40, y: 70 },
          {
            title: "Workflow Input",
            summary: "Core offer, audience, and promise.",
            config: {
              question: "What are you launching?",
              description: "Paste the product brief or positioning note.",
              inputType: "textarea",
              defaultValue:
                "Edgaze helps creators turn prompts and workflows into clean product pages people can discover, run, and buy.",
            },
          },
        ),
        demoNode(
          "audience",
          "input",
          { x: 40, y: 250 },
          {
            title: "Workflow Input",
            summary: "Who this page should persuade.",
            config: {
              question: "Who is this for?",
              description: "Describe the buyer in one sentence.",
              inputType: "text",
              defaultValue:
                "Independent creators already sharing prompts on Gumroad, X, or LinkedIn.",
            },
          },
        ),
        demoNode(
          "scaffold",
          "http-request",
          { x: 420, y: -20 },
          {
            title: "HTTP Request",
            summary: "Fetches a real layout brief, sections, and style constraints.",
            config: {
              method: "GET",
              url: `${HOMEPAGE_DEMO_CONTEXT_BASE}?workflow=launch-brief`,
              allowOnly: ["www.edgaze.ai", "localhost"],
              timeout: 12000,
            },
          },
        ),
        demoNode(
          "merge",
          "merge",
          { x: 430, y: 155 },
          {
            title: "Merge",
            summary: "Combine the brief and audience before writing.",
            config: {},
            type: "edgMerge",
          },
        ),
        demoNode(
          "merge-context",
          "merge",
          { x: 790, y: 70 },
          {
            title: "Merge",
            summary: "Combine the creator brief with the fetched scaffold.",
            config: {},
            type: "edgMerge",
          },
        ),
        demoNode(
          "planner",
          "llm-chat",
          { x: 1110, y: 70 },
          {
            title: "LLM Chat",
            summary: "Turns the brief and fetched scaffold into a structured page plan.",
            config: {
              system:
                "You are planning a premium landing page. Use both the creator brief and the fetched scaffold context. Return a concise launch plan with headline, subheading, proof points, metrics, CTA labels, and page sections. Do not use markdown fences.",
              prompt:
                "Use the merged creator brief plus the fetched scaffold context to create a landing page plan for the renderer.",
              model: "gpt-4o-mini",
              temperature: 0.45,
              maxTokens: 850,
              stream: true,
              safeMode: true,
            },
          },
        ),
        demoNode(
          "merge-render",
          "merge",
          { x: 1430, y: 70 },
          {
            title: "Merge",
            summary: "Combine the page plan with the fetched scaffold for rendering.",
            config: {},
            type: "edgMerge",
          },
        ),
        demoNode(
          "renderer",
          "llm-chat",
          { x: 1750, y: 70 },
          {
            title: "LLM Chat",
            summary:
              "Renders a polished landing page with believable structure and premium styling.",
            config: {
              system:
                "Return a compact standalone HTML document that renders on its own in a plain iframe. Include only: doctype, html, head with charset + viewport + title, one style tag, and a body. Do not include OG tags, twitter tags, external fonts, external CSS frameworks, Tailwind, React, Next.js, JavaScript, or markdown fences. Use semantic HTML, embedded CSS, a dark premium style, strong hierarchy, subtle gradients, believable metrics, and a clear creator-facing value proposition. Avoid cyan, teal, neon green, or bright startup gradients. Prefer near-black surfaces with restrained indigo, plum, rose, and soft white accents. If you are running out of space, simplify the page rather than truncating it. The response must always end with fully closed </style>, </body>, and </html> tags.",
              prompt:
                "Use the planning output and fetched scaffold to render a polished landing page HTML file with hero, proof points, metric cards, and CTA row. The result must be immediately previewable as a standalone HTML page. Keep the CSS compact and the page concise enough to finish cleanly in one response.",
              model: "gpt-4o-mini",
              temperature: 0.4,
              maxTokens: 3600,
              stream: true,
              safeMode: true,
            },
          },
        ),
        demoNode(
          "output",
          "output",
          { x: 2070, y: 70 },
          {
            title: "Workflow Output",
            summary: "Return a complete landing page HTML file.",
            config: { name: "Landing page", format: "html" },
          },
        ),
      ],
      edges: [
        demoEdge("brief", "merge", "out-right", "in-1"),
        demoEdge("audience", "merge", "out-right", "in-2"),
        demoEdge("merge", "merge-context", "out", "in-1"),
        demoEdge("scaffold", "merge-context", "out", "in-2"),
        demoEdge("merge-context", "planner", "out", "in"),
        demoEdge("planner", "merge-render", "out", "in-1"),
        demoEdge("scaffold", "merge-render", "out", "in-2"),
        demoEdge("merge-render", "renderer", "out", "in"),
        demoEdge("renderer", "output", "out", "in-left"),
      ],
    },
  },
  {
    id: "home-demo:campaign-image",
    title: "Campaign image composer",
    description: "Turns a concept and art direction into a polished campaign visual.",
    owner_handle: "edgaze",
    edgaze_code: "campaign-image",
    cachedRunOutput: buildDemoSvgDataUrl(
      "Edgaze Campaign Frame",
      "A polished hero visual generated from the homepage workflow demo.",
    ),
    graph: {
      nodes: [
        demoNode(
          "concept",
          "input",
          { x: 40, y: 90 },
          {
            title: "Workflow Input",
            summary: "The core image concept to generate.",
            config: {
              question: "What should the visual show?",
              description: "Describe the product or campaign moment.",
              inputType: "text",
              defaultValue:
                "A premium product page for an AI workflow marketplace on a dark glass interface",
            },
          },
        ),
        demoNode(
          "direction",
          "input",
          { x: 40, y: 260 },
          {
            title: "Workflow Input",
            summary: "The visual treatment and mood.",
            config: {
              question: "How should it feel?",
              description: "Keep it short and directional.",
              inputType: "text",
              defaultValue:
                "Ultra premium, cinematic lighting, subtle teal and rose gradients, crisp UI detail",
            },
          },
        ),
        demoNode(
          "visual-brief",
          "merge",
          { x: 360, y: 180 },
          {
            title: "Merge",
            summary: "Combine the concept and art direction.",
            config: {},
            type: "edgMerge",
          },
        ),
        demoNode(
          "director",
          "llm-chat",
          { x: 700, y: 180 },
          {
            title: "LLM Chat",
            summary: "Converts the brief into a sharp image-generation instruction.",
            config: {
              system:
                "Turn the inbound concept into a polished image generation prompt. Be precise about layout, subject, lighting, materials, composition, and premium product design cues. Return only the final prompt text.",
              prompt: "Create the final prompt for the image model.",
              model: "gpt-4o-mini",
              temperature: 0.5,
              maxTokens: 420,
              stream: true,
              safeMode: true,
            },
          },
        ),
        demoNode(
          "image",
          "llm-image",
          { x: 1030, y: 180 },
          {
            title: "LLM Image",
            summary: "Generates a campaign-ready visual from the directed prompt.",
            config: {
              model: "gpt-image-1",
              size: "1024x1024",
              quality: "low",
            },
          },
        ),
        demoNode(
          "output",
          "output",
          { x: 1360, y: 180 },
          {
            title: "Workflow Output",
            summary: "Return the generated image.",
            config: { name: "Campaign visual", format: "image" },
          },
        ),
      ],
      edges: [
        demoEdge("concept", "visual-brief", "out-right", "in-1"),
        demoEdge("direction", "visual-brief", "out-right", "in-2"),
        demoEdge("visual-brief", "director", "out", "in"),
        demoEdge("director", "image", "out", "in"),
        demoEdge("image", "output", "out", "in-left"),
      ],
    },
  },
  {
    id: "home-demo:market-signal",
    title: "Market signal brief",
    description: "Fetches live-style market context and turns it into a usable creator brief.",
    owner_handle: "edgaze",
    edgaze_code: "market-signal",
    cachedRunOutput: `Signal summary:
- Short video creators want cleaner ways to package prompts into products instead of dead files.
- Buyers respond fastest when the value, run state, and price are visible in one screen.

Recommended angle:
Lead with the workflow outcome first, then show the clean product page and one-link distribution.

Distribution move:
Ship the page, post one short demo clip, and share the Edgaze code in the caption and profile.`,
    graph: {
      nodes: [
        demoNode(
          "niche",
          "input",
          { x: 40, y: 90 },
          {
            title: "Workflow Input",
            summary: "The creator niche to evaluate.",
            config: {
              question: "What market are you targeting?",
              description: "Keep it specific.",
              inputType: "text",
              defaultValue: "AI prompt creators selling growth and content systems",
            },
          },
        ),
        demoNode(
          "channel",
          "input",
          { x: 40, y: 260 },
          {
            title: "Workflow Input",
            summary: "The audience acquisition channel to optimize for.",
            config: {
              question: "Where are you distributing?",
              description: "Example: X, LinkedIn, YouTube, or email.",
              inputType: "text",
              defaultValue: "X and LinkedIn",
            },
          },
        ),
        demoNode(
          "market-data",
          "http-request",
          { x: 430, y: 20 },
          {
            title: "HTTP Request",
            summary: "Pulls structured market context from a live endpoint.",
            config: {
              method: "GET",
              url: `${HOMEPAGE_DEMO_CONTEXT_BASE}?workflow=market-signal`,
              allowOnly: ["www.edgaze.ai", "localhost"],
              timeout: 12000,
            },
          },
        ),
        demoNode(
          "merge",
          "merge",
          { x: 420, y: 240 },
          {
            title: "Merge",
            summary: "Combine niche and channel before the brief is written.",
            config: {},
            type: "edgMerge",
          },
        ),
        demoNode(
          "merge-context",
          "merge",
          { x: 790, y: 150 },
          {
            title: "Merge",
            summary: "Combine the creator brief with the fetched market context.",
            config: {},
            type: "edgMerge",
          },
        ),
        demoNode(
          "analyst",
          "llm-chat",
          { x: 1120, y: 150 },
          {
            title: "LLM Chat",
            summary:
              "Combines fetched context with the creator brief and surfaces the strongest angle.",
            config: {
              system:
                "Use both the inbound creator brief and the fetched market context to create a tight market signal brief. Return signal summary, recommended angle, and one practical distribution move. Do not use markdown fences.",
              prompt: "Write the final market signal brief.",
              model: "gpt-4o-mini",
              temperature: 0.35,
              maxTokens: 650,
              stream: true,
              safeMode: true,
            },
          },
        ),
        demoNode(
          "output",
          "output",
          { x: 1450, y: 150 },
          {
            title: "Workflow Output",
            summary: "Return the final market brief.",
            config: { name: "Market brief", format: "text" },
          },
        ),
      ],
      edges: [
        demoEdge("niche", "merge", "out-right", "in-1"),
        demoEdge("channel", "merge", "out-right", "in-2"),
        demoEdge("merge", "merge-context", "out", "in-1"),
        demoEdge("market-data", "merge-context", "out", "in-2"),
        demoEdge("merge-context", "analyst", "out", "in"),
        demoEdge("analyst", "output", "out", "in-left"),
      ],
    },
  },
  {
    id: "home-demo:launch-pipeline",
    title: "Launch brief pipeline",
    description: "Builds a launch narrative, CTA set, and rollout notes from a product idea.",
    owner_handle: "edgaze",
    edgaze_code: "launch-pipeline",
    cachedRunOutput: `Primary message:
Turn the workflow into a product page people can actually run.

Proof points:
- One page instead of scattered screenshots and docs
- Clear run state, pricing, and trust in one screen
- Marketplace discovery plus link and code sharing

Launch sequence:
1. Publish the workflow page.
2. Share the Edgaze code in one short post.
3. Follow with a real run clip that shows the output.`,
    graph: {
      nodes: [
        demoNode(
          "offer",
          "input",
          { x: 40, y: 70 },
          {
            title: "Workflow Input",
            summary: "The product or system you are launching.",
            config: {
              question: "What are you launching?",
              description: "Keep it concrete and useful.",
              inputType: "text",
              defaultValue:
                "An AI workflow that turns creator prompts into clean, runnable product pages",
            },
          },
        ),
        demoNode(
          "proof",
          "input",
          { x: 40, y: 250 },
          {
            title: "Workflow Input",
            summary: "The strongest proof or outcome signal.",
            config: {
              question: "What proof should the launch use?",
              description: "Mention traction, runs, or user value.",
              inputType: "text",
              defaultValue:
                "Creators can publish once, share one link or code, and let buyers actually run the workflow",
            },
          },
        ),
        demoNode(
          "merge",
          "merge",
          { x: 360, y: 155 },
          {
            title: "Merge",
            summary: "Combine the offer and proof before planning.",
            config: {},
            type: "edgMerge",
          },
        ),
        demoNode(
          "hooks",
          "llm-chat",
          { x: 690, y: 25 },
          {
            title: "LLM Chat",
            summary: "Finds the strongest launch hooks and opening lines.",
            config: {
              system:
                "Create 3 concise launch hooks and a primary positioning line. Keep the tone sharp, premium, and credible. Do not use markdown fences.",
              prompt: "Use the merged offer and proof to draft the launch hooks.",
              model: "gpt-4o-mini",
              temperature: 0.45,
              maxTokens: 420,
              stream: true,
              safeMode: true,
            },
          },
        ),
        demoNode(
          "rollout",
          "llm-chat",
          { x: 1030, y: 240 },
          {
            title: "LLM Chat",
            summary: "Turns the hooks into a short launch sequence and CTA set.",
            config: {
              system:
                "Turn the inbound hooks and launch brief into a clear rollout note with primary message, proof points, and a 3-step launch sequence. Do not use markdown fences.",
              prompt: "Write the final launch brief.",
              model: "gpt-4o-mini",
              temperature: 0.4,
              maxTokens: 650,
              stream: true,
              safeMode: true,
            },
          },
        ),
        demoNode(
          "output",
          "output",
          { x: 1360, y: 240 },
          {
            title: "Workflow Output",
            summary: "Return the final launch brief.",
            config: { name: "Launch brief", format: "text" },
          },
        ),
      ],
      edges: [
        demoEdge("offer", "merge", "out-right", "in-1"),
        demoEdge("proof", "merge", "out-right", "in-2"),
        demoEdge("merge", "hooks", "out", "in"),
        demoEdge("merge", "rollout", "out", "in"),
        demoEdge("hooks", "rollout", "out", "in"),
        demoEdge("rollout", "output", "out", "in-left"),
      ],
    },
  },
];

function WorkflowStudioEmbedCard({
  workflow,
  compact = false,
  onRun,
  loading = false,
}: {
  workflow: LandingDemoWorkflow | null;
  compact?: boolean;
  onRun: (workflow: LandingDemoWorkflow) => void;
  loading?: boolean;
}) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<CanvasRef | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [previewPanEnabled, setPreviewPanEnabled] = useState(false);

  useEffect(() => {
    if (!isCanvasReady || !workflow?.graph) return;
    canvasRef.current?.loadGraph?.(workflow.graph);
  }, [isCanvasReady, workflow]);

  const handleCanvasRef = useCallback((instance: CanvasRef | null) => {
    canvasRef.current = instance;
    setIsCanvasReady(Boolean(instance));
  }, []);

  const frameHeight = compact ? "h-[280px] sm:h-[300px]" : "h-[420px] sm:h-[460px]";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[36px] opacity-70 blur-2xl [background-image:radial-gradient(circle_at_24%_22%,rgba(34,211,238,0.16),transparent_42%),radial-gradient(circle_at_78%_26%,rgba(236,72,153,0.14),transparent_44%)]" />
      <CardFrame
        className={cn(
          "relative overflow-hidden rounded-[34px]",
          compact ? "p-3 sm:p-4" : "p-4 sm:p-5",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090b10]",
            frameHeight,
          )}
        >
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-2.5 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:p-4">
            <div className="min-w-0 max-w-full rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(9,11,16,0.96),rgba(9,11,16,0.84))] px-3 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:max-w-[20rem]">
              <div className="max-w-full truncate pr-1 text-sm font-semibold text-white sm:max-w-[12rem]">
                {workflow?.title ?? (loading ? "Loading workflow" : "Workflow preview")}
              </div>
              {!compact && (
                <div className="mt-1 pr-1 text-[11px] leading-4 text-white/55 sm:max-w-[18rem] sm:truncate sm:text-xs">
                  {workflow?.description || "Published from Workflow Studio in read-only mode."}
                </div>
              )}
            </div>

            <div className="pointer-events-auto ml-auto flex items-center gap-2 rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(9,11,16,0.96),rgba(9,11,16,0.84))] px-2 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => setPreviewPanEnabled((value) => !value)}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-200 sm:h-9 sm:w-auto sm:px-3",
                  previewPanEnabled
                    ? "border-cyan-300/24 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(236,72,153,0.12))] text-white"
                    : "border-white/10 bg-white/5 text-white/78 hover:border-white/16 hover:bg-white/8",
                )}
                title={previewPanEnabled ? "Stop moving workflow" : "Enable workflow movement"}
                aria-label={previewPanEnabled ? "Stop moving workflow" : "Enable workflow movement"}
              >
                <Hand className="h-4 w-4 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">{previewPanEnabled ? "Moving" : "Move"}</span>
              </button>
              <button
                type="button"
                onClick={() => canvasRef.current?.fitViewToGraph?.()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white/82 transition-all duration-200 hover:border-white/16 hover:bg-white/8 sm:h-9 sm:w-auto sm:px-3"
                title="Recenter workflow"
                aria-label="Recenter workflow"
              >
                <Compass className="h-4 w-4 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Recenter</span>
              </button>
              <button
                type="button"
                onClick={() => workflow && onRun(workflow)}
                disabled={!workflow}
                className={cn(
                  "relative isolate inline-flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/12 bg-[#0b0d12] text-xs font-semibold text-white transition-all duration-200 sm:h-9 sm:w-auto sm:px-3.5",
                  workflow
                    ? "shadow-[0_0_22px_rgba(34,211,238,0.12)] hover:border-white/18 hover:shadow-[0_0_28px_rgba(34,211,238,0.16)]"
                    : "cursor-not-allowed border-white/10 bg-white/10 text-white/42 shadow-none",
                )}
                title="Run demo workflow"
                aria-label="Run demo workflow"
              >
                {workflow ? (
                  <>
                    <span className="absolute inset-[1px] rounded-full bg-[linear-gradient(135deg,rgba(110,226,247,0.96),rgba(230,96,171,0.9))]" />
                    <span className="absolute inset-[1px] rounded-full bg-[radial-gradient(circle_at_22%_30%,rgba(255,255,255,0.22),transparent_52%)]" />
                  </>
                ) : null}
                {workflow && !reduce ? (
                  <motion.span
                    className="pointer-events-none absolute inset-y-[1px] left-[-35%] w-[42%] skew-x-[-22deg] rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.28),rgba(255,255,255,0))]"
                    animate={{ x: ["-120%", "260%"] }}
                    transition={{
                      duration: 2.8,
                      ease: "linear",
                      repeat: Infinity,
                      repeatDelay: 1.4,
                    }}
                  />
                ) : null}
                <span className="relative inline-flex items-center gap-2">
                  <Play className="h-4 w-4 fill-current sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Run</span>
                </span>
              </button>
            </div>
          </div>

          <ReactFlowCanvas
            ref={handleCanvasRef}
            mode="preview"
            compact={compact}
            previewPanEnabled={previewPanEnabled}
          />
          {!previewPanEnabled ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
              <div className="rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(9,11,16,0.92),rgba(9,11,16,0.82))] px-3 py-1.5 text-[11px] font-medium text-white/52 shadow-[0_16px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                Scroll the page normally. Tap <span className="text-white/78">Move</span> to pan the
                graph.
              </div>
            </div>
          ) : null}
        </div>
      </CardFrame>
    </div>
  );
}

function FinalCta() {
  const reduce = useReducedMotion();
  return (
    <section
      id="final-cta"
      className="px-5 py-16 sm:py-20 md:py-24"
      style={{ scrollMarginTop: 92 }}
    >
      <Container wide>
        <motion.div
          className="relative overflow-hidden rounded-[38px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:p-9 md:p-10"
          animate={
            reduce
              ? undefined
              : {
                  boxShadow: [
                    "0 30px 120px rgba(0,0,0,0.42)",
                    "0 34px 140px rgba(34,211,238,0.18)",
                    "0 30px 120px rgba(0,0,0,0.42)",
                  ],
                }
          }
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="absolute -left-12 top-8 h-44 w-44 rounded-full opacity-60 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.28), transparent 60%)",
            }}
            animate={reduce ? undefined : { x: [0, 24, 0], y: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-0 top-0 h-52 w-52 rounded-full opacity-50 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgba(236,72,153,0.26), transparent 62%)",
            }}
            animate={reduce ? undefined : { x: [0, -20, 0], y: [0, 16, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative max-w-2xl">
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-[3rem] md:leading-[1.02]">
              The next creators to win will sell products, not prompt files.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-white/68">
              Publish on Edgaze and turn what you already built into something people can actually
              use.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton href="/welcome">Publish your workflow</PrimaryButton>
              <SecondaryButton href="/marketplace">Explore products</SecondaryButton>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}

function CodeEntry() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  type Suggestion = {
    kind: "prompt" | "workflow";
    owner_handle: string;
    edgaze_code: string;
    title: string;
    is_paid?: boolean | null;
    price_usd?: number | null;
  };

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "searching" | "going">("idle");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [verifiedByHandle, setVerifiedByHandle] = useState<Record<string, boolean>>({});
  const [openSug, setOpenSug] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const reqIdRef = useRef(0);

  const buildHref = (s: Suggestion) => {
    const handle = encodeURIComponent(s.owner_handle);
    const c = encodeURIComponent(s.edgaze_code);
    return s.kind === "prompt" ? `/p/${handle}/${c}` : `/${handle}/${c}`;
  };

  const fetchSuggestions = useCallback(
    async (queryRaw: string) => {
      const query = queryRaw.trim();
      if (!query) return [] as Suggestion[];

      const promptReq = supabase
        .from("prompts")
        .select("owner_handle, edgaze_code, title, is_paid, price_usd")
        .eq("is_published", true)
        .eq("is_public", true)
        .ilike("edgaze_code", `%${query}%`)
        .limit(6);

      const workflowReq = supabase
        .from("workflows")
        .select("owner_handle, edgaze_code, title, is_paid, price_usd")
        .eq("is_published", true)
        .eq("is_public", true)
        .ilike("edgaze_code", `%${query}%`)
        .limit(6);

      const [promptRes, workflowRes] = await Promise.all([promptReq, workflowReq]);

      const merged = [
        ...(promptRes.data || []).map((row: any) => ({
          kind: "prompt" as const,
          owner_handle: String(row.owner_handle || "").replace(/^@/, ""),
          edgaze_code: String(row.edgaze_code || ""),
          title: String(row.title || "Untitled"),
          is_paid: row.is_paid ?? null,
          price_usd: row.price_usd ?? null,
        })),
        ...(workflowRes.data || []).map((row: any) => ({
          kind: "workflow" as const,
          owner_handle: String(row.owner_handle || "").replace(/^@/, ""),
          edgaze_code: String(row.edgaze_code || ""),
          title: String(row.title || "Untitled"),
          is_paid: row.is_paid ?? null,
          price_usd: row.price_usd ?? null,
        })),
      ].filter((item) => item.owner_handle && item.edgaze_code);

      const seen = new Set<string>();
      return merged.filter((item) => {
        const key = `${item.kind}:${item.owner_handle}:${item.edgaze_code}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    [supabase],
  );

  useEffect(() => {
    const query = code.trim();
    setError("");

    if (!query) {
      setSuggestions([]);
      setOpenSug(false);
      setDismissed(false);
      setVerifiedByHandle({});
      setStatus("idle");
      return;
    }

    if (!dismissed) setOpenSug(true);
    setStatus("searching");
    const id = ++reqIdRef.current;

    const timer = window.setTimeout(async () => {
      try {
        const next = await fetchSuggestions(query);
        if (reqIdRef.current !== id) return;
        setSuggestions(next);
        setActiveIdx(0);
        const handles = [...new Set(next.map((item) => item.owner_handle.toLowerCase()))].filter(
          Boolean,
        );
        if (!handles.length) {
          setVerifiedByHandle({});
        } else {
          const { data } = await supabase
            .from("profiles")
            .select("handle, is_verified_creator")
            .in("handle", handles);
          const map: Record<string, boolean> = {};
          for (const row of data || []) {
            if (row?.handle) {
              map[String(row.handle).toLowerCase()] = Boolean(row.is_verified_creator);
            }
          }
          setVerifiedByHandle(map);
        }
      } catch {
        setSuggestions([]);
      } finally {
        if (reqIdRef.current === id) setStatus("idle");
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [code, dismissed, fetchSuggestions, supabase]);

  const closePanel = () => {
    setOpenSug(false);
    setDismissed(true);
  };

  const resolveExactAndGo = async () => {
    const query = code.trim();
    setError("");
    if (!query) {
      setError("Enter a code");
      return;
    }

    const selected = suggestions[activeIdx];
    if (openSug && selected && selected.edgaze_code.toLowerCase() === query.toLowerCase()) {
      router.push(buildHref(selected));
      return;
    }

    setStatus("going");
    const next = await fetchSuggestions(query);
    if (!next.length) {
      setStatus("idle");
      setOpenSug(true);
      setDismissed(false);
      setError("No match found. Try another code.");
      return;
    }

    if (next.length === 1) {
      router.push(buildHref(next[0]!));
      return;
    }

    setSuggestions(next);
    setOpenSug(true);
    setDismissed(false);
    setActiveIdx(0);
    setStatus("idle");
    setError("Multiple matches. Pick one.");
  };

  return (
    <div className="rounded-3xl bg-white/4 p-6 ring-1 ring-white/10 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">Enter an Edgaze code</div>
        <EdgazeCodeInfoPopover
          className="-mr-2"
          panelClassName="bg-[#090b10]/96 backdrop-blur-xl"
        />
      </div>
      <div className="mt-2 text-sm text-white/70">Open a prompt or workflow in seconds.</div>

      <div className="mt-5">
        <div className="flex gap-2">
          <div className="relative w-full">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setDismissed(false);
                setOpenSug(true);
              }}
              onFocus={() => {
                if (code.trim()) {
                  setDismissed(false);
                  setOpenSug(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void resolveExactAndGo();
                }
                if (e.key === "Escape") closePanel();
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((curr) => Math.min(suggestions.length - 1, curr + 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((curr) => Math.max(0, curr - 1));
                }
              }}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
              aria-label="Edgaze code"
            />

            <AnimatePresence initial={false}>
              {openSug ? (
                <motion.div
                  key="suggestions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl bg-[#0b0c11] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/12"
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <div className="text-[11px] font-semibold tracking-widest text-white/55">
                      SUGGESTIONS
                    </div>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-xl bg-white/6 px-2 py-1 text-[11px] text-white/75 ring-1 ring-white/10 hover:bg-white/8"
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-[260px] overflow-auto p-2">
                    {status === "searching" ? (
                      <div className="px-3 py-2 text-xs text-white/55">Searching...</div>
                    ) : null}

                    {suggestions.map((item, index) => {
                      const active = index === activeIdx;
                      const isFree = !item.is_paid;
                      const price = isFree ? "Free" : `$${Number(item.price_usd || 0).toFixed(2)}`;
                      return (
                        <button
                          key={`${item.kind}-${item.owner_handle}-${item.edgaze_code}`}
                          type="button"
                          onMouseEnter={() => setActiveIdx(index)}
                          onClick={() => router.push(buildHref(item))}
                          className={cn(
                            "w-full rounded-xl px-3 py-2 text-left transition-colors",
                            active ? "bg-white/8" : "hover:bg-white/6",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                                    item.kind === "prompt"
                                      ? "bg-cyan-500/10 text-cyan-200 ring-cyan-400/20"
                                      : "bg-pink-500/10 text-pink-200 ring-pink-400/20",
                                  )}
                                >
                                  {item.kind === "prompt" ? "Prompt" : "Workflow"}
                                </span>
                                <ProfileLink
                                  name={`@${item.owner_handle}`}
                                  handle={item.owner_handle}
                                  verified={Boolean(
                                    verifiedByHandle[item.owner_handle.toLowerCase()],
                                  )}
                                  verifiedSize="xs"
                                  className="min-w-0 truncate text-xs text-white/60"
                                />
                                <div className="text-xs text-white/40">.</div>
                                <div className="text-xs font-semibold text-white/70">
                                  {item.edgaze_code}
                                </div>
                              </div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {item.title}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "shrink-0 rounded-xl px-2.5 py-1 text-xs font-semibold",
                                isFree
                                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"
                                  : "bg-white/6 ring-1 ring-white/10 text-white",
                              )}
                            >
                              {price}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {!suggestions.length && status !== "searching" ? (
                      <div className="px-3 pb-3 pt-2 text-xs text-white/55">
                        No results found for this Edgaze code.
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => void resolveExactAndGo()}
            disabled={status === "going"}
            className={cn(
              "shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold text-white",
              "bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]",
              status === "going" ? "opacity-70" : "hover:opacity-95",
            )}
          >
            Open
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <AnimatePresence>
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="text-xs text-white/70"
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="text-xs text-white/45">
            {status === "searching" ? "Searching..." : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EdgazeLandingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId, authReady, loading, getAccessToken } = useAuth();

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rootMarketplaceRedirectRef = useRef(false);
  const runAbortRef = useRef<AbortController | null>(null);
  const runSessionPollRef = useRef<AbortController | null>(null);
  const cachedDemoTimersRef = useRef<number[]>([]);
  const lastAutoVerifiedTokenRef = useRef<string | null>(null);
  const [onTop, setOnTop] = useState(true);
  const [demoRunsUsed, setDemoRunsUsed] = useState(0);
  const [homepageRunError, setHomepageRunError] = useState<string | null>(null);
  const [activeDemoWorkflow, setActiveDemoWorkflow] = useState<LandingDemoWorkflow | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runState, setRunState] = useState<WorkflowRunState | null>(null);
  const [homepageCaptchaToken, setHomepageCaptchaToken] = useState("");
  const [homepageDemoVerified, setHomepageDemoVerified] = useState(false);
  const [homepageVerificationOpen, setHomepageVerificationOpen] = useState(false);
  const [homepageVerificationError, setHomepageVerificationError] = useState<string | null>(null);
  const [homepageVerificationPending, setHomepageVerificationPending] = useState(false);
  const [pendingDemoWorkflow, setPendingDemoWorkflow] = useState<LandingDemoWorkflow | null>(null);
  const [pendingDemoInputs, setPendingDemoInputs] = useState<Record<string, any> | null>(null);

  const maxHomepageDemoRuns = 6;
  const heroWorkflow = HOME_DEMO_WORKFLOWS[0] ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("edgaze-home-demo-runs-used");
    const next = Number(raw || 0);
    setDemoRunsUsed(Number.isFinite(next) ? next : 0);
  }, []);

  const persistDemoRuns = useCallback((next: number) => {
    setDemoRunsUsed(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("edgaze-home-demo-runs-used", String(next));
    }
  }, []);

  const clearCachedDemoTimers = useCallback(() => {
    for (const timer of cachedDemoTimersRef.current) {
      window.clearTimeout(timer);
    }
    cachedDemoTimersRef.current = [];
  }, []);

  const beginHomepageVerification = useCallback(
    (workflow: LandingDemoWorkflow, inputValues?: Record<string, any> | null) => {
      setHomepageDemoVerified(false);
      setHomepageRunError(null);
      setHomepageVerificationError(null);
      setPendingDemoWorkflow(workflow);
      setPendingDemoInputs(inputValues ? { ...inputValues } : null);
      setHomepageVerificationOpen(true);
    },
    [],
  );

  useEffect(() => {
    if (pathname !== "/") rootMarketplaceRedirectRef.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!authReady || loading) return;
    if (!userId) return;
    if (pathname !== "/") return;
    if (rootMarketplaceRedirectRef.current) return;
    rootMarketplaceRedirectRef.current = true;
    queueMicrotask(() => {
      startTransition(() => {
        router.replace("/marketplace");
      });
    });
  }, [authReady, loading, pathname, router, userId]);

  useEffect(() => {
    const onScroll = () => setOnTop(window.scrollY < 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll as any);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of cachedDemoTimersRef.current) {
        window.clearTimeout(timer);
      }
      cachedDemoTimersRef.current = [];
    };
  }, []);

  const executeHomepageDemo = useCallback(
    async (
      workflow: LandingDemoWorkflow,
      inputValues: Record<string, any>,
      baseState?: WorkflowRunState,
    ) => {
      const currentState = baseState ?? runState;
      if (!currentState) return;
      if (demoRunsUsed >= maxHomepageDemoRuns) {
        setHomepageRunError(
          "You are out of free runs. Explore workflows from the best creators in the marketplace.",
        );
        return;
      }

      clearCachedDemoTimers();
      const graph = workflow.graph;
      const processedInputs = { ...inputValues };
      const accessToken = await getAccessToken();

      setHomepageRunError(null);
      setRunState({
        ...currentState,
        homepageRunMode: "live",
        phase: "executing",
        status: "running",
        inputValues: processedInputs,
        startedAt: Date.now(),
        connectionState: "connecting",
        connectionLabel: "Connecting to execution...",
        lastEventAt: Date.now(),
      });

      try {
        runSessionPollRef.current?.abort();
        runSessionPollRef.current = null;

        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        runAbortRef.current = new AbortController();
        const response = await fetch("/api/flow/run", {
          method: "POST",
          headers,
          credentials: "include",
          signal: runAbortRef.current.signal,
          body: JSON.stringify({
            workflowId: workflow.id,
            nodes: graph.nodes || [],
            edges: graph.edges || [],
            inputs: processedInputs,
            isDemo: true,
            deviceFingerprint: getDeviceFingerprintHash(),
            isBuilderTest: false,
            stream: true,
            forceDemoModelTier: true,
          }),
        });

        if (!response.ok) {
          let errorData: any = { error: `HTTP ${response.status}: ${response.statusText}` };
          try {
            errorData = await response.json();
          } catch {}
          const responseError = String(errorData.error || errorData.message || "");
          if (
            response.status === 403 &&
            responseError.toLowerCase().includes("verification required")
          ) {
            setRunState((prev) =>
              prev
                ? {
                    ...prev,
                    phase: "input",
                    status: "idle",
                    error: undefined,
                    connectionState: "idle",
                    connectionLabel: "Verification required before demo run",
                  }
                : prev,
            );
            beginHomepageVerification(workflow, processedInputs);
            return;
          }
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        }

        persistDemoRuns(demoRunsUsed + 1);

        const streamResult = await handleWorkflowRunStream({
          response,
          accessToken,
          runSessionPollRef,
          setRunState,
          workflowId: workflow.id,
          workflowName: workflow.title,
          inputValues: processedInputs,
          sourceGraph: toRuntimeGraph(graph),
        });

        if (streamResult.handedOff) return;

        const result = streamResult.result;
        if (!result.ok) {
          throw new Error(result.error || result.message || "Execution failed");
        }

        const completion = finalizeClientWorkflowRunFromExecutionResult({
          executionResult: result.result,
          graphNodes: graph.nodes || [],
          processedInputs,
        });

        setRunState((prev) =>
          prev
            ? {
                ...prev,
                ...completion,
                graph: toRuntimeGraph(graph),
              }
            : prev,
        );
      } catch (error: any) {
        setRunState((prev) =>
          prev
            ? {
                ...prev,
                phase: "output",
                status: "error",
                error: error?.message || "Demo run failed",
                finishedAt: Date.now(),
                connectionState: "idle",
              }
            : prev,
        );
        setHomepageRunError(error?.message || "Demo run failed");
      }
    },
    [
      beginHomepageVerification,
      clearCachedDemoTimers,
      demoRunsUsed,
      getAccessToken,
      maxHomepageDemoRuns,
      persistDemoRuns,
      runState,
    ],
  );

  const simulateCachedHomepageDemo = useCallback(
    (
      workflow: LandingDemoWorkflow,
      inputValues: Record<string, any>,
      baseState?: WorkflowRunState,
    ) => {
      const currentState = baseState ?? runState;
      if (!currentState) return;
      if (demoRunsUsed >= maxHomepageDemoRuns) {
        setHomepageRunError(
          "You are out of free runs. Explore workflows from the best creators in the marketplace.",
        );
        return;
      }

      clearCachedDemoTimers();
      const outputNode = getWorkflowOutputNode(workflow);
      const activeNode = getWorkflowPrimaryRunnerNode(workflow);
      const outputNodeId = outputNode?.id ?? "output";
      const runnerNodeId = activeNode?.id ?? outputNodeId;
      const outputLabel = String(
        outputNode?.data?.config?.name || outputNode?.data?.title || "Result",
      );
      const fullText = workflow.cachedRunOutput;
      const chunks = fullText
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);

      setHomepageRunError(null);
      persistDemoRuns(demoRunsUsed + 1);
      setRunState({
        ...currentState,
        homepageRunMode: "cached",
        phase: "executing",
        status: "running",
        inputValues,
        outputs: [],
        outputsByNode: {},
        error: undefined,
        startedAt: Date.now(),
        finishedAt: undefined,
        connectionState: "live",
        connectionLabel: "Loading cached demo output...",
        lastEventAt: Date.now(),
        currentStepId: runnerNodeId,
        steps: [
          {
            id: runnerNodeId,
            title: String(activeNode?.data?.title || "Processing"),
            status: "running",
            timestamp: Date.now(),
          },
          {
            id: outputNodeId,
            title: outputLabel,
            status: "queued",
            timestamp: Date.now(),
          },
        ],
        liveTextByNode: {
          [runnerNodeId]: {
            nodeId: runnerNodeId,
            text: "",
            format: "markdown",
            status: "streaming",
            updatedAt: Date.now(),
          },
        },
      });

      chunks.forEach((chunk, index) => {
        const timer = window.setTimeout(
          () => {
            const partial = chunks.slice(0, index + 1).join("\n\n");
            setRunState((prev) =>
              prev
                ? {
                    ...prev,
                    liveTextByNode: {
                      ...(prev.liveTextByNode ?? {}),
                      [runnerNodeId]: {
                        nodeId: runnerNodeId,
                        text: partial,
                        format: "markdown",
                        status: index === chunks.length - 1 ? "committed" : "streaming",
                        updatedAt: Date.now(),
                        ...(index === chunks.length - 1 ? { completedAt: Date.now() } : {}),
                      },
                    },
                    lastEventAt: Date.now(),
                  }
                : prev,
            );
          },
          300 + index * 520,
        );
        cachedDemoTimersRef.current.push(timer);
      });

      const completeTimer = window.setTimeout(
        () => {
          setRunState((prev) =>
            prev
              ? {
                  ...prev,
                  homepageRunMode: "cached",
                  phase: "output",
                  status: "success",
                  currentStepId: outputNodeId,
                  finishedAt: Date.now(),
                  connectionState: "idle",
                  connectionLabel: "Cached demo ready",
                  summary: "Loaded a cached result for the prefilled demo inputs.",
                  outputsByNode: { [outputNodeId]: fullText },
                  outputs: [
                    { nodeId: outputNodeId, label: outputLabel, value: fullText, type: "markdown" },
                  ],
                  steps: [
                    {
                      id: runnerNodeId,
                      title: String(activeNode?.data?.title || "Processing"),
                      status: "done",
                      timestamp: prev.startedAt,
                    },
                    {
                      id: outputNodeId,
                      title: outputLabel,
                      status: "done",
                      timestamp: Date.now(),
                    },
                  ],
                  liveTextByNode: {
                    ...(prev.liveTextByNode ?? {}),
                    [runnerNodeId]: {
                      nodeId: runnerNodeId,
                      text: fullText,
                      format: "markdown",
                      status: "committed",
                      updatedAt: Date.now(),
                      completedAt: Date.now(),
                    },
                  },
                }
              : prev,
          );
          clearCachedDemoTimers();
        },
        300 + chunks.length * 520 + 160,
      );
      cachedDemoTimersRef.current.push(completeTimer);
    },
    [clearCachedDemoTimers, demoRunsUsed, maxHomepageDemoRuns, persistDemoRuns, runState],
  );

  const launchHomepageDemo = useCallback(
    (workflow: LandingDemoWorkflow) => {
      const inputs = extractWorkflowInputs(workflow.graph?.nodes || []);
      const initialState: WorkflowRunState = {
        workflowId: workflow.id,
        workflowName: workflow.title,
        homepageRunMode: "cached",
        phase: inputs.length > 0 ? "input" : "executing",
        status: "idle",
        steps: [],
        graph: toRuntimeGraph(workflow.graph) ?? { nodes: [], edges: [] },
        logs: [],
        inputs,
      };

      setHomepageRunError(null);
      setActiveDemoWorkflow(workflow);
      setRunState(initialState);
      setRunModalOpen(true);

      if (inputs.length === 0) {
        queueMicrotask(() => {
          void executeHomepageDemo(workflow, {}, initialState);
        });
      }
    },
    [executeHomepageDemo],
  );

  const openHomepageDemo = useCallback(
    (workflow: LandingDemoWorkflow) => {
      if (demoRunsUsed >= maxHomepageDemoRuns) {
        setHomepageRunError(
          "You are out of free runs. Explore workflows from the best creators in the marketplace.",
        );
        return;
      }

      if (!homepageDemoVerified) {
        beginHomepageVerification(workflow);
        return;
      }

      launchHomepageDemo(workflow);
    },
    [
      beginHomepageVerification,
      demoRunsUsed,
      homepageDemoVerified,
      launchHomepageDemo,
      maxHomepageDemoRuns,
    ],
  );

  const completeHomepageVerification = useCallback(async () => {
    if (!homepageCaptchaToken) {
      setHomepageVerificationError("Complete the verification check before running a demo.");
      return;
    }

    setHomepageVerificationPending(true);
    setHomepageVerificationError(null);

    try {
      const response = await fetch("/api/turnstile/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: homepageCaptchaToken }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Verification failed");
      }

      setHomepageDemoVerified(true);
      setHomepageVerificationOpen(false);
      setHomepageCaptchaToken("");

      const nextWorkflow = pendingDemoWorkflow;
      const nextInputs = pendingDemoInputs;
      setPendingDemoWorkflow(null);
      setPendingDemoInputs(null);
      if (nextWorkflow && nextInputs) {
        queueMicrotask(() => {
          launchHomepageDemo(nextWorkflow);
          window.setTimeout(() => {
            void executeHomepageDemo(nextWorkflow, nextInputs);
          }, 0);
        });
        return;
      }
      if (nextWorkflow) queueMicrotask(() => launchHomepageDemo(nextWorkflow));
    } catch (error: any) {
      setHomepageVerificationError(error?.message || "Verification failed");
    } finally {
      setHomepageVerificationPending(false);
    }
  }, [
    executeHomepageDemo,
    homepageCaptchaToken,
    launchHomepageDemo,
    pendingDemoInputs,
    pendingDemoWorkflow,
  ]);

  useEffect(() => {
    if (!homepageVerificationOpen) {
      lastAutoVerifiedTokenRef.current = null;
      return;
    }
    if (!homepageCaptchaToken) return;
    if (homepageVerificationPending) return;
    if (lastAutoVerifiedTokenRef.current === homepageCaptchaToken) return;

    lastAutoVerifiedTokenRef.current = homepageCaptchaToken;
    void completeHomepageVerification();
  }, [
    completeHomepageVerification,
    homepageCaptchaToken,
    homepageVerificationOpen,
    homepageVerificationPending,
  ]);

  const rerunHomepageDemo = useCallback(() => {
    if (!activeDemoWorkflow || !runState?.inputValues) return;
    if (runState.homepageRunMode === "cached") {
      simulateCachedHomepageDemo(activeDemoWorkflow, runState.inputValues, runState);
      return;
    }
    void executeHomepageDemo(activeDemoWorkflow, runState.inputValues, runState);
  }, [activeDemoWorkflow, executeHomepageDemo, runState, simulateCachedHomepageDemo]);

  const cancelHomepageDemo = useCallback(() => {
    clearCachedDemoTimers();
    if (runAbortRef.current) runAbortRef.current.abort();
    if (runSessionPollRef.current) runSessionPollRef.current.abort();
    setRunState((prev) => (prev ? { ...prev, status: "cancelling" } : prev));
  }, [clearCachedDemoTimers]);

  const redirecting = authReady && !loading && !!userId && pathname !== "/marketplace";

  if (redirecting) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#07080b",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={80} height={80} priority />
          <div style={{ fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>
            Edgaze
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollContext.Provider value={{ scrollerRef }}>
      <div className="relative min-h-screen overflow-x-hidden text-white">
        <Gradients />
        <LandingNav onTop={onTop} scrollerRef={scrollerRef} />

        <section
          id="top"
          className="relative overflow-hidden px-5 pb-16 pt-32 sm:pb-20 sm:pt-36 md:pt-[10.5rem] lg:pt-[12rem]"
          style={{ scrollMarginTop: 92 }}
        >
          <div className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_14%_18%,rgba(34,211,238,0.18),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(126,36,84,0.2),transparent_28%)]" />
          <Container wide>
            <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(620px,1.02fr)] xl:items-start xl:gap-12">
              <div className="max-w-[48rem]">
                <Reveal>
                  <div className="max-w-2xl">
                    <CodeEntry />
                  </div>
                </Reveal>
                <Reveal delay={0.04}>
                  <h1 className="mt-8 max-w-[14ch] text-4xl font-semibold tracking-[-0.04em] text-white sm:mt-10 sm:text-5xl lg:max-w-[15ch] lg:text-[4.6rem] lg:leading-[0.94]">
                    <span className="block">Sell AI workflows</span>
                    <span className="block py-[0.08em]">
                      <RotatingText
                        phrases={["that run", "that convert", "that people use", "that get paid"]}
                      />
                    </span>
                  </h1>
                </Reveal>
                <Reveal delay={0.1}>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-white/66 sm:text-lg">
                    Turn your prompt, template, or workflow into a product page people can try, buy,
                    and share.
                  </p>
                </Reveal>
                <Reveal delay={0.14}>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <PrimaryButton href="/welcome">Create your first product</PrimaryButton>
                    <SecondaryButton href="/marketplace">See live examples</SecondaryButton>
                  </div>
                </Reveal>
              </div>

              <Reveal delay={0.08}>
                <ProductTransformationSurface />
              </Reveal>
            </div>
          </Container>
        </section>

        <Section
          id="how-it-works"
          wide
          eyebrow="How it works"
          title="Start with what you already made."
          desc="Turn it into something people can try, buy, and share."
        >
          <HowItWorksConnectedSection />
        </Section>

        <Section
          id="run-it"
          wide
          title="Buyers can understand it before they buy it."
          desc="They see the inputs, preview the result, and run the workflow in one place."
        >
          <Reveal>
            <ProductProofSection
              workflow={heroWorkflow}
              onRun={openHomepageDemo}
              homepageRunError={homepageRunError}
            />
          </Reveal>
        </Section>

        <Section
          id="why-switch"
          wide
          eyebrow="Why Edgaze wins"
          title="Files explain. Edgaze lets people use it."
          desc="Prompt packs, PDFs, and Notion docs make buyers imagine the result. Edgaze lets them run the workflow before they buy."
        >
          <Reveal>
            <CompactWhyEdgazeWins />
          </Reveal>
        </Section>

        <Section
          id="storefront"
          wide
          eyebrow="Creator upside"
          title="Earn from workflows people actually use."
          desc="Publish once, share one page, and track earnings tied to the product itself."
        >
          <Reveal>
            <CreatorDashboardSurface />
          </Reveal>
        </Section>

        <TrendingThisWeekSection />

        <FinalCta />

        <CustomerWorkflowRunModal
          open={runModalOpen}
          state={runState}
          demoImageWatermarkEnabled
          demoImageWatermarkOwnerHandle={activeDemoWorkflow?.owner_handle || "edgaze"}
          onClose={() => {
            if (runState?.status !== "running" && runState?.status !== "cancelling") {
              clearCachedDemoTimers();
              runSessionPollRef.current?.abort();
              runSessionPollRef.current = null;
              runAbortRef.current?.abort();
              runAbortRef.current = null;
              setRunModalOpen(false);
              setRunState(null);
              setActiveDemoWorkflow(null);
            }
          }}
          onCancel={cancelHomepageDemo}
          onRerun={rerunHomepageDemo}
          onSubmitInputs={(values) => {
            if (!activeDemoWorkflow) return;
            const payload = { ...values } as Record<string, any>;
            const forceLiveRun = payload.__homepageForceLiveRun === true;
            delete payload.__homepageForceLiveRun;

            const defaultValues = getWorkflowDefaultInputValues(activeDemoWorkflow);
            const matchesPrefill = Object.keys(defaultValues).every(
              (key) =>
                normalizeHomepageInputValue(payload[key]) ===
                normalizeHomepageInputValue(defaultValues[key]),
            );

            if (!forceLiveRun && matchesPrefill) {
              simulateCachedHomepageDemo(activeDemoWorkflow, payload, runState ?? undefined);
              return;
            }

            void executeHomepageDemo(activeDemoWorkflow, payload);
          }}
        />

        <AnimatePresence>
          {homepageVerificationOpen ? (
            <motion.div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-5 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#0b0c11]/96 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.985 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <div className="text-xs font-semibold tracking-[0.18em] text-white/44">
                  RUN VERIFICATION
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  Verify before you run a homepage demo.
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/66">
                  These demos are protected to keep automated abuse out. Verify once, then you can
                  use up to three prefilled demo runs from this page.
                </p>

                <div className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                  <TurnstileWidget onToken={setHomepageCaptchaToken} />
                </div>

                {homepageVerificationError ? (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {homepageVerificationError}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={completeHomepageVerification}
                    disabled={homepageVerificationPending || !homepageCaptchaToken}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white",
                      homepageVerificationPending || !homepageCaptchaToken
                        ? "cursor-not-allowed bg-white/10 text-white/40"
                        : "bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))] hover:opacity-95",
                    )}
                  >
                    {homepageVerificationPending ? "Verifying..." : "Verify and continue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHomepageVerificationOpen(false);
                      setPendingDemoWorkflow(null);
                      setPendingDemoInputs(null);
                      setHomepageCaptchaToken("");
                      setHomepageVerificationError(null);
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-white/5 px-5 py-3 text-sm font-semibold text-white/86 ring-1 ring-white/10 transition-colors hover:bg-white/8"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <footer className="px-5 pb-16">
          <Container wide>
            <Footer />
          </Container>
        </footer>

        <div className="h-10 md:hidden" />
      </div>
    </ScrollContext.Provider>
  );
}
