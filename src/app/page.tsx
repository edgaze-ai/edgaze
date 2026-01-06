"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "src/components/auth/AuthContext";
import { createSupabaseBrowserClient } from "src/lib/supabase/browser";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgeCheck, Compass, Link2, Search, Sparkles } from "lucide-react";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

type ScrollCtx = {
  scrollerRef: React.RefObject<HTMLDivElement>;
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
      <div className="fixed inset-0 -z-10 bg-[#07080b]" />
      <div className="fixed inset-0 -z-10 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%),radial-gradient(circle_at_55%_90%,rgba(34,211,238,0.08),transparent_52%)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
      <div className="fixed inset-0 -z-10 opacity-35 [background-image:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_55%)]" />
    </>
  );
}

function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl", className)}>{children}</div>;
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
    if (!el || !scroller) return;

    e.preventDefault();

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
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { onAnchorClick } = useSmoothAnchorScroll(92);
  const isHash = href.startsWith("#");
  return (
    <a href={href} className={className} onClick={isHash ? onAnchorClick : undefined}>
      {children}
    </a>
  );
}

function Nav({ onTop }: { onTop: boolean }) {
  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-50",
        "transition-all duration-300",
        onTop ? "bg-transparent" : "bg-[#07080b]/70 backdrop-blur-md ring-1 ring-white/10"
      )}
    >
      <Container className="flex items-center justify-between px-5 py-4">
        <SmoothLink href="#top" className="flex items-center gap-2">
          <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-11 w-11" />
          <span className="text-sm font-semibold tracking-wide">Edgaze</span>
        </SmoothLink>

        <div className="hidden items-center gap-7 text-sm text-white/75 md:flex">
          <SmoothLink className="hover:text-white" href="#prompt">
            Prompt Studio
          </SmoothLink>
          <SmoothLink className="hover:text-white" href="#workflows">
            Workflows
          </SmoothLink>
          <SmoothLink className="hover:text-white" href="#marketplace">
            Marketplace
          </SmoothLink>
          <SmoothLink className="hover:text-white" href="#features">
            Features
          </SmoothLink>
          <SmoothLink className="hover:text-white" href="#anyone">
            Creators
          </SmoothLink>
          <a className="hover:text-white" href="/apply">
            Apply
          </a>
        </div>

        <div className="flex items-center gap-2">
          <SmoothLink
            href="/apply"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-white/90 ring-1 ring-white/10 bg-white/5 hover:bg-white/8 transition-colors md:inline-flex"
          >
            Apply
          </SmoothLink>
          <SmoothLink
            href="/marketplace"
            className="rounded-full px-4 py-2 text-sm font-medium text-white bg-[#11131a] ring-1 ring-white/10 hover:bg-[#141722] transition-colors"
          >
            Open marketplace
          </SmoothLink>
        </div>
      </Container>
    </div>
  );
}

function PrimaryButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <SmoothLink
      href={href}
      className="group relative inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
    >
      <span className="absolute inset-0 rounded-full p-[1px] bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]" />
      <span className="absolute inset-[1px] rounded-full bg-[#0b0c11]" />
      <span className="relative inline-flex items-center gap-2">
        {children}
        <ArrowRight className="h-4 w-4 opacity-90 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
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
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function IlluShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[320px] sm:h-[360px] w-full overflow-hidden rounded-3xl bg-white/4 ring-1 ring-white/10">
      <div className="absolute -inset-28 opacity-70 blur-3xl [background-image:radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.22),transparent_54%),radial-gradient(circle_at_70%_25%,rgba(236,72,153,0.18),transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:76px_76px]" />
      {children}
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/70">
      {text}
    </div>
  );
}

function CardFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-[#0b0c11] ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.55)]",
        className
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

function useLoopedSceneCount(scenes: number, ms: number) {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setScene((s) => (s + 1) % scenes), ms);
    return () => window.clearInterval(t);
  }, [reduce, scenes, ms]);
  return scene;
}

function AnimatedNumber({
  target,
  durationMs,
  decimals = 0,
}: {
  target: number;
  durationMs: number;
  decimals?: number;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, target, durationMs]);

  return <>{value.toFixed(decimals)}</>;
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

/*
  Hero illustration:
  - Prompts + workflow nodes roam for a moment
  - Edgaze box appears centered
  - Everything gets pulled into the box
  - Glaze shimmer, then reset
*/

