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
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgeCheck, Compass, Hand, Link2, Search } from "lucide-react";
import { useAuth } from "src/components/auth/AuthContext";
import TurnstileWidget from "src/components/apply/TurnstileWidget";
import { LandingNav } from "src/components/landing-nav";
import Footer from "src/components/layout/Footer";
import EdgazeCodeInfoPopover from "src/components/ui/EdgazeCodeInfoPopover";
import ProfileLink from "src/components/ui/ProfileLink";
import { createSupabaseBrowserClient } from "src/lib/supabase/browser";
import { getSiteOrigin } from "src/lib/site-origin";
import TrendingThisWeekSection from "src/components/home/TrendingThisWeekSection";
import ReactFlowCanvas, { type CanvasRef } from "src/components/builder/ReactFlowCanvas";
import CustomerWorkflowRunModal from "src/components/runtime/customer/CustomerWorkflowRunModal";
import { extractWorkflowInputs } from "src/lib/workflow/input-extraction";
import { toRuntimeGraph } from "src/lib/workflow/customer-runtime";
import { handleWorkflowRunStream } from "src/lib/workflow/run-stream-client";
import { finalizeClientWorkflowRunFromExecutionResult } from "src/lib/workflow/finalize-client-run-result";
import { getDeviceFingerprintHash } from "src/lib/workflow/device-tracking";
import type { WorkflowRunState } from "src/lib/workflow/run-types";

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
      <div className="absolute inset-0 -z-10 opacity-[0.52] [background-image:radial-gradient(circle_at_16%_10%,rgba(21,62,69,0.72),transparent_30%),radial-gradient(circle_at_84%_10%,rgba(82,32,58,0.64),transparent_34%),radial-gradient(circle_at_20%_58%,rgba(13,42,49,0.32),transparent_34%),radial-gradient(circle_at_82%_66%,rgba(50,22,41,0.26),transparent_38%)]" />
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

