"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Compass,
  Link2,
  Search,
  Sparkles,
} from "lucide-react";

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

function AccentLine() {
  return (
    <div className="h-[2px] w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(236,72,153,0.9))]" />
  );
}

function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
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
          <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-9 w-9" />
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
          </SmoothLink><SmoothLink className="hover:text-white" href="#anyone">
            Creators
          </SmoothLink>
          <SmoothLink className="hover:text-white" href="#apply">
            Apply
          </SmoothLink>
        </div>

        <div className="flex items-center gap-2">
          <SmoothLink
            href="#apply"
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
        // Keep foreground UI readable: no glassy transparency.
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

/**
 * Illustration 1: User enters code -> product page opens
 */
function IlluCodeOpensProduct() {
  const reduce = useReducedMotion();
  const scene = useLoopedSceneCount(2, 4200);

  return (
    <IlluShell>
      <div className="absolute left-6 top-6 right-6">
        <CardFrame className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold tracking-widest text-white/55">ENTER CODE</div>
            <div className="h-8 w-8 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white/85" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <div className="h-11 rounded-2xl bg-white/5 ring-1 ring-white/10" />
            <div className="h-11 w-24 rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]" />
          </div>
          <div className="mt-4 flex gap-2">
            <Chip text="Prompt" />
            <Chip text="Workflow" />
            <Chip text="Tool" />
          </div>
        </CardFrame>
      </div>

      

      {!reduce ? (
        <motion.div
          className="absolute left-0 top-0 h-3 w-3 rounded-full bg-white/85 shadow-[0_0_0_7px_rgba(255,255,255,0.08)]"
          animate={{ x: [80, 260, 300, 210], y: [110, 110, 220, 260] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
    </IlluShell>
  );
}

/**
 * Illustration 2: Prompt card with counters rising fast
 */
function IlluPromptCardStats() {
  const reduce = useReducedMotion();
  const [v, setV] = useState(240);
  const [l, setL] = useState(32);
  const [r, setR] = useState(110);

  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => {
      setV((x) => Math.min(9840, x + 180 + Math.floor(Math.random() * 90)));
      setL((x) => Math.min(2140, x + 16 + Math.floor(Math.random() * 10)));
      setR((x) => Math.min(6820, x + 120 + Math.floor(Math.random() * 70)));
    }, 260);
    return () => window.clearInterval(t);
  }, [reduce]);

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

  return (
    <IlluShell>
      <div className="absolute left-8 right-8 top-10">
        <CardFrame className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">Scholarship essay helper</div>
              <div className="mt-1 text-sm text-white/65">Clean structure, stronger clarity, faster drafts.</div>
            </div>
            <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))] px-3 py-2 text-sm font-semibold text-white">
              $9
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <TinyStat label="VIEWS" value={fmt(v)} />
            <TinyStat label="LIKES" value={fmt(l)} />
            <TinyStat label="RUNS" value={fmt(r)} />
          </div>

          <div className="mt-5 h-12 rounded-2xl bg-white/5 ring-1 ring-white/10" />
        </CardFrame>
      </div>

      {!reduce ? (
        <motion.div
          className="absolute left-0 top-0 h-2 w-2 rounded-full bg-white/70"
          animate={{ x: [110, 240, 290, 170], y: [250, 110, 250, 300], opacity: [0.35, 0.8, 0.35] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
    </IlluShell>
  );
}

/**
 * Illustration 3: Node graph where nodes get added
 */
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

  const visible =
    scene === 0 ? ["a", "b", "c"] : scene === 1 ? ["a", "b", "c", "d"] : ["a", "b", "c", "d", "e"];

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
            className="absolute rounded-2xl bg-white/6 ring-1 ring-white/10 px-4 py-3"
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

  const a = nodes[0];
  const b = nodes[1];
  const c = nodes[2];
  const d = nodes[3];
  const e = nodes[4];

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

/**
 * Illustration 4: Magnifying glass searching a big scrolling marketplace and zoomed in area
 */
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

            {/* Magnifying glass */}
            <motion.div
              className="absolute"
              animate={reduce ? undefined : { x: [40, 160, 220, 120, 40], y: [40, 60, 140, 170, 40] }}
              transition={{ duration: 6.0, repeat: Infinity, ease: "easeInOut" }}
              style={{ left: 0, top: 0 }}
            >
              <div className="relative">
                {/* Highly frosted (readable) */}
                <div className="h-32 w-32 rounded-full ring-2 ring-white/25 bg-[#0b0c11]/70 backdrop-blur-xl overflow-hidden" />

                {/* Handle attached to lens */}
                <div
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: "translate(44px, 44px) rotate(38deg)",
                    transformOrigin: "0% 50%",
                  }}
                >
                  <div className="h-3 w-12 rounded-full bg-white/25" />
                </div>

                {/* Zoomed content */}
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