function IlluHeroCollectToBox() {
  const reduce = useReducedMotion();
  const { ref, size } = useElementSize<HTMLDivElement>();

  const W = size.w || 920;
  const H = size.h || 420;

  const isMobileCanvas = W < 560 || H < 360;

  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    if (reduce) return;

    const steps: Array<{ p: 0 | 1 | 2 | 3; d: number }> = [
      { p: 0, d: isMobileCanvas ? 1700 : 2200 },
      { p: 1, d: 1300 },
      { p: 2, d: 900 },
      { p: 3, d: 650 },
    ];

    const total = steps.reduce((a, s) => a + s.d, 0);

    let interval: any;
    let timeouts: any[] = [];

    const run = () => {
      setPhase(0);
      let t = 0;
      timeouts = steps.map((s) => {
        const id = setTimeout(() => setPhase(s.p), t);
        t += s.d;
        return id;
      });
    };

    run();
    interval = setInterval(run, total);

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, [reduce, isMobileCanvas]);

  const show = phase === 0;
  const vacuum = phase === 1;
  const glaze = phase === 2;
  const returnBack = phase === 3;

  const cx = W / 2;
  const cy = H / 2;

  const SolidCard = ({ w, children }: { w: number; children: React.ReactNode }) => (
    <div
      className="relative rounded-3xl border border-white/10 bg-[#0b0f16] shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
      style={{ width: w }}
    >
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.10), transparent 55%), radial-gradient(circle at 80% 30%, rgba(236,72,153,0.08), transparent 55%)",
        }}
      />
      <div className="relative px-4 py-3">{children}</div>
    </div>
  );

  const WorkflowNode = ({ label, x, y, delay = 0 }: { label: string; x: number; y: number; delay?: number }) => {
    const drift =
      reduce || isMobileCanvas
        ? undefined
        : {
            x: [0, 6, -5, 4, 0],
            y: [0, -4, 3, -3, 0],
          };

    const targetXVacuum = cx - x - 80;
    const targetYVacuum = cy - y - 36;

    const showAnimate = isMobileCanvas ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, ...drift };

    return (
      <motion.div
        className="absolute z-10"
        style={{ left: x, top: y }}
        initial={false}
        animate={
          reduce
            ? undefined
            : show
            ? showAnimate
            : vacuum
            ? { opacity: [1, 0.75, 0], scale: [1, 0.65, 0.16], x: [0, targetXVacuum], y: [0, targetYVacuum] }
            : glaze
            ? { opacity: 0, scale: 0.12 }
            : returnBack
            ? { opacity: [0, 1], scale: [0.92, 1], x: [0, 0], y: [0, 0] }
            : { opacity: 1, scale: 1 }
        }
        transition={
          show
            ? isMobileCanvas
              ? { duration: 0.25, ease: "easeOut" }
              : { duration: 4.2, ease: "easeInOut", repeat: Infinity, delay }
            : vacuum
            ? { duration: 1.15, ease: [0.2, 0.85, 0.2, 1] }
            : returnBack
            ? { type: "spring", stiffness: 180, damping: 22, mass: 0.9 }
            : { duration: 0.35, ease: "easeOut" }
        }
      >
        <SolidCard w={160}>
          <div className="text-[9px] font-bold tracking-[0.28em] text-white/35 mb-1.5">NODE</div>
          <div className="text-sm font-semibold text-white/92">{label}</div>
        </SolidCard>
      </motion.div>
    );
  };

  const PromptCard = ({ text, x, y, delay = 0 }: { text: string; x: number; y: number; delay?: number }) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g);

    const targetXVacuum = cx - x - 160;
    const targetYVacuum = cy - y - 56;

    const showAnimate = isMobileCanvas
      ? { opacity: 1, scale: 1 }
      : { opacity: 1, scale: 1, x: [0, 5, -4, 4, 0], y: [0, -3, 3, -2, 0] };

    return (
      <motion.div
        className="absolute z-20"
        style={{ left: x, top: y }}
        initial={false}
        animate={
          reduce
            ? undefined
            : show
            ? showAnimate
            : vacuum
            ? { opacity: [1, 0.75, 0], scale: [1, 0.65, 0.16], x: [0, targetXVacuum], y: [0, targetYVacuum] }
            : glaze
            ? { opacity: 0, scale: 0.14 }
            : returnBack
            ? { opacity: [0, 1], scale: [0.92, 1], x: [0, 0], y: [0, 0] }
            : { opacity: 1, scale: 1 }
        }
        transition={
          show
            ? isMobileCanvas
              ? { duration: 0.25, ease: "easeOut" }
              : { duration: 4.6, ease: "easeInOut", repeat: Infinity, delay }
            : vacuum
            ? { duration: 1.15, ease: [0.2, 0.85, 0.2, 1] }
            : returnBack
            ? { type: "spring", stiffness: 170, damping: 22, mass: 0.95 }
            : { duration: 0.35, ease: "easeOut" }
        }
      >
        <SolidCard w={320}>
          <div className="text-[9px] font-bold tracking-[0.28em] text-white/35 mb-1.5">PROMPT</div>
          <div className="text-[12.5px] leading-relaxed text-white/78">
            {parts.map((part, i) =>
              part.startsWith("{{") && part.endsWith("}}") ? (
                <span key={i} className="text-cyan-300 font-semibold">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </div>
        </SolidCard>
      </motion.div>
    );
  };

  const layout = useMemo(() => {
    const pad = isMobileCanvas ? 16 : 24;
    const boxW = clamp(W * 0.42, 260, 360);
    const boxH = clamp(H * 0.36, 160, 220);
    const boxX = cx - boxW / 2;
    const boxY = cy - boxH / 2;

    const nodes = [
      { label: "Input", x: pad + 30, y: pad + 30 },
      { label: "Prompt", x: W - pad - 210, y: pad + 44 },
      { label: "Tool", x: W - pad - 220, y: H - pad - 150 },
    ];

    const prompt = {
      text: "Write a scholarship essay about {{topic}} with a clear structure and strong voice.",
      x: pad + 26,
      y: H - pad - 160,
    };

    return { boxW, boxH, boxX, boxY, nodes, prompt };
  }, [W, H, cx, cy, isMobileCanvas]);

  const connectorsVisible = show || returnBack;

  return (
    <IlluShell>
      <div ref={ref} className="absolute inset-0">
        {/* Edgaze box */}
        <motion.div
          className="absolute rounded-3xl bg-[#0b0c11] ring-1 ring-white/12 shadow-[0_26px_90px_rgba(0,0,0,0.6)] overflow-hidden"
          style={{ left: layout.boxX, top: layout.boxY, width: layout.boxW, height: layout.boxH }}
          animate={
            reduce
              ? undefined
              : vacuum
              ? { scale: [1, 1.03, 1], opacity: [1, 1, 1] }
              : glaze
              ? { scale: 1.02 }
              : { scale: 1 }
          }
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {/* Base glaze background */}
          <div className="absolute inset-0 opacity-85 [background-image:radial-gradient(circle_at_25%_25%,rgba(34,211,238,0.16),transparent_62%),radial-gradient(circle_at_75%_35%,rgba(236,72,153,0.12),transparent_64%)]" />
          <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] rounded-3xl" />

          {/* Centered logo + text (mobile-safe) */}
          <div className="relative h-full w-full flex items-center justify-center p-5">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="absolute -inset-5 rounded-full blur-2xl opacity-70 [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.26),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.22),transparent_62%)]" />
                <div className="relative">
  <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-12 w-12" />
</div>

              </div>

              <div className="mt-3 text-lg font-semibold tracking-tight text-white/95">Edgaze</div>
              <div className="mt-1 text-xs text-white/60">Collect → publish → share</div>
            </div>

           {/* removed corner chip */}

          </div>

          {/* ✅ Replace glitter with a premium glaze sheen */}
          <AnimatePresence>
            {glaze && !reduce ? (
              <motion.div
                key="glaze"
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                aria-hidden
              >
                {/* moving sheen */}
                <motion.div
                  className="absolute -inset-24 rotate-12"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.08) 82%, transparent 100%)",
                  }}
                  initial={{ x: "-45%" }}
                  animate={{ x: "45%" }}
                  transition={{ duration: 0.85, ease: [0.2, 0.8, 0.2, 1] }}
                />
                {/* soft bloom */}
                <motion.div
                  className="absolute inset-0"
                  animate={{ opacity: [0.35, 0.6, 0.35] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 35% 30%, rgba(34,211,238,0.12), transparent 60%), radial-gradient(circle at 70% 40%, rgba(236,72,153,0.10), transparent 62%)",
                  }}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        {/* Connectors (ONLY on desktop + only when visible) */}
        {connectorsVisible && !isMobileCanvas ? (
          <svg className="absolute inset-0" width={W} height={H} style={{ overflow: "visible" }} aria-hidden>
            {layout.nodes.map((n, i) => {
              const x1 = n.x + 80;
              const y1 = n.y + 40;
              const x2 = layout.boxX + layout.boxW / 2;
              const y2 = layout.boxY + layout.boxH / 2;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const c1x = x1 + dx * 0.35;
              const c1y = y1;
              const c2x = x1 + dx * 0.65;
              const c2y = y2;
              return (
                <path
                  key={`p-${i}`}
                  d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth={2}
                  fill="none"
                />
              );
            })}
          </svg>
        ) : null}

        {/* Nodes + prompt */}
        {layout.nodes.map((n, i) => (
          <WorkflowNode key={n.label} label={n.label} x={n.x} y={n.y} delay={i * 0.15} />
        ))}
        <PromptCard text={layout.prompt.text} x={layout.prompt.x} y={layout.prompt.y} delay={0.2} />
      </div>
    </IlluShell>
  );
}