function HowItWorksSticky() {
  const reduce = useReducedMotion();
  const labels = ["Prompt or workflow", "Becomes product page", "People run or buy"];
  const descriptions = [
    "Start with the thing you already share.",
    "Edgaze turns it into a clean page people can trust.",
    "Now it can be opened, used, and paid for.",
  ];

  return (
    <section
      id="how-it-works"
      className="px-5 py-16 sm:py-20 md:py-24"
      style={{ scrollMarginTop: 92 }}
    >
      <Container wide>
        <div className="rounded-[34px] bg-white/[0.035] ring-1 ring-white/10 p-6 sm:p-8 md:p-10">
          <div className="max-w-xl">
            <div className="text-xs font-semibold tracking-widest text-white/55">How it works</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Publish once. Let people use it.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/70">
              The page should explain itself before the user has to think.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-center">
            <div className="space-y-4">
              {labels.map((label, index) => {
                return (
                  <motion.div
                    key={label}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-5 transition-colors"
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
                  >
                    <div className="text-[11px] font-semibold tracking-[0.18em] text-white/42">
                      STEP {index + 1}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">{label}</div>
                    <div className="mt-2 text-sm leading-6 text-white/66">
                      {descriptions[index]}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="rounded-[32px] bg-[#0b0c11] ring-1 ring-white/10 p-5 sm:p-6">
              <div className="relative h-[340px] overflow-hidden rounded-[28px] bg-white/[0.03] ring-1 ring-white/10 sm:h-[380px]">
                <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:52px_52px]" />
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 900 380"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M170 190 C 280 190, 315 190, 430 190"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    d="M470 190 C 575 190, 610 190, 730 190"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="2"
                    fill="none"
                  />
                  {!reduce ? (
                    <motion.circle
                      cx={170}
                      cy={190}
                      r="6"
                      fill="rgba(255,255,255,0.88)"
                      animate={{ cx: [170, 430, 730], cy: [190, 190, 190] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : null}
                </svg>

                <motion.div
                  className="absolute left-[6%] top-1/2 w-[210px] -translate-y-1/2 rounded-3xl bg-black/65 p-4 ring-1 ring-white/12"
                  animate={!reduce ? { scale: [1, 1.02, 1] } : undefined}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="text-[10px] font-semibold tracking-[0.22em] text-white/42">
                    INPUT
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">Resume rewrite prompt</div>
                  <div className="mt-2 text-xs leading-5 text-white/62">
                    Rewrite this experience for product marketing roles.
                  </div>
                </motion.div>

                <motion.div
                  className="absolute left-1/2 top-1/2 w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-[#0f1117] p-5 ring-1 ring-white/14"
                  animate={!reduce ? { scale: [1, 1.025, 1] } : undefined}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                >
                  <div className="text-[10px] font-semibold tracking-[0.22em] text-white/42">
                    PRODUCT PAGE
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">Resume rewrite</div>
                  <div className="mt-1 text-xs leading-5 text-white/62">
                    Clear inputs. Preview. One clean page.
                  </div>
                  <div className="mt-4 flex gap-2">
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-semibold text-white">
                      $12
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-semibold text-white/72">
                      Share
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute right-[6%] top-1/2 w-[210px] -translate-y-1/2 rounded-3xl bg-black/65 p-4 ring-1 ring-white/12"
                  animate={!reduce ? { scale: [1, 1.02, 1] } : undefined}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                >
                  <div className="text-[10px] font-semibold tracking-[0.22em] text-white/42">
                    ACTION
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">Run or buy</div>
                    <div className="rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))] px-3 py-1 text-[11px] font-semibold text-white">
                      Run
                    </div>
                  </div>
                  <div className="mt-3 text-xs leading-5 text-white/62">
                    Buyers understand it fast and can use it right away.
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function MarketplaceShowcase() {
  const reduce = useReducedMotion();
  const items = [
    { title: "Resume rewrite", type: "Prompt", price: "$12", runs: "1,204 runs" },
    { title: "YouTube script generator", type: "Workflow", price: "$19", runs: "842 runs" },
    { title: "Study planner", type: "Prompt", price: "Free", runs: "619 runs" },
    { title: "Client proposal flow", type: "Workflow", price: "$24", runs: "441 runs" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4">
        <TextCard title="Show up where intent already exists">
          <p>People do not need a thread or a PDF to understand what you made.</p>
        </TextCard>
        <TextCard title="Make action obvious">
          <p>Pricing, description, runs, and the next step all live in one screen.</p>
        </TextCard>
      </div>

      <CardFrame className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Marketplace</div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
            <Search className="h-4 w-4 text-white/75" />
            <div className="text-xs text-white/70">Search prompts and workflows</div>
          </div>
        </div>

        <motion.div
          className="mt-5 grid gap-3 sm:grid-cols-2"
          animate={reduce ? undefined : { x: [0, -6, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          {items.map((item, index) => (
            <motion.div
              key={item.title}
              className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.45, delay: index * 0.04, ease: "easeOut" }}
              whileHover={reduce ? undefined : { y: -4, scale: 1.01, filter: "brightness(1.05)" }}
            >
              {index === 0 ? (
                <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/60">
                  Best match
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-xs text-white/58">{item.type}</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-semibold text-white">
                  {item.price}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-white/55">
                <span>{item.runs}</span>
                <span className="text-white/72">Open</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </CardFrame>
    </div>
  );
}

function PromptTransformVisual() {
  const reduce = useReducedMotion();
  return (
    <CardFrame className="p-5 sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_40px_minmax(0,1.1fr)] lg:items-center">
        <div className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10">
          <div className="text-[10px] font-semibold tracking-[0.22em] text-white/42">
            RAW PROMPT
          </div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-white/72">
            <div className="rounded-2xl bg-white/[0.03] px-3 py-2">
              Write a better landing page headline
            </div>
            <div className="rounded-2xl bg-white/[0.03] px-3 py-2">
              Ask for audience, tone, and offer
            </div>
            <div className="rounded-2xl bg-white/[0.03] px-3 py-2">Return three usable options</div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <motion.div
            className="h-9 w-9 rounded-full bg-white/8 ring-1 ring-white/10"
            animate={reduce ? undefined : { x: [0, 4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.22em] text-white/42">
                PRODUCT PAGE
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                Landing page headline writer
              </div>
              <div className="mt-1 text-sm text-white/64">
                Inputs, examples, output preview, and a clear run button.
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-semibold text-white">
              $9
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <TinyStat label="VIEWS" value="847" />
            <TinyStat label="LIKES" value="61" />
            <TinyStat label="RUNS" value="203" />
          </div>
        </div>
      </div>
    </CardFrame>
  );
}

function WorkflowExecutionVisual() {
  const reduce = useReducedMotion();
  const nodes = [
    { id: "a", label: "Input", x: 56, y: 72 },
    { id: "b", label: "Prompt", x: 230, y: 54 },
    { id: "c", label: "Tool", x: 420, y: 98 },
    { id: "d", label: "Format", x: 248, y: 194 },
    { id: "e", label: "Output", x: 442, y: 214 },
  ];

  return (
    <CardFrame className="p-5 sm:p-6">
      <div className="relative h-[320px] overflow-hidden rounded-[28px] bg-white/[0.03] ring-1 ring-white/10">
        <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:52px_52px]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 320" aria-hidden>
          <path d="M150 112 L 230 96" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <path d="M350 96 L 420 136" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <path d="M315 150 L 328 194" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <path d="M398 232 L 442 232" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          {!reduce ? (
            <motion.circle
              cx={150}
              cy={112}
              r="5"
              fill="rgba(255,255,255,0.88)"
              animate={{
                cx: [150, 230, 420, 328, 442],
                cy: [112, 96, 136, 194, 232],
              }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
        </svg>

        {nodes.map((node, index) => (
          <motion.div
            key={node.id}
            className="absolute w-[132px] rounded-3xl bg-black/70 p-4 ring-1 ring-white/12"
            style={{ left: node.x, top: node.y }}
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
            whileInView={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
          >
            <div className="text-[10px] font-semibold tracking-[0.22em] text-white/42">NODE</div>
            <div className="mt-2 text-sm font-semibold text-white">{node.label}</div>
          </motion.div>
        ))}
      </div>
    </CardFrame>
  );
}

function ClarityCards() {
  const cards = [
    ["Clear pages", "People should know the value in one screen."],
    ["Clean discovery", "Browsing should feel fast and easy to trust."],
    ["Professional polish", "Motion, layout, and copy all support action."],
  ];

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {cards.map(([title, body], index) => (
        <Reveal key={title} delay={index * 0.05}>
          <TextCard title={title}>
            <p>{body}</p>
          </TextCard>
        </Reveal>
      ))}
    </div>
  );
}

function TextCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-3 text-sm leading-relaxed text-white/70">{children}</div>
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
  const canvasRef = useRef<CanvasRef | null>(null);
  const [previewPanEnabled, setPreviewPanEnabled] = useState(false);

  useEffect(() => {
    if (!workflow?.graph) return;
    canvasRef.current?.loadGraph?.(workflow.graph);
  }, [workflow]);

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
          <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
            <div className="min-w-0 rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(9,11,16,0.96),rgba(9,11,16,0.84))] px-3 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
              <div className="max-w-[12rem] truncate text-sm font-semibold text-white">
                {workflow?.title ?? (loading ? "Loading workflow" : "Workflow preview")}
              </div>
              {!compact ? (
                <div className="mt-1 max-w-[18rem] truncate text-xs text-white/55">
                  {workflow?.description || "Published from Workflow Studio in read-only mode."}
                </div>
              ) : null}
            </div>

            <div className="pointer-events-auto flex items-center gap-2 rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(9,11,16,0.96),rgba(9,11,16,0.84))] px-2 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => setPreviewPanEnabled((value) => !value)}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold transition-colors",
                  previewPanEnabled
                    ? "border-cyan-300/22 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(236,72,153,0.12))] text-white"
                    : "border-white/10 bg-white/5 text-white/72 hover:bg-white/8",
                )}
                title={previewPanEnabled ? "Stop moving workflow" : "Enable workflow movement"}
              >
                <Hand className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{previewPanEnabled ? "Moving" : "Move"}</span>
              </button>
              <button
                type="button"
                onClick={() => canvasRef.current?.fitViewToGraph?.()}
                className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/82 transition-colors hover:bg-white/8"
                title="Recenter workflow"
              >
                <Compass className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Recenter</span>
              </button>
              <button
                type="button"
                onClick={() => workflow && onRun(workflow)}
                disabled={!workflow}
                className={cn(
                  "relative inline-flex h-9 items-center justify-center overflow-hidden rounded-full px-3.5 text-xs font-semibold text-white transition-opacity",
                  workflow
                    ? "bg-[linear-gradient(135deg,rgba(34,211,238,0.96),rgba(236,72,153,0.9))] shadow-[0_0_22px_rgba(34,211,238,0.22)] hover:opacity-95"
                    : "cursor-not-allowed bg-white/10 text-white/42",
                )}
                title="Run demo workflow"
              >
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_22%_30%,rgba(255,255,255,0.22),transparent_52%)]" />
                <span className="relative inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                  Run
                </span>
              </button>
            </div>
          </div>

          <ReactFlowCanvas
            ref={canvasRef}
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
          className="relative overflow-hidden rounded-[36px] bg-white/[0.045] p-7 ring-1 ring-white/10 sm:p-9 md:p-10"
          animate={
            reduce
              ? undefined
              : {
                  boxShadow: [
                    "0 0 0 rgba(34,211,238,0.04)",
                    "0 0 56px rgba(34,211,238,0.08)",
                    "0 0 0 rgba(34,211,238,0.04)",
                  ],
                }
          }
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="absolute -left-12 top-8 h-40 w-40 rounded-full opacity-60 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.24), transparent 60%)",
            }}
            animate={reduce ? undefined : { x: [0, 24, 0], y: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-0 top-0 h-52 w-52 rounded-full opacity-50 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgba(236,72,153,0.22), transparent 62%)",
            }}
            animate={reduce ? undefined : { x: [0, -20, 0], y: [0, 16, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative max-w-2xl">
            <div className="text-xs font-semibold tracking-widest text-white/55">Start here</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Start publishing. See what people actually use.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/70">
              If you already have prompts or workflows, you are ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton href="/apply">Become a creator</PrimaryButton>
              <SecondaryButton href="/marketplace">Open marketplace</SecondaryButton>
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
            if (row?.handle)
              map[String(row.handle).toLowerCase()] = Boolean(row.is_verified_creator);
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
    <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7">
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
                  resolveExactAndGo();
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
              className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
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
                  className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl bg-[#0b0c11] ring-1 ring-white/12 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <div className="text-[11px] font-semibold tracking-widest text-white/55">
                      SUGGESTIONS
                    </div>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-xl bg-white/6 ring-1 ring-white/10 px-2 py-1 text-[11px] text-white/75 hover:bg-white/8"
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-[260px] overflow-auto p-2">
                    {status === "searching" ? (
                      <div className="px-3 py-2 text-xs text-white/55">Searching…</div>
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
                                <div className="text-xs text-white/40">·</div>
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
                      <div className="px-3 pt-2 pb-3 text-xs text-white/55">
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
            onClick={resolveExactAndGo}
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
          <div className="text-xs text-white/45">{status === "searching" ? "Searching…" : ""}</div>
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
  const sectionWorkflows = HOME_DEMO_WORKFLOWS.slice(1, 4);

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
          className="relative overflow-hidden px-5 pb-14 pt-32 sm:pt-36 sm:pb-16 md:pt-44 lg:pt-52"
          style={{ scrollMarginTop: 92 }}
        >
          <div className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_18%_24%,rgba(20,44,48,0.22),transparent_30%),radial-gradient(circle_at_88%_22%,rgba(71,30,49,0.2),transparent_34%)]" />
          <Container wide>
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start md:gap-14">
              <div className="max-w-xl">
                <Reveal>
                  <div className="max-w-xl">
                    <CodeEntry />
                  </div>
                </Reveal>
                <Reveal delay={0.08}>
                  <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:mt-10 sm:text-5xl">
                    Turn your prompts into products people actually pay for.
                  </h1>
                </Reveal>
                <Reveal delay={0.12}>
                  <p className="mt-4 text-base leading-relaxed text-white/70">
                    Publish a clean page, share one link or code, and let people run what you built.
                  </p>
                </Reveal>
                <Reveal delay={0.16}>
                  <p className="mt-4 text-sm font-medium text-white/54">
                    Not screenshots. Not docs. Something people can actually use.
                  </p>
                </Reveal>
                <Reveal delay={0.2}>
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <PrimaryButton href="/apply">Become a creator</PrimaryButton>
                    <SecondaryButton href="/marketplace">Open marketplace</SecondaryButton>
                  </div>
                </Reveal>
              </div>

              <Reveal delay={0.08}>
                <WorkflowStudioEmbedCard workflow={heroWorkflow} onRun={openHomepageDemo} />
              </Reveal>
            </div>
          </Container>
        </section>

        <HowItWorksSticky />

        <Section
          id="marketplace"
          wide
          eyebrow="Marketplace"
          title="Get discovered in the marketplace"
          desc="Your products show up where people are already looking"
        >
          <MarketplaceShowcase />
        </Section>

        <Section
          id="prompt"
          wide
          eyebrow="Prompts"
          title="Your prompt should not live in a screenshot"
          desc="Turn it into something people can actually use"
        >
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <div className="space-y-4">
              <Reveal>
                <TextCard title="Build properly">
                  <p>Write with inputs and structure.</p>
                </TextCard>
              </Reveal>
              <Reveal delay={0.05}>
                <TextCard title="Publish cleanly">
                  <p>Give it a real product page.</p>
                </TextCard>
              </Reveal>
            </div>
            <Reveal delay={0.08}>
              <PromptTransformVisual />
            </Reveal>
          </div>
        </Section>

        <Section
          id="workflows"
          wide
          eyebrow="Workflows"
          title="Turn workflows into products"
          desc="When a prompt is not enough, publish something repeatable"
        >
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <div className="space-y-4">
              <Reveal>
                <TextCard title="Build a flow">
                  <p>Connect inputs, prompts, tools, and outputs once.</p>
                </TextCard>
              </Reveal>
              <Reveal delay={0.05}>
                <TextCard title="Make execution visible">
                  <p>Show the user what runs, what changes, and what they get back.</p>
                </TextCard>
              </Reveal>
            </div>
            <Reveal delay={0.08}>
              <WorkflowExecutionVisual />
            </Reveal>
          </div>
        </Section>

        <Section
          id="run-it"
          wide
          eyebrow="Run it yourself"
          title="Run it yourself"
          desc="Prefilled demos. Real outputs. The same run flow buyers will see."
        >
          {homepageRunError ? (
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/68">
              {homepageRunError}
            </div>
          ) : null}
          <div className="mb-6 rounded-[28px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/62 sm:px-5">
            Each homepage visitor gets protected demo runs before switching over to marketplace
            discovery.
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {sectionWorkflows.map((workflow, index) => (
              <Reveal key={workflow.id} delay={index * 0.05}>
                <WorkflowStudioEmbedCard workflow={workflow} compact onRun={openHomepageDemo} />
              </Reveal>
            ))}
          </div>
        </Section>

        <Section
          id="clarity"
          wide
          eyebrow="Why it works"
          title="Built to be understood fast"
          desc="People should know what they are getting in seconds"
        >
          <ClarityCards />
        </Section>

        <Section
          id="creators"
          wide
          eyebrow="Creators"
          title="Built for people already making useful prompts"
          desc="If you already have something useful, this is where you publish it properly"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-5 md:grid-cols-3">
              <Reveal>
                <TextCard title="Start simple">
                  <p>Publish one useful prompt or workflow first.</p>
                </TextCard>
              </Reveal>
              <Reveal delay={0.05}>
                <TextCard title="Boost distribution">
                  <p>Use Edgaze links and codes to make sharing easier.</p>
                </TextCard>
              </Reveal>
              <Reveal delay={0.1}>
                <TextCard title="Grow from real usage">
                  <p>Add more when you see what people actually use.</p>
                </TextCard>
              </Reveal>
            </div>
            <Reveal delay={0.08}>
              <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7">
                <div className="text-sm font-semibold text-white">Real creator path</div>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  Useful work should have a clean page, a clear run flow, and real distribution.
                </p>
                <SmoothLink
                  href="/profile/@gilbertodera"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/72 transition-colors hover:text-white"
                >
                  <span>See how Gilbert Odera publishes on Edgaze</span>
                  <ArrowRight className="h-4 w-4" />
                </SmoothLink>
              </div>
            </Reveal>
          </div>
        </Section>

        <Section
          id="storefront"
          wide
          eyebrow="Storefront"
          title="Your work becomes a storefront"
          desc="Publish products. Track what works. Get paid."
        >
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <div className="space-y-4">
              <Reveal>
                <TextCard title="A clean creator page">
                  <p>Your profile, your products, and your collections in one place.</p>
                </TextCard>
              </Reveal>
              <Reveal delay={0.05}>
                <TextCard title="Analytics and earnings">
                  <p>See views, runs, buyers, and revenue without guesswork.</p>
                </TextCard>
              </Reveal>
              <Reveal delay={0.1}>
                <TextCard title="Keep what works">
                  <p>Use real usage to decide what to publish next.</p>
                </TextCard>
              </Reveal>
            </div>

            <Reveal delay={0.08}>
              <CardFrame className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Creator dashboard</div>
                    <div className="mt-1 text-sm text-white/65">
                      Publishing, runs, and earnings in one view.
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold text-white/72">
                    Stripe connected
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
                    <div className="text-[10px] tracking-[0.2em] text-white/42">EARNINGS</div>
                    <div className="mt-2 text-3xl font-semibold text-white">$1,847</div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/6 ring-1 ring-white/10">
                      <motion.div
                        className="h-full rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]"
                        initial={{ width: 0 }}
                        whileInView={{ width: "72%" }}
                        viewport={{ once: true, amount: 0.7 }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <TinyStat label="RUNS" value="9.1K" />
                    <TinyStat label="BUYERS" value="214" />
                    <TinyStat label="CONV." value="4.6%" />
                  </div>
                </div>
              </CardFrame>
            </Reveal>
          </div>
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

        <section className="px-5 py-4">
          <Container wide>
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-[11px] text-white/38">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="uppercase tracking-[0.18em] text-white/26">Explore more</span>
                <a href="/what-is-edgaze" className="transition-colors hover:text-white/62">
                  What is Edgaze
                </a>
                <a href="/how-edgaze-works" className="transition-colors hover:text-white/62">
                  How Edgaze works
                </a>
                <a href="/for-creators" className="transition-colors hover:text-white/62">
                  For creators
                </a>
                <a href="/for-buyers" className="transition-colors hover:text-white/62">
                  For buyers
                </a>
                <a href="/marketplace" className="transition-colors hover:text-white/62">
                  Marketplace
                </a>
                <a href="/builder" className="transition-colors hover:text-white/62">
                  Builder
                </a>
                <a href="/prompt-studio" className="transition-colors hover:text-white/62">
                  Prompt Studio
                </a>
              </div>
            </div>
          </Container>
        </section>

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