/**
 * Illustration 5: Marketplace scroll -> zoom into one prompt -> glitter
 */
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

              {!reduce ? (
                <>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute h-1.5 w-1.5 rounded-full bg-white/70"
                      style={{ left: `${10 + ((i * 8) % 80)}%`, top: `${8 + ((i * 11) % 60)}%` }}
                      animate={{ opacity: [0, 1, 0], scale: [0.7, 1.3, 0.7], y: [0, -8, 0] }}
                      transition={{ duration: 1.8 + (i % 3) * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
                    />
                  ))}
                </>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </IlluShell>
  );
}

/**
 * Illustration 6: Crowd -> one becomes creator with Edgaze badge (no overlay card)
 */
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
              className={cn(
                "absolute rounded-full ring-1 ring-white/10",
                isFocus ? "bg-white/10" : "bg-white/6"
              )}
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
              {/* subtle inner ring */}
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />

              {/* Focus glow + badge */}
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
                    {/* Edgaze gradient glow */}
                    <div className="absolute -inset-6 rounded-full blur-2xl opacity-80 [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.40),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.34),transparent_62%)]" />
                    <div className="absolute -inset-1 rounded-full ring-2 ring-white/20" />

                    {/* Badge */}
                    <motion.div
                      className="absolute -right-2 -top-2"
                      animate={reduce ? undefined : { y: [0, -2, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <div className="relative">
                        <div className="absolute -inset-2 rounded-2xl blur-lg opacity-75 [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.45),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.38),transparent_62%)]" />
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

/**
 * Illustration 7: Storefront dashboard with money count up to 1789.36
 */
function IlluStorefrontRevenue() {
  const reduce = useReducedMotion();
  const scene = useLoopedSceneCount(2, 4200);

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
                ${scene === 1 || reduce ? <AnimatedNumber target={1789.36} durationMs={2200} decimals={2} /> : "0.00"}
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
  if (kind === "hero") return <IlluCodeOpensProduct />;
  if (kind === "prompt") return <IlluPromptCardStats />;
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
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "going">("idle");
  const [error, setError] = useState("");

  function onGo() {
    setError("");

    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter a code");
      return;
    }

    setStatus("going");

    // Expected input formats:
    // - @handle/code
    // - handle/code (we will prefix @)
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length < 2) {
      setStatus("idle");
      setError("Enter @handle/code");
      return;
    }

    const handleRaw = parts[0];
    const codeRaw = parts.slice(1).join("/");
    const handle = handleRaw.startsWith("@") ? handleRaw : `@${handleRaw}`;

    window.location.href = `/${encodeURIComponent(handle)}/${encodeURIComponent(codeRaw)}`;
  }

  return (
    <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7">
      <div className="text-sm font-semibold text-white">Enter an Edgaze code</div>
      <div className="mt-2 text-sm text-white/70">Open a prompt, workflow, or tool in seconds.</div>

      <div className="mt-5 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label="Edgaze code"
        />
        <button
          type="button"
          onClick={onGo}
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

      <AnimatePresence>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mt-2 text-xs text-white/70"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>
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
      className={cn("px-5 py-20 sm:py-24 md:py-28 snap-start", className)}
      style={{ scrollMarginTop: 92 }}
    >
      <Container>
        {(eyebrow || title || desc) && (
          <div className="max-w-2xl">
            {eyebrow ? <div className="text-xs font-semibold tracking-widest text-white/55">{eyebrow}</div> : null}
            {title ? (
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
            ) : null}
            {desc ? <p className="mt-3 text-base leading-relaxed text-white/70">{desc}</p> : null}
          </div>
        )}
        <div className="mt-12">{children}</div>
      </Container>
    </section>
  );
}

export default function EdgazeLandingPage() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress, scrollY } = useScroll({ container: scrollerRef });
  const barWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const barSpring = useSpring(barWidth, { stiffness: 220, damping: 30, mass: 0.4 });

  const [onTop, setOnTop] = useState(true);

  const sectionIds = useMemo(
    () => ["top", "prompt", "workflows", "marketplace", "features", "better", "anyone", "creators", "apply"],
    []
  );

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (v) => setOnTop(v < 12));
    return () => unsubscribe();
  }, [scrollY]);

  // Gentle section settling.
  // Behavior:
  // - No forced snapping.
  // - If the user is between sections and pauses, we softly settle to the nearest section.
  // - If the user keeps nudging (trying to hold position), we do nothing.
  // - If the user scrolls fast (wheel fling / large deltas / high velocity), settling is disabled temporarily.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let disableUntil = 0;
    let scrollEndTimer: number | null = null;
    let lastTop = scroller.scrollTop;
    let lastT = performance.now();
    let maxVel = 0; // px/ms since last pause

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

      let best = tops[0];
      let bestDist = Math.abs(y - best.top);
      for (let i = 1; i < tops.length; i++) {
        const d = Math.abs(y - tops[i].top);
        if (d < bestDist) {
          best = tops[i];
          bestDist = d;
        }
      }
      return { ...best, dist: bestDist };
    };

    const scheduleSettle = () => {
      if (scrollEndTimer) window.clearTimeout(scrollEndTimer);
      scrollEndTimer = window.setTimeout(() => {
        if (performance.now() < disableUntil) return;

        // If the last scroll burst was fast, do not settle (user likely intends free scroll).
        if (maxVel > 0.9) {
          maxVel = 0;
          return;
        }

        const nearest = nearestSectionTop();
        if (!nearest) return;

        // Always settle when paused (even mid-way), but keep it gentle.
        // If you're basically aligned already, do nothing.
        if (nearest.dist < 10) {
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

      // Aggressive wheel/trackpad flings: disable settling for a moment.
      // This prevents the "forced" feeling when someone scrolls quickly.
      const fastWheel = Math.abs(e.deltaY) > 160;
      if (fastWheel) disableUntil = performance.now() + 1400;

      scheduleSettle();
    };

    const onScroll = () => {
      const now = performance.now();
      const top = scroller.scrollTop;
      const dt = Math.max(1, now - lastT);
      const vel = Math.abs(top - lastTop) / dt;

      // Track the peak velocity inside the current scroll burst.
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

  // Runtime checks as test cases
  useEffect(() => {
    // Test 1: required sections exist
    sectionIds.forEach((id) => {
      if (!document.getElementById(id)) console.warn("Missing section:", id);
    });

    // Test 2: no placeholders
    const inputs = Array.from(document.querySelectorAll("input,textarea"));
    const withPlaceholder = inputs.filter((el) => el.getAttribute("placeholder"));
    if (withPlaceholder.length) console.warn("Found placeholder attributes.");

    // Test 3: code entry exists
    const codeInput = document.querySelector('input[aria-label="Edgaze code"]');
    const openButton = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "Open"
    );
    if (!codeInput) console.warn("Missing code input");
    if (!openButton) console.warn("Missing Open button");
  }, [sectionIds]);

  return (
    <ScrollContext.Provider value={{ scrollerRef }}>
      <div className="relative text-white">
        <Gradients />
        <Nav onTop={onTop} />

        <motion.div
          className="fixed top-0 left-0 z-[60] h-[2px] bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(236,72,153,0.9))]"
          style={{ width: barSpring }}
          aria-hidden
        />

        <div
          ref={scrollerRef}
          className="h-screen overflow-y-auto scroll-smooth snap-y snap-proximity"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div id="top" className="pt-24" />

          {/* HERO */}
          <section className="px-5 pt-12 pb-16 sm:pt-16 sm:pb-20 snap-start" style={{ scrollMarginTop: 92 }}>
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
                      <SecondaryButton href="#apply">Apply now</SecondaryButton>
                    </div>
                  </Reveal>
                </div>

                <Reveal delay={0.08}>
                  <Illustration kind="hero" />
                </Reveal>
              </div>
            </Container>
          </section>
          {/* PROMPT STUDIO */}
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

          {/* WORKFLOWS */}
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

          {/* MARKETPLACE */}
          <Section
            id="marketplace"
            eyebrow="Marketplace"
            title="Discovery built in."
            desc="A huge marketplace, fast search, and pages that convert."
          >
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

          {/* FEATURES */}
          <Section
            id="features"
            eyebrow="Everything"
            title="Everything in one product."
            desc="Prompt Studio is the base. Workflows add power. Marketplace adds reach."
          >
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

          {/* BETTER */}
          <Section
            id="better"
            eyebrow="Why it’s better"
            title="Built for clarity."
            desc="A marketplace that feels clean. A product page that feels trustworthy."
          >
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

          {/* ANYONE */}
          <Section
            id="anyone"
            eyebrow="Creators"
            title="Anyone can become an Edgaze creator."
            desc="If you can write something useful, you can publish."
          >
            <FeatureSplit kind="crowd">
  <div className="space-y-5">
    <Reveal>
      <TextCard title="Start simple">
        <p>Publish one prompt. See it grow. Add more when you are ready. You grow at your pace.</p>
      </TextCard>
    </Reveal>
    <Reveal delay={0.05}>
      <TextCard title="Boost your distribution">
        <p>Use Edgaze codes and links to boost your existing distribution and unlock reach for assets that were not productive before.</p>
      </TextCard>
    </Reveal>
    <Reveal delay={0.1}>
      <TextCard title="Join in simple steps">
        <p>Apply for closed beta. Get approved and you are in. Get distribution on your assets that were not productive before.</p>
      </TextCard>
    </Reveal>
  </div>
</FeatureSplit>
          </Section>

          {/* STOREFRONT */}
          <Section
            id="creators"
            eyebrow="Storefront"
            title="Your work becomes a storefront."
            desc="Publish products. Track performance. Get paid later."
          >
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

          {/* APPLY */}
          <Section
            id="apply"
            eyebrow="Closed beta"
            title="Apply for closed beta."
            desc="Creators can set prices now. Users run for free in beta. Payments activate later."
          >
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
                      href="/creators"
                    >
                      <span className="inline-flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-white/75" />
                        Explore creators
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/55" />
                    </a>
                    <a
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80 hover:bg-white/8 transition-colors"
                      href="/about"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-white/75" />
                        Learn more
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/55" />
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>
          </Section>

          {/* FOOTER */}
          <footer className="px-5 pb-12 snap-start">
            <Container>
              <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-7 sm:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-10 w-10" />
                    <div>
                      <div className="text-sm font-semibold text-white">Edgaze</div>
                      <div className="mt-1 text-sm text-white/60">Create, sell, and distribute AI products.</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
                    <a className="hover:text-white" href="/privacy">
                      Privacy
                    </a>
                    <a className="hover:text-white" href="/terms">
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
        </div>
      </div>
    </ScrollContext.Provider>
  );
}