function IlluCodeOpensProduct() {
  const reduce = useReducedMotion();
  const scene = useLoopedSceneCount(2, 3800);

  return (
    <IlluShell>
      <div className="absolute inset-0 flex items-start justify-center p-6 sm:p-7">
        <CardFrame className="w-full max-w-[520px] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold tracking-widest text-white/55">ENTER CODE</div>
            <div className="h-8 w-8 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white/85" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <div className="relative h-11 rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
              {!reduce ? (
                <motion.div
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-4 rounded-full bg-white/10"
                  animate={{ width: [30, 160, 160] }}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.0, ease: "easeInOut" }}
                />
              ) : null}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/60">@arjun/essay</div>
            </div>

            <div className="relative h-11 w-24 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]" />
              {!reduce ? (
                <motion.div
                  className="absolute inset-0"
                  animate={{ opacity: [0.18, 0.5, 0.18] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 60%)",
                  }}
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">Open</div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Chip text="Prompt" />
            <Chip text="Workflow" />
            <Chip text="Tool" />
          </div>

          <AnimatePresence initial={false}>
            {scene === 1 ? (
              <motion.div
                key="preview"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: 12 }}
                transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
                className="mt-5"
              >
                <div className="relative">
                  <div className="absolute -inset-6 rounded-[30px] blur-2xl opacity-60 [background-image:radial-gradient(circle_at_30%_25%,rgba(34,211,238,0.20),transparent_60%),radial-gradient(circle_at_70%_35%,rgba(236,72,153,0.16),transparent_62%)]" />
                  <div className="relative rounded-3xl bg-[#0b0c11] ring-1 ring-white/12 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold tracking-widest text-white/55">PROMPT</div>
                        <div className="mt-2 text-lg font-semibold text-white">Scholarship essay helper</div>
                        <div className="mt-1 text-sm text-white/65">Clean structure, stronger clarity, faster drafts.</div>
                      </div>
                      <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))] px-3 py-2 text-sm font-semibold text-white">
                        $9
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <TinyStat label="VIEWS" value="3.4K" />
                      <TinyStat label="LIKES" value="412" />
                      <TinyStat label="RUNS" value="1.9K" />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <div className="h-11 rounded-2xl bg-white/5 ring-1 ring-white/10" />
                      <div className="h-11 rounded-2xl bg-white/5 ring-1 ring-white/10" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardFrame>
      </div>
    </IlluShell>
  );
}

