"use client";

/* eslint-disable react-hooks/static-components -- WorkflowNode and PromptCard are intentional inner components for phase-dependent animation */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
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

export function IlluShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[320px] sm:h-[360px] w-full overflow-hidden rounded-3xl bg-white/4 ring-1 ring-white/10">
      <div className="absolute -inset-28 opacity-70 blur-3xl [background-image:radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.22),transparent_54%),radial-gradient(circle_at_70%_25%,rgba(236,72,153,0.18),transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:76px_76px]" />
      {children}
    </div>
  );
}

export function HeroCollectToBox({ noBox = false }: { noBox?: boolean }) {
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
    let interval: ReturnType<typeof setInterval>;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

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
        : { x: [0, 6, -5, 4, 0], y: [0, -4, 3, -3, 0] };
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
        {/* Central: Edgaze logo — with or without box */}
        {noBox ? (
          <motion.div
            className="absolute flex items-center justify-center"
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
            <div className="relative">
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-16 w-16 md:h-20 md:w-20 object-contain" />
              {glaze && !reduce && (
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    background:
                      "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.2), transparent 60%), radial-gradient(circle at 50% 50%, rgba(236,72,153,0.15), transparent 60%)",
                    filter: "blur(20px)",
                    margin: -20,
                  }}
                />
              )}
            </div>
          </motion.div>
        ) : (
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
            <div className="absolute inset-0 opacity-85 [background-image:radial-gradient(circle_at_25%_25%,rgba(34,211,238,0.16),transparent_62%),radial-gradient(circle_at_75%_35%,rgba(236,72,153,0.12),transparent_64%)]" />
            <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] rounded-3xl" />
            <div className="relative h-full w-full flex items-center justify-center p-5">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative">
                  <div className="absolute -inset-5 rounded-full blur-2xl opacity-70 [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.26),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.22),transparent_62%)]" />
                  <img src="/brand/edgaze-mark.png" alt="Edgaze" className="relative h-12 w-12" />
                </div>
                <div className="mt-3 text-lg font-semibold tracking-tight text-white/95">Edgaze</div>
                <div className="mt-1 text-xs text-white/60">Collect → publish → share</div>
              </div>
            </div>
            <AnimatePresence>
              {glaze && !reduce ? (
                <motion.div
                  key="glaze"
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
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
        )}

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
                  key={i}
                  d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth={2}
                  fill="none"
                />
              );
            })}
          </svg>
        ) : null}

        {layout.nodes.map((n, i) => (
          <WorkflowNode key={n.label} label={n.label} x={n.x} y={n.y} delay={i * 0.15} />
        ))}
        <PromptCard text={layout.prompt.text} x={layout.prompt.x} y={layout.prompt.y} delay={0.2} />
      </div>
    </IlluShell>
  );
}