function IlluWorkflowGraph() {
  const reduce = useReducedMotion();
  const scene = useLoopedSceneCount(3, 2600);

  const nodes = useMemo(
    () => [
      { id: "a", x: 70, y: 95, w: 120, label: "Input" },
      { id: "b", x: 240, y: 80, w: 140, label: "Prompt" },
      { id: "c", x: 420, y: 120, w: 140, label: "Tool" },
      { id: "d", x: 240, y: 190, w: 160, label: "Transform" },
      { id: "e", x: 420, y: 220, w: 150, label: "Output" },
    ],
    []
  );

  const visible = scene === 0 ? ["a", "b", "c"] : scene === 1 ? ["a", "b", "c", "d"] : ["a", "b", "c", "d", "e"];

  function Node({ id, x, y, w, label }: { id: string; x: number; y: number; w: number; label: string }) {
    const show = visible.includes(id);
    return (
      <AnimatePresence>
        {show ? (
          <motion.div
            key={id}
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 10 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute rounded-3xl bg-black/35 backdrop-blur-xl ring-1 ring-white/15 shadow-[0_18px_70px_rgba(0,0,0,0.55)] px-5 py-4"
            style={{ left: x, top: y, width: w }}
          >
            <div className="text-xs font-semibold tracking-widest text-white/55">NODE</div>
            <div className="mt-1 text-sm font-semibold text-white">{label}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  function Edge({ from, to, show }: { from: { x: number; y: number }; to: { x: number; y: number }; show: boolean }) {
    if (!show) return null;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return (
      <motion.div
        className="absolute h-[2px] bg-white/20"
        style={{
          left: from.x,
          top: from.y,
          width: len,
          transform: `rotate(${angle}deg)`,
          transformOrigin: "0 50%",
        }}
        animate={reduce ? undefined : { opacity: [0.25, 0.55, 0.25] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }

  const a = nodes[0]!;
  const b = nodes[1]!;
  const c = nodes[2]!;
  const d = nodes[3]!;
  const e = nodes[4]!;

  const centerRight = (n: { x: number; y: number; w: number }) => ({ x: n.x + n.w, y: n.y + 40 });
  const centerLeft = (n: { x: number; y: number }) => ({ x: n.x, y: n.y + 40 });

  return (
    <IlluShell>
      <div className="absolute inset-0">
        <Edge from={centerRight(a)} to={centerLeft(b)} show={visible.includes("a") && visible.includes("b")} />
        <Edge from={centerRight(b)} to={centerLeft(c)} show={visible.includes("b") && visible.includes("c")} />
        <Edge
          from={{ x: b.x + 70, y: b.y + 80 }}
          to={{ x: d.x + 20, y: d.y + 20 }}
          show={visible.includes("b") && visible.includes("d")}
        />
        <Edge from={centerRight(d)} to={centerLeft(e)} show={visible.includes("d") && visible.includes("e")} />

        <Node id="a" x={a.x} y={a.y} w={a.w} label={a.label} />
        <Node id="b" x={b.x} y={b.y} w={b.w} label={b.label} />
        <Node id="c" x={c.x} y={c.y} w={c.w} label={c.label} />
        <Node id="d" x={d.x} y={d.y} w={d.w} label={d.label} />
        <Node id="e" x={e.x} y={e.y} w={e.w} label={e.label} />

        {!reduce ? (
          <motion.div
            className="absolute left-0 top-0 h-2 w-2 rounded-full bg-white/60"
            animate={{
              x: [a.x + a.w + 10, b.x + 10, c.x + 10, b.x + 40, d.x + 10, e.x + 10],
              y: [a.y + 40, b.y + 40, c.y + 40, b.y + 80, d.y + 20, e.y + 40],
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
      </div>
    </IlluShell>
  );
}

function IlluMarketplaceSearch() {
  const reduce = useReducedMotion();

  const cards = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        title: i % 3 === 0 ? "Resume rewrite" : i % 3 === 1 ? "Content repurpose" : "Study planner",
        price: i % 4 === 0 ? "$0" : i % 4 === 1 ? "$7" : i % 4 === 2 ? "$12" : "$19",
      })),
    []
  );

  return (
    <IlluShell>
      <div className="absolute left-7 right-7 top-7 bottom-7">
        <CardFrame className="h-full p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Marketplace</div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
              <Search className="h-4 w-4 text-white/75" />
              <div className="text-xs text-white/70">Search</div>
            </div>
          </div>

          <div className="relative mt-4 h-[240px] sm:h-[270px] overflow-hidden rounded-2xl bg-white/3 ring-1 ring-white/10">
            <motion.div
              className="absolute inset-0 p-3 grid grid-cols-2 gap-3"
              animate={reduce ? undefined : { y: [0, -120, 0] }}
              transition={{ duration: 6.0, repeat: Infinity, ease: "easeInOut" }}
            >
              {cards.map((c) => (
                <div key={c.id} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-sm font-semibold text-white">{c.title}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-white/60">Prompt</div>
                    <div className="text-xs font-semibold text-white">{c.price}</div>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div
              className="absolute"
              animate={reduce ? undefined : { x: [40, 160, 220, 120, 40], y: [40, 60, 140, 170, 40] }}
              transition={{ duration: 6.0, repeat: Infinity, ease: "easeInOut" }}
              style={{ left: 0, top: 0 }}
            >
              <div className="relative">
                <div className="h-32 w-32 rounded-full ring-2 ring-white/25 bg-[#0b0c11]/70 backdrop-blur-xl overflow-hidden" />

                <div
                  className="absolute"
                  style={{
                    left: "50%",
                    top: "50%",
                    transform: "translate(50px, 50px) rotate(38deg)",
                    transformOrigin: "0% 50%",
                  }}
                >
                  <div className="h-3 w-14 rounded-full bg-white/25" />
                </div>

                <motion.div
                  className="absolute left-2 top-2 h-28 w-28 rounded-full overflow-hidden"
                  animate={reduce ? undefined : { opacity: [0.75, 1, 0.75] }}
                  transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="h-full w-full scale-[1.35] origin-top-left">
                    <div className="p-3 grid grid-cols-1 gap-2">
                      <div className="rounded-2xl bg-white/10 ring-1 ring-white/10 p-3">
                        <div className="text-sm font-semibold text-white">Top result</div>
                        <div className="mt-1 text-xs text-white/65">Clean prompt page</div>
                      </div>
                      <div className="rounded-2xl bg-white/8 ring-1 ring-white/10 p-3">
                        <div className="text-xs text-white/70">Open and run</div>
                        <div className="mt-1 text-sm font-semibold text-white">Instant</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </CardFrame>
      </div>
    </IlluShell>
  );
}

function IlluClarityZoomGlitter() {
  const reduce = useReducedMotion();
  const scene = useLoopedSceneCount(2, 3800);

  return (
    <IlluShell>
      <div className="absolute left-8 right-8 top-10">
        <CardFrame className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Marketplace</div>
            <div className="text-xs text-white/60">Scrolling</div>
          </div>
          <div className="relative mt-4 h-56 overflow-hidden rounded-2xl bg-white/3 ring-1 ring-white/10">
            <motion.div
              className="absolute inset-0 p-3 space-y-3"
              animate={reduce ? undefined : { y: [0, -90, 0] }}
              transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
            >
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <div className="text-sm font-semibold text-white">Prompt {i + 1}</div>
                  <div className="mt-1 text-xs text-white/60">Clean page, clear value</div>
                </div>
              ))}
            </motion.div>
          </div>
        </CardFrame>
      </div>

      <AnimatePresence>
        {scene === 1 ? (
          <motion.div
            key="zoom"
            initial={reduce ? false : { opacity: 0, scale: 0.92, y: 20 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute left-16 right-16 bottom-10"
          >
            <div className="relative">
              <div className="absolute -inset-5 rounded-[28px] opacity-70 blur-xl [background-image:radial-gradient(circle_at_30%_25%,rgba(34,211,238,0.22),transparent_60%),radial-gradient(circle_at_70%_35%,rgba(236,72,153,0.18),transparent_62%)]" />
              <CardFrame className="relative p-5 ring-1 ring-white/15">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold text-white">Highlighted prompt</div>
                    <div className="mt-1 text-sm text-white/65">The clean, polished page users trust.</div>
                  </div>
                  <div className="rounded-2xl bg-white/6 ring-1 ring-white/10 px-3 py-2 text-sm font-semibold text-white">$12</div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <TinyStat label="VIEWS" value="3.9K" />
                  <TinyStat label="LIKES" value="481" />
                  <TinyStat label="RUNS" value="1.8K" />
                </div>
              </CardFrame>

              {!reduce
                ? Array.from({ length: 10 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute h-1.5 w-1.5 rounded-full bg-white/70"
                      style={{ left: `${10 + ((i * 8) % 80)}%`, top: `${8 + ((i * 11) % 60)}%` }}
                      animate={{ opacity: [0, 1, 0], scale: [0.7, 1.3, 0.7], y: [0, -8, 0] }}
                      transition={{
                        duration: 1.8 + (i % 3) * 0.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.12,
                      }}
                    />
                  ))
                : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </IlluShell>
  );
}

function IlluCrowdToCreators() {
  const reduce = useReducedMotion();
  const scene = useLoopedSceneCount(3, 2200);

  const people = useMemo(() => {
    const arr: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 22; i++) {
      arr.push({
        x: 50 + (i % 6) * 88 + (i % 2) * 6,
        y: 70 + Math.floor(i / 6) * 72 + (i % 3) * 2,
      });
    }
    return arr;
  }, []);

  const focus = scene === 0 ? 8 : scene === 1 ? 14 : 3;

  return (
    <IlluShell>
      <div className="absolute inset-0">
        {people.map((p, i) => {
          const isFocus = i === focus;
          return (
            <motion.div
              key={i}
              className={cn("absolute rounded-full ring-1 ring-white/10", isFocus ? "bg-white/10" : "bg-white/6")}
              style={{ left: p.x, top: p.y, width: 44, height: 44 }}
              animate={
                reduce
                  ? undefined
                  : {
                      scale: isFocus ? [1, 1.12, 1] : [1, 1.02, 1],
                      opacity: isFocus ? [0.8, 1, 0.8] : [0.6, 0.75, 0.6],
                    }
              }
              transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />

              <AnimatePresence>
                {isFocus ? (
                  <motion.div
                    key="focus"
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={reduce ? undefined : { opacity: 1, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                    className="absolute inset-0"
                  >
                    <div className="absolute -inset-7 rounded-full blur-2xl opacity-90 [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.42),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.36),transparent_62%)]" />
                    <div className="absolute -inset-1 rounded-full ring-2 ring-white/20" />

                    <motion.div
                      className="absolute -right-2 -top-2"
                      animate={reduce ? undefined : { y: [0, -2, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <div className="relative">
                        <div className="absolute -inset-3 rounded-2xl blur-lg opacity-90 [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.50),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.42),transparent_62%)]" />
                        <div className="relative flex h-7 w-7 items-center justify-center rounded-2xl bg-[#0b0c11] ring-1 ring-white/15">
                          <BadgeCheck className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {!reduce ? (
          <motion.div
            className="absolute left-0 top-0 h-3 w-3 rounded-full bg-white/80 shadow-[0_0_0_7px_rgba(255,255,255,0.08)]"
            animate={{ x: [120, 360, 520, 220], y: [250, 180, 300, 340] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
      </div>
    </IlluShell>
  );
}

function IlluStorefrontRevenue() {
  const reduce = useReducedMotion();

  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setCycle((c) => c + 1), 5200);
    return () => window.clearInterval(t);
  }, [reduce]);

  return (
    <IlluShell>
      <div className="absolute left-8 right-8 top-10">
        <CardFrame className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Creator dashboard</div>
              <div className="mt-1 text-sm text-white/65">Your work becomes a storefront.</div>
            </div>
            <div className="h-9 w-28 rounded-2xl bg-white/6 ring-1 ring-white/10" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3">
            <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-5">
              <div className="text-[10px] tracking-widest text-white/55">TOTAL EARNED</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                ${reduce ? "1787.89" : <AnimatedNumber key={cycle} target={1787.89} durationMs={2200} decimals={2} />}
              </div>

              <div className="mt-4 h-16 rounded-2xl bg-white/4 ring-1 ring-white/10 overflow-hidden">
                <motion.div
                  className="h-full w-full"
                  animate={reduce ? undefined : { x: [0, -40, 0] }}
                  transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, rgba(34,211,238,0.18), rgba(236,72,153,0.14)), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                    backgroundSize: "auto, 18px 18px",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <TinyStat label="VIEWS" value="28.4K" />
              <TinyStat label="RUNS" value="9.1K" />
              <TinyStat label="BUYERS" value="214" />
            </div>
          </div>
        </CardFrame>
      </div>

      {!reduce ? (
        <motion.div
          className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full opacity-70 blur-2xl"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.30), transparent 60%), radial-gradient(circle at 60% 40%, rgba(236,72,153,0.22), transparent 62%)",
          }}
          animate={{ scale: [1, 1.07, 1], opacity: [0.55, 0.8, 0.55] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
    </IlluShell>
  );
}

type IllustrationKind = "hero" | "prompt" | "workflow" | "market" | "clarity" | "crowd" | "storefront";

function Illustration({ kind }: { kind: IllustrationKind }) {
  if (kind === "hero") return <IlluHeroCollectToBox />;
  if (kind === "prompt") return <IlluCodeOpensProduct />;
  if (kind === "workflow") return <IlluWorkflowGraph />;
  if (kind === "market") return <IlluMarketplaceSearch />;
  if (kind === "clarity") return <IlluClarityZoomGlitter />;
  if (kind === "crowd") return <IlluCrowdToCreators />;
  return <IlluStorefrontRevenue />;
}

function FeatureSplit({ kind, children }: { kind: IllustrationKind; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start">
      <div>{children}</div>
      <div className="md:pt-2">
        <Reveal delay={0.08}>
          <Illustration kind={kind} />
        </Reveal>
      </div>
    </div>
  );
}

function TextCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-3 text-sm text-white/70 leading-relaxed space-y-3">{children}</div>
    </div>
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
    thumbnail_url?: string | null;
  };

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "searching" | "going">("idle");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openSug, setOpenSug] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const reqIdRef = useRef(0);

  const buildHref = (s: Suggestion) => {
    const handle = encodeURIComponent(s.owner_handle);
    const c = encodeURIComponent(s.edgaze_code);
    return s.kind === "prompt" ? `/p/${handle}/${c}` : `/${handle}/${c}`;
  };

  const normalizeInput = (raw: string) => raw.trim();

  const fetchSuggestions = async (q: string) => {
    const query = normalizeInput(q);
    if (!query) return [] as Suggestion[];

    const limitEach = 6;

    const p1 = supabase
      .from("prompts")
      .select("owner_handle, edgaze_code, title, is_paid, price_usd, thumbnail_url")
      .eq("is_published", true)
      .eq("is_public", true)
      .ilike("edgaze_code", `%${query}%`)
      .limit(limitEach);

    const p2 = supabase
      .from("workflows")
      .select("owner_handle, edgaze_code, title, is_paid, price_usd, thumbnail_url")
      .eq("is_published", true)
      .eq("is_public", true)
      .ilike("edgaze_code", `%${query}%`)
      .limit(limitEach);

    const [rPrompts, rWorkflows] = await Promise.all([p1, p2]);

    const prompts: Suggestion[] = (rPrompts.data || []).map((x: any) => ({
      kind: "prompt",
      owner_handle: String(x.owner_handle || "").replace(/^@/, ""),
      edgaze_code: String(x.edgaze_code || ""),
      title: String(x.title || "Untitled"),
      is_paid: x.is_paid ?? null,
      price_usd: x.price_usd ?? null,
      thumbnail_url: x.thumbnail_url ?? null,
    }));

    const workflows: Suggestion[] = (rWorkflows.data || []).map((x: any) => ({
      kind: "workflow",
      owner_handle: String(x.owner_handle || "").replace(/^@/, ""),
      edgaze_code: String(x.edgaze_code || ""),
      title: String(x.title || "Untitled"),
      is_paid: x.is_paid ?? null,
      price_usd: x.price_usd ?? null,
      thumbnail_url: x.thumbnail_url ?? null,
    }));

    const merged = [...prompts, ...workflows].filter((s) => s.owner_handle && s.edgaze_code);

    const score = (s: Suggestion) => {
      const c = s.edgaze_code.toLowerCase();
      const ql = query.toLowerCase();
      if (c === ql) return 100;
      if (c.startsWith(ql)) return 70;
      if (c.includes(ql)) return 40;
      return 0;
    };

    merged.sort((a, b) => score(b) - score(a));

    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const s of merged) {
      const key = `${s.kind}:${s.owner_handle}:${s.edgaze_code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= 10) break;
    }

    return out;
  };

  useEffect(() => {
    const q0 = normalizeInput(code);
    setError("");

    if (!q0) {
      setSuggestions([]);
      setOpenSug(false);
      setStatus("idle");
      setDismissed(false);
      return;
    }

    const pieces = q0.split("/").filter(Boolean);
    const maybeCode = pieces.length ? (pieces[pieces.length - 1] ?? q0) : q0;
    if (maybeCode !== q0) {
      setCode(maybeCode);
      return;
    }

    if (!dismissed) setOpenSug(true);

    const id = ++reqIdRef.current;
    setStatus("searching");

    const t = window.setTimeout(async () => {
      try {
        const res = await fetchSuggestions(maybeCode);
        if (reqIdRef.current !== id) return;
        setSuggestions(res);
        setActiveIdx(0);
      } catch {
        // keep panel open; error handled via empty state
      } finally {
        if (reqIdRef.current === id) setStatus("idle");
      }
    }, 180);

    return () => window.clearTimeout(t);
  }, [code, dismissed]);

  const closePanel = () => {
    setOpenSug(false);
    setDismissed(true);
  };

  const resolveExactAndGo = async () => {
    setError("");
    const q = normalizeInput(code);
    if (!q) {
      setError("Enter a code");
      return;
    }

    const selected = suggestions[activeIdx];
    if (openSug && selected && selected.edgaze_code.toLowerCase() === q.toLowerCase()) {
      router.push(buildHref(selected));
      return;
    }

    setStatus("going");

    const p1 = supabase
      .from("prompts")
      .select("owner_handle, edgaze_code, title, is_paid, price_usd, thumbnail_url")
      .eq("is_published", true)
      .eq("is_public", true)
      .ilike("edgaze_code", q)
      .limit(3);

    const p2 = supabase
      .from("workflows")
      .select("owner_handle, edgaze_code, title, is_paid, price_usd, thumbnail_url")
      .eq("is_published", true)
      .eq("is_public", true)
      .ilike("edgaze_code", q)
      .limit(3);

    const [rPrompts, rWorkflows] = await Promise.all([p1, p2]);

    const exact: Suggestion[] = [
      ...(rPrompts.data || []).map((x: any) => ({
        kind: "prompt" as const,
        owner_handle: String(x.owner_handle || "").replace(/^@/, ""),
        edgaze_code: String(x.edgaze_code || ""),
        title: String(x.title || "Untitled"),
        is_paid: x.is_paid ?? null,
        price_usd: x.price_usd ?? null,
        thumbnail_url: x.thumbnail_url ?? null,
      })),
      ...(rWorkflows.data || []).map((x: any) => ({
        kind: "workflow" as const,
        owner_handle: String(x.owner_handle || "").replace(/^@/, ""),
        edgaze_code: String(x.edgaze_code || ""),
        title: String(x.title || "Untitled"),
        is_paid: x.is_paid ?? null,
        price_usd: x.price_usd ?? null,
        thumbnail_url: x.thumbnail_url ?? null,
      })),
    ].filter((s) => s.owner_handle && s.edgaze_code);

    if (!exact.length) {
      setStatus("idle");
      setOpenSug(true);
      setDismissed(false);
      setError("No match found. Try another code.");
      return;
    }

    if (exact.length === 1) {
      const only = exact[0]!;
      router.push(buildHref(only));
      return;
    }

    setSuggestions(exact);
    setActiveIdx(0);
    setOpenSug(true);
    setDismissed(false);
    setStatus("idle");
    setError("Multiple matches. Pick one.");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      resolveExactAndGo();
      return;
    }
    if (e.key === "Escape") {
      closePanel();
      return;
    }

    if (!openSug) return;
    const list = suggestions;
    if (!list.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(list.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }
  };

  const Badge = ({ kind }: { kind: Suggestion["kind"] }) => (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
        kind === "prompt"
          ? "bg-cyan-500/10 text-cyan-200 ring-cyan-400/20"
          : "bg-pink-500/10 text-pink-200 ring-pink-400/20"
      )}
    >
      {kind === "prompt" ? "Prompt" : "Workflow"}
    </span>
  );

  const visibleList = suggestions;

  return (
    <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7">
      <div className="text-sm font-semibold text-white">Enter an Edgaze code</div>
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
                setStatus("searching");
              }}
              onFocus={() => {
                if (code.trim()) {
                  setOpenSug(true);
                  setDismissed(false);
                }
              }}
              onKeyDown={onKeyDown}
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
                  key="sug"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl bg-[#0b0c11] ring-1 ring-white/12 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                    <div className="text-[11px] font-semibold tracking-widest text-white/55">SUGGESTIONS</div>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-xl bg-white/6 ring-1 ring-white/10 px-2 py-1 text-[11px] text-white/75 hover:bg-white/8"
                      aria-label="Close suggestions"
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-[260px] overflow-auto p-2">
                    {status === "searching" ? <div className="px-3 py-2 text-xs text-white/55">Searching…</div> : null}

                    {visibleList.map((s, i) => {
                      const active = i === activeIdx;
                      const price = s.is_paid ? `$${Number(s.price_usd || 0).toFixed(0)}` : "$0";
                      return (
                        <button
                          key={`${s.kind}:${s.owner_handle}:${s.edgaze_code}:${i}`}
                          type="button"
                          onMouseEnter={() => setActiveIdx(i)}
                          onClick={() => router.push(buildHref(s))}
                          className={cn(
                            "w-full text-left rounded-xl px-3 py-2 transition-colors",
                            active ? "bg-white/8" : "hover:bg-white/6"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge kind={s.kind} />
                                <div className="text-xs text-white/60">@{s.owner_handle}</div>
                                <div className="text-xs text-white/40">·</div>
                                <div className="text-xs font-semibold text-white/70">{s.edgaze_code}</div>
                              </div>
                              <div className="mt-1 text-sm font-semibold text-white">{s.title}</div>
                            </div>
                            <div className="shrink-0 rounded-xl bg-white/6 ring-1 ring-white/10 px-2.5 py-1 text-xs font-semibold text-white">
                              {price}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {!suggestions.length && status !== "searching" ? (
                      <div className="px-3 pt-2 pb-3 text-xs text-white/55">No results found for this Edgaze code.</div>
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
              status === "going" ? "opacity-70" : "hover:opacity-95"
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

function Section({
  id,
  eyebrow,
  title,
  desc,
  children,
  className,
}: {
  id: string;
  eyebrow?: string;
  title?: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("px-5 py-20 sm:py-24 md:py-28 md:snap-start", className)}
      style={{ scrollMarginTop: 92 }}
    >
      <Container>
        {(eyebrow || title || desc) && (
          <div className="max-w-2xl">
            {eyebrow ? <div className="text-xs font-semibold tracking-widest text-white/55">{eyebrow}</div> : null}
            {title ? <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2> : null}
            {desc ? <p className="mt-3 text-base leading-relaxed text-white/70">{desc}</p> : null}
          </div>
        )}
        <div className="mt-12">{children}</div>
      </Container>
    </section>
  );
}

export default function EdgazeLandingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId, authReady, loading } = useAuth();

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [onTop, setOnTop] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const sectionIds = useMemo(
    () => ["top", "prompt", "workflows", "marketplace", "features", "better", "anyone", "creators", "apply"],
    []
  );

  useEffect(() => {
    if (!authReady || loading) return;
    if (!userId) return;
    if (pathname === "/marketplace") return;
    router.replace("/marketplace");
  }, [authReady, loading, pathname, router, userId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? el.scrollTop / max : 0;
      setScrollProgress(p);
      setOnTop(el.scrollTop < 12);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll as any);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let disableUntil = 0;
    let scrollEndTimer: number | null = null;
    let lastTop = scroller.scrollTop;
    let lastT = performance.now();
    let maxVel = 0;

    const getTops = () => {
      const currentScrollTop = scroller.scrollTop;
      const scrollerTop = scroller.getBoundingClientRect().top;

      const tops = sectionIds
        .map((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const elTop = el.getBoundingClientRect().top;
          const top = elTop - scrollerTop + currentScrollTop;
          return { id, top };
        })
        .filter(Boolean) as Array<{ id: string; top: number }>;

      tops.sort((a, b) => a.top - b.top);
      return tops;
    };

    const nearestSectionTop = () => {
      const tops = getTops();
      if (!tops.length) return null;

      const y = scroller.scrollTop;

      let best = tops[0]!;
      let bestDist = Math.abs(y - best.top);

      for (let i = 1; i < tops.length; i++) {
        const t = tops[i]!;
        const d = Math.abs(y - t.top);

        if (d < bestDist) {
          best = t;
          bestDist = d;
        }
      }

      return {
        ...best,
        dist: bestDist,
      };
    };

    const scheduleSettle = () => {
      if (scrollEndTimer) window.clearTimeout(scrollEndTimer);
      scrollEndTimer = window.setTimeout(() => {
        if (performance.now() < disableUntil) return;
        if (maxVel > 0.9) {
          maxVel = 0;
          return;
        }

        const nearest = nearestSectionTop();
        if (!nearest) return;

        if (nearest.dist < 10) {
          maxVel = 0;
          return;
        }
        if (nearest.dist > 160) {
          maxVel = 0;
          return;
        }

        scroller.scrollTo({ top: nearest.top, behavior: "smooth" });
        maxVel = 0;
      }, 220);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (window.innerWidth < 900) return;
      const fastWheel = Math.abs(e.deltaY) > 160;
      if (fastWheel) disableUntil = performance.now() + 1400;
      scheduleSettle();
    };

    const onScroll = () => {
      const now = performance.now();
      const top = scroller.scrollTop;
      const dt = Math.max(1, now - lastT);
      const vel = Math.abs(top - lastTop) / dt;
      maxVel = Math.max(maxVel, vel);
      lastTop = top;
      lastT = now;
      scheduleSettle();
    };

    scroller.addEventListener("wheel", onWheel, { passive: true });
    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scroller.removeEventListener("wheel", onWheel as any);
      scroller.removeEventListener("scroll", onScroll as any);
      if (scrollEndTimer) window.clearTimeout(scrollEndTimer);
    };
  }, [sectionIds]);

  useEffect(() => {
    sectionIds.forEach((id) => {
      if (!document.getElementById(id)) console.warn("Missing section:", id);
    });

    const inputs = Array.from(document.querySelectorAll("input,textarea"));
    const withPlaceholder = inputs.filter((el) => el.getAttribute("placeholder"));
    if (withPlaceholder.length) console.warn("Found placeholder attributes.");

    const codeInput = document.querySelector('input[aria-label="Edgaze code"]');
    const openButton = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === "Open");
    if (!codeInput) console.warn("Missing code input");
    if (!openButton) console.warn("Missing Open button");
  }, [sectionIds]);

  const showLoading = !authReady || loading;
  const redirecting = authReady && !loading && !!userId && pathname !== "/marketplace";

  if (showLoading || redirecting) {
    return <div className="min-h-screen bg-[#07080b]" aria-hidden="true" />;
  }

  return (
    <ScrollContext.Provider value={{ scrollerRef }}>
      <div className="relative text-white">
        <Gradients />
        <Nav onTop={onTop} />

        <motion.div
          className="fixed top-0 left-0 z-[60] h-[2px] bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(236,72,153,0.9))]"
          animate={{ width: `${Math.round(scrollProgress * 1000) / 10}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 30, mass: 0.4 }}
          aria-hidden
        />

        {/* ✅ FIX: No snap on mobile. Snap only from md+.
            ✅ FIX: Use 100dvh so iOS address bar doesn’t break bottom reach.
            ✅ FIX: Extra bottom spacer at the end for mobile reach. */}
        <div
          ref={scrollerRef}
          className="h-[100dvh] overflow-y-auto md:snap-y md:snap-proximity"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}
        >
          <div id="top" className="pt-24 md:snap-start" />

          {/* ✅ FIX: snap-start only on md+ */}
          <section className="px-5 pt-12 pb-16 sm:pt-16 sm:pb-20 md:snap-start" style={{ scrollMarginTop: 92 }}>
            <Container>
              <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-start">
                <div className="max-w-xl">
                  <Reveal>
                    <div className="max-w-xl">
                      <CodeEntry />
                    </div>
                  </Reveal>

                  <Reveal delay={0.08}>
                    <h1 className="mt-10 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                      Create, sell, and distribute AI products.
                    </h1>
                  </Reveal>
                  <Reveal delay={0.12}>
                    <p className="mt-4 text-base leading-relaxed text-white/70">
                      Edgaze is a marketplace for prompts and workflows. You build once. You publish a clean page. You share one link.
                    </p>
                  </Reveal>
                  <Reveal delay={0.16}>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <PrimaryButton href="/marketplace">Open marketplace</PrimaryButton>
                      <SecondaryButton href="/apply">Apply now</SecondaryButton>
                    </div>
                  </Reveal>
                </div>

                <Reveal delay={0.08}>
                  <Illustration kind="hero" />
                </Reveal>
              </div>
            </Container>
          </section>

          <Section
            id="prompt"
            eyebrow="Prompt Studio"
            title="Stop losing prompts."
            desc="A prompt should not live inside a screenshot or a private document. Treat it like a product."
          >
            <FeatureSplit kind="prompt">
              <div className="space-y-5">
                <Reveal>
                  <TextCard title="Build like an asset">
                    <p>Write prompts with structure. Add inputs. Save versions. Publish prompt packs that people can reuse.</p>
                  </TextCard>
                </Reveal>
                <Reveal delay={0.05}>
                  <TextCard title="Share a clean page">
                    <p>Every prompt gets a product page. Users can view, like, and run it. The page works in one tap on mobile.</p>
                  </TextCard>
                </Reveal>
              </div>
            </FeatureSplit>
          </Section>

          <Section
            id="workflows"
            eyebrow="Workflows"
            title="Turn a prompt into a tool."
            desc="When a prompt is not enough, add steps. Workflows are repeatable and easy to run."
          >
            <FeatureSplit kind="workflow">
              <div className="space-y-5">
                <Reveal>
                  <TextCard title="Build a flow">
                    <p>Connect inputs, prompts, tools, and outputs. Save it once. Run it forever.</p>
                  </TextCard>
                </Reveal>
                <Reveal delay={0.05}>
                  <TextCard title="Publish and share">
                    <p>Each workflow has a page. Users can open with a code or link. No confusion.</p>
                  </TextCard>
                </Reveal>
              </div>
            </FeatureSplit>
          </Section>

          <Section id="marketplace" eyebrow="Marketplace" title="Discovery built in." desc="A huge marketplace, fast search, and pages that convert.">
            <FeatureSplit kind="market">
              <div className="space-y-5">
                <Reveal>
                  <TextCard title="Search what you need">
                    <p>Users search a large library of prompts and workflows. The best result is obvious.</p>
                  </TextCard>
                </Reveal>
                <Reveal delay={0.05}>
                  <TextCard title="Open and run">
                    <p>A product page shows value in seconds. One tap to run.</p>
                  </TextCard>
                </Reveal>
              </div>
            </FeatureSplit>
          </Section>

          <Section id="features" eyebrow="Everything" title="Everything in one product." desc="Prompt Studio is the base. Workflows add power. Marketplace adds reach.">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Reveal>
                <TextCard title="Prompt Studio">
                  <p>Create prompts with templates, inputs, and versions. Publish single prompts or prompt packs.</p>
                </TextCard>
              </Reveal>
              <Reveal delay={0.05}>
                <TextCard title="Workflow Builder">
                  <p>Build repeatable flows when prompts are not enough. Inputs, steps, outputs. Clear and sharable.</p>
                </TextCard>
              </Reveal>
              <Reveal delay={0.1}>
                <TextCard title="Marketplace">
                  <p>Discovery, clean product pages, and sharing built in. This is how your work spreads.</p>
                </TextCard>
              </Reveal>
            </div>
          </Section>

          <Section id="better" eyebrow="Why it’s better" title="Built for clarity." desc="A marketplace that feels clean. A product page that feels trustworthy.">
            <FeatureSplit kind="clarity">
              <div className="space-y-5">
                <Reveal>
                  <TextCard title="Clear pages">
                    <p>Users should know what they get in one screen. No walls of text. No confusion.</p>
                  </TextCard>
                </Reveal>
                <Reveal delay={0.05}>
                  <TextCard title="Clean discovery">
                    <p>Marketplace browsing stays fast. Then it zooms into the one prompt that fits.</p>
                  </TextCard>
                </Reveal>
                <Reveal delay={0.1}>
                  <TextCard title="Professional polish">
                    <p>Smooth motion. Consistent spacing. Mobile first pages.</p>
                  </TextCard>
                </Reveal>
              </div>
            </FeatureSplit>
          </Section>

          <Section id="anyone" eyebrow="Creators" title="Anyone can become an Edgaze creator." desc="If you can write something useful, you can publish.">
            <FeatureSplit kind="crowd">
              <div className="space-y-5">
                <Reveal>
                  <TextCard title="Start simple">
                    <p>Publish one prompt. See it grow. Add more and you grow at your pace.</p>
                  </TextCard>
                </Reveal>
                <Reveal delay={0.05}>
                  <TextCard title="Boost your distribution">
                    <p>Boost your existing distribution with Edgaze codes and links.</p>
                  </TextCard>
                </Reveal>
                <Reveal delay={0.1}>
                  <TextCard title="Join in simple steps">
                    <p>Apply for closed beta, get approved, and you are in. Get distribution on your assets that were not productive.</p>
                  </TextCard>
                </Reveal>
              </div>
            </FeatureSplit>
          </Section>

          <Section id="creators" eyebrow="Storefront" title="Your work becomes a storefront." desc="Publish products. Track performance. Get paid later.">
            <FeatureSplit kind="storefront">
              <div className="space-y-5">
                <Reveal>
                  <TextCard title="A clean creator page">
                    <p>Your profile, your products, your collections. One place.</p>
                  </TextCard>
                </Reveal>
                <Reveal delay={0.05}>
                  <TextCard title="Analytics and earnings">
                    <p>Track views, runs, and conversion. Earnings become obvious.</p>
                  </TextCard>
                </Reveal>
              </div>
            </FeatureSplit>
          </Section>

          <Section id="apply" eyebrow="Closed beta" title="Apply for closed beta." desc="Creators can set prices now. Users run for free in beta. Payments activate later.">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start">
              <Reveal>
                <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-7 sm:p-8">
                  <div className="text-lg font-semibold text-white">Join the first group</div>
                  <div className="mt-3 text-sm text-white/70 leading-relaxed space-y-2">
                    <p>Creators who already share prompts.</p>
                    <p>Builders who want a clean way to publish tools.</p>
                    <p>People who care about clarity and quality.</p>
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <PrimaryButton href="/apply">Apply now</PrimaryButton>
                    <SecondaryButton href="#top">Back to top</SecondaryButton>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-7 sm:p-8">
                  <div className="text-sm font-semibold text-white">Fast links</div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <a
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80 hover:bg-white/8 transition-colors"
                      href="/marketplace"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Compass className="h-4 w-4 text-white/75" />
                        Open marketplace
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/55" />
                    </a>
                    <a
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80 hover:bg-white/8 transition-colors"
                      href="/marketplace"
                    >
                      <span className="inline-flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-white/75" />
                        Explore creators
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/55" />
                    </a>
                    <a
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80 hover:bg-white/8 transition-colors"
                      href="/feedback"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-white/75" />
                        Give feedback
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/55" />
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>
          </Section>

          {/* ✅ FIX: snap-start only on md+; extra bottom padding so footer is reachable on iOS */}
          <footer className="px-5 pb-16 md:snap-start">
            <Container>
              <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-7 sm:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-11 w-11" />
                    <div>
                      <div className="text-sm font-semibold text-white">Edgaze</div>
                      <div className="mt-1 text-sm text-white/60">Create, sell, and distribute AI products.</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
                    <a className="hover:text-white" href="/docs/privacy-policy">
                      Privacy
                    </a>
                    <a className="hover:text-white" href="/docs/terms-of-service">
                      Terms
                    </a>
                    <a className="hover:text-white" href="/contact">
                      Contact
                    </a>
                  </div>
                </div>

                <div className="mt-6 text-xs text-white/50">© Edgaze 2026. All rights reserved.</div>
              </div>
            </Container>
          </footer>

          {/* ✅ extra bottom spacer to guarantee last footer is scrollable on mobile */}
          <div className="h-10 md:hidden" />
        </div>
      </div>
    </ScrollContext.Provider>
  );
}
