"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
export const metadata = {
  title: "Help",
  description: "Get help in a variety of ways.",
};
/**
 * Updates:
 * - Added separate "Report bugs" card linking to /bugs
 * - Added bug animation icon
 * - Kept full-screen layout, no top-left pill, no top-right box
 * - Support email EXACT: support@edgaze.ai
 * - Production-safe animations (CSS classes, not Tailwind arbitrary animate-[...])
 */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(!!mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/* ---------- Animated icons (CSS-class driven, production-safe) ---------- */

function AnimatedDocsIcon({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="relative h-16 w-16 sm:h-[76px] sm:w-[76px]">
      <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]" />
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -inset-12 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.16),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(217,70,239,0.12),transparent_55%)] opacity-80" />
      </div>

      <div
        className={[
          "absolute left-1/2 top-1/2 h-11 w-9 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/12",
          "bg-gradient-to-br from-white/12 to-white/[0.02] shadow-[0_18px_38px_rgba(0,0,0,0.35)]",
          reducedMotion ? "" : "edg-anim-docs-float",
        ].join(" ")}
      >
        <div className="absolute left-2 top-2 h-1 w-5 rounded bg-white/18" />
        <div className="absolute left-2 top-4.5 h-1 w-6 rounded bg-white/12" />
        <div className="absolute left-2 top-7 h-1 w-4 rounded bg-white/12" />
        <div className="absolute left-2 top-9.5 h-1 w-6 rounded bg-white/10" />
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          <div
            className={[
              "absolute -left-10 top-0 h-full w-10 bg-gradient-to-r from-transparent via-cyan-300/12 to-transparent",
              reducedMotion ? "" : "edg-anim-shimmer",
            ].join(" ")}
          />
        </div>
      </div>

      <div className="absolute left-1/2 top-[60%] h-3 w-10 -translate-x-1/2 rounded-[999px] border border-white/10 bg-white/[0.03]" />
      <div className="absolute -inset-3 rounded-[26px] bg-gradient-to-r from-cyan-500/12 via-fuchsia-500/10 to-cyan-500/12 blur-2xl opacity-80" />
    </div>
  );
}

function AnimatedFeedbackIcon({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="relative h-16 w-16 sm:h-[76px] sm:w-[76px]">
      <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.04]" />
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -inset-10 bg-[radial-gradient(circle_at_25%_30%,rgba(217,70,239,0.14),transparent_55%),radial-gradient(circle_at_70%_70%,rgba(34,211,238,0.12),transparent_55%)] opacity-80" />
      </div>

      <div
        className={[
          "absolute left-1/2 top-1/2 w-12 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12",
          "bg-gradient-to-b from-white/12 to-white/[0.02] shadow-[0_18px_38px_rgba(0,0,0,0.35)]",
          reducedMotion ? "" : "edg-anim-form-drift",
        ].join(" ")}
      >
        <div className="p-2.5">
          <div className="h-1.5 w-8 rounded bg-white/18" />
          <div className="mt-2 h-1.5 w-9 rounded bg-white/12" />
          <div className="mt-1.5 h-1.5 w-7 rounded bg-white/12" />

          <div className="mt-2.5 h-6 rounded-xl border border-white/12 bg-white/[0.03] relative overflow-hidden">
            <div
              className={[
                "absolute left-2 top-1/2 h-2 -translate-y-1/2 w-0.5 rounded bg-fuchsia-300/80",
                reducedMotion ? "" : "edg-anim-cursor",
              ].join(" ")}
            />
            <div
              className={[
                "absolute left-3 top-1/2 h-1.5 -translate-y-1/2 rounded bg-white/14",
                reducedMotion ? "" : "edg-anim-text-grow",
              ].join(" ")}
            />
            <div
              className={[
                "absolute -left-10 top-0 h-full w-10 bg-gradient-to-r from-transparent via-white/10 to-transparent",
                reducedMotion ? "" : "edg-anim-shimmer-slow",
              ].join(" ")}
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-3 w-3 rounded border border-white/18 bg-white/5 relative overflow-hidden">
              <div className={["absolute inset-0 opacity-0", reducedMotion ? "" : "edg-anim-check"].join(" ")}>
                <div className="absolute left-[3px] top-[6px] h-[2px] w-[4px] rotate-45 bg-cyan-300" />
                <div className="absolute left-[5px] top-[5px] h-[2px] w-[7px] -rotate-45 bg-cyan-300" />
              </div>
            </div>
            <div className="h-1.5 w-7 rounded bg-white/10" />
          </div>
        </div>
      </div>

      <div className="absolute -inset-3 rounded-[26px] bg-gradient-to-r from-fuchsia-500/12 via-cyan-500/10 to-fuchsia-500/12 blur-2xl opacity-80" />
    </div>
  );
}

function AnimatedSupportIcon({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="relative h-16 w-16 sm:h-[76px] sm:w-[76px]">
      <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.04]" />
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -inset-10 bg-[radial-gradient(circle_at_35%_25%,rgba(34,211,238,0.14),transparent_55%),radial-gradient(circle_at_75%_80%,rgba(217,70,239,0.12),transparent_55%)] opacity-80" />
      </div>

      <div
        className={[
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[28px] sm:text-[32px]",
          "drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)]",
          reducedMotion ? "" : "edg-anim-emoji-float",
        ].join(" ")}
      >
        🎧
      </div>

      <div
        className={[
          "absolute left-[56%] top-[26%] h-6 w-7 sm:h-7 sm:w-8 rounded-2xl border border-white/12 bg-white/[0.06]",
          "shadow-[0_14px_30px_rgba(0,0,0,0.35)]",
          reducedMotion ? "" : "edg-anim-bubble-a",
        ].join(" ")}
      >
        <div className="absolute left-2 top-2 h-1 w-3 rounded bg-white/18" />
        <div className="absolute left-2 top-4 h-1 w-4 rounded bg-white/12" />
      </div>

      <div
        className={[
          "absolute left-[20%] top-[58%] h-5 w-6 sm:h-6 sm:w-7 rounded-2xl border border-white/12 bg-white/[0.05]",
          "shadow-[0_14px_30px_rgba(0,0,0,0.35)]",
          reducedMotion ? "" : "edg-anim-bubble-b",
        ].join(" ")}
      >
        <div className="absolute left-2 top-2 h-1 w-3 rounded bg-white/14" />
      </div>

      <div className="absolute -inset-3 rounded-[26px] bg-gradient-to-r from-cyan-500/12 via-white/5 to-fuchsia-500/12 blur-2xl opacity-80" />
    </div>
  );
}

function AnimatedBugIcon({ reducedMotion }: { reducedMotion: boolean }) {
  // “Bug” chip with jitter + scanning line + alert pulse dot (no emoji dependency)
  return (
    <div className="relative h-16 w-16 sm:h-[76px] sm:w-[76px]">
      <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.04]" />
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -inset-10 bg-[radial-gradient(circle_at_30%_25%,rgba(244,63,94,0.16),transparent_55%),radial-gradient(circle_at_75%_80%,rgba(217,70,239,0.10),transparent_55%)] opacity-80" />
      </div>

      <div
        className={[
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "h-10 w-10 sm:h-12 sm:w-12 rounded-2xl border border-white/12 bg-gradient-to-b from-white/12 to-white/[0.02]",
          "shadow-[0_18px_38px_rgba(0,0,0,0.35)] overflow-hidden",
          reducedMotion ? "" : "edg-anim-bug-jitter",
        ].join(" ")}
      >
        {/* “bug” body */}
        <div className="absolute left-1/2 top-1/2 h-4 w-5 sm:h-5 sm:w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 border border-white/12" />
        {/* legs */}
        <div className="absolute left-[9px] top-[17px] sm:left-[11px] sm:top-[21px] h-[2px] w-3 bg-white/12 rotate-[25deg]" />
        <div className="absolute left-[9px] top-[23px] sm:left-[11px] sm:top-[28px] h-[2px] w-3 bg-white/12 rotate-[-25deg]" />
        <div className="absolute right-[9px] top-[17px] sm:right-[11px] sm:top-[21px] h-[2px] w-3 bg-white/12 rotate-[-25deg]" />
        <div className="absolute right-[9px] top-[23px] sm:right-[11px] sm:top-[28px] h-[2px] w-3 bg-white/12 rotate-[25deg]" />

        {/* scan line */}
        <div
          className={[
            "absolute -top-6 left-0 h-6 w-full bg-gradient-to-b from-transparent via-rose-300/14 to-transparent",
            reducedMotion ? "" : "edg-anim-bug-scan",
          ].join(" ")}
        />

        {/* alert dot */}
        <div
          className={[
            "absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-400/90 shadow-[0_0_14px_rgba(244,63,94,0.55)]",
            reducedMotion ? "" : "edg-anim-bug-pulse",
          ].join(" ")}
        />
      </div>

      <div className="absolute -inset-3 rounded-[26px] bg-gradient-to-r from-rose-500/12 via-fuchsia-500/10 to-rose-500/12 blur-2xl opacity-80" />
    </div>
  );
}

/* ---------- Cards ---------- */

type Card = {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ReactNode;
  accent: "docs" | "feedback" | "bugs" | "support";
};

function AccentGlow({ accent }: { accent: Card["accent"] }) {
  const cls =
    accent === "docs"
      ? "from-cyan-500/18 via-fuchsia-500/10 to-cyan-500/18"
      : accent === "feedback"
      ? "from-fuchsia-500/18 via-cyan-500/10 to-fuchsia-500/18"
      : accent === "bugs"
      ? "from-rose-500/18 via-fuchsia-500/10 to-rose-500/18"
      : "from-cyan-500/18 via-white/6 to-fuchsia-500/18";

  return (
    <div
      className={[
        "pointer-events-none absolute -inset-10 rounded-[32px] blur-3xl opacity-0 transition-opacity duration-500",
        "group-hover:opacity-100 bg-gradient-to-r",
        cls,
      ].join(" ")}
      aria-hidden
    />
  );
}

function ResourceCard({ card, reducedMotion }: { card: Card; reducedMotion: boolean }) {
  return (
    <Link
      href={card.href}
      className={[
        "group relative block overflow-hidden rounded-2xl border border-white/10",
        "bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_22px_70px_rgba(0,0,0,0.40)]",
        "transition-transform duration-500 will-change-transform",
        reducedMotion ? "" : "hover:-translate-y-1",
      ].join(" ")}
    >
      <AccentGlow accent={card.accent} />

      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 20%, rgba(34,211,238,0.14), transparent 45%), radial-gradient(circle at 80% 85%, rgba(217,70,239,0.12), transparent 50%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(circle at 40% 30%, black 55%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(circle at 40% 30%, black 55%, transparent 85%)",
        }}
        aria-hidden
      />

      <div className="relative p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <div className="shrink-0">{card.icon}</div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">
              {card.title}
            </h2>

            <p className="mt-1 text-sm text-white/70 leading-relaxed">
              {card.description}
            </p>

            <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                {card.cta}
              </span>
              <span
                className={[
                  "text-white/55 transition-transform duration-500",
                  reducedMotion ? "" : "group-hover:translate-x-0.5",
                ].join(" ")}
                aria-hidden
              >
                →
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ---------- Page ---------- */

export default function HelpPage() {
  const reducedMotion = useReducedMotion();

  const cards = useMemo<Card[]>(
    () => [
      {
        title: "Documentation",
        description: "Guides, examples, and platform updates.",
        href: "/docs",
        cta: "Open docs",
        icon: <AnimatedDocsIcon reducedMotion={reducedMotion} />,
        accent: "docs",
      },
      {
        title: "Beta feedback",
        description: "Request features and share feedback (separate from bugs).",
        href: "/feedback",
        cta: "Submit feedback",
        icon: <AnimatedFeedbackIcon reducedMotion={reducedMotion} />,
        accent: "feedback",
      },
      {
        title: "Report bugs",
        description: "Found an issue? Report it here so we can fix it fast.",
        href: "/bugs",
        cta: "Report a bug",
        icon: <AnimatedBugIcon reducedMotion={reducedMotion} />,
        accent: "bugs",
      },
      {
        title: "Support",
        description: "Email us at support@edgaze.ai and we’ll respond ASAP.",
        href: "mailto:support@edgaze.ai",
        cta: "Email support@edgaze.ai",
        icon: <AnimatedSupportIcon reducedMotion={reducedMotion} />,
        accent: "support",
      },
    ],
    [reducedMotion]
  );

  return (
    <div className="min-h-screen w-full">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_80%_85%,rgba(217,70,239,0.12),transparent_45%)]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* content */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Help & Resources
        </h1>
        <p className="mt-1 text-sm sm:text-base text-white/65">
          Docs, feedback, bug reports, and support.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5">
          {cards.map((c) => (
            <ResourceCard key={c.title} card={c} reducedMotion={reducedMotion} />
          ))}
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <p className="text-xs text-white/45">
            © {new Date().getFullYear()} Edgaze. All rights reserved.
          </p>
        </div>
      </div>

      {/* animations */}
      <style jsx global>{`
        @keyframes edg_shimmer {
          0% {
            transform: translateX(-40px);
            opacity: 0;
          }
          18% {
            opacity: 1;
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translateX(140px);
            opacity: 0;
          }
        }

        @keyframes edg_docsFloat {
          0%,
          100% {
            transform: translate(-50%, -50%) translateY(0px) rotate(-1.5deg);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-4px) rotate(1.5deg);
          }
        }

        @keyframes edg_formDrift {
          0%,
          100% {
            transform: translate(-50%, -50%) translateY(0px) rotate(0.6deg);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-3px) rotate(-0.6deg);
          }
        }

        @keyframes edg_cursor {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }

        @keyframes edg_textGrow {
          0%,
          15% {
            width: 0rem;
            opacity: 0.65;
          }
          45% {
            width: 2.6rem;
            opacity: 1;
          }
          70% {
            width: 1.4rem;
            opacity: 0.85;
          }
          100% {
            width: 0rem;
            opacity: 0.65;
          }
        }

        @keyframes edg_check {
          0%,
          22% {
            opacity: 0;
          }
          38%,
          62% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes edg_emojiFloat {
          0%,
          100% {
            transform: translate(-50%, -50%) translateY(0px) rotate(-1deg);
            filter: drop-shadow(0 10px 26px rgba(0, 0, 0, 0.45));
          }
          50% {
            transform: translate(-50%, -50%) translateY(-3px) rotate(1deg);
            filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.55));
          }
        }

        @keyframes edg_bubbleA {
          0%,
          100% {
            transform: translateY(0px) scale(1);
            opacity: 0.9;
          }
          50% {
            transform: translateY(-4px) scale(1.04);
            opacity: 1;
          }
        }

        @keyframes edg_bubbleB {
          0%,
          100% {
            transform: translateY(0px) scale(1);
            opacity: 0.85;
          }
          50% {
            transform: translateY(3px) scale(1.03);
            opacity: 1;
          }
        }

        @keyframes edg_bugJitter {
          0%,
          100% {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          20% {
            transform: translate(-50%, -50%) rotate(-1.2deg);
          }
          40% {
            transform: translate(-50%, -50%) rotate(1.2deg);
          }
          60% {
            transform: translate(-50%, -50%) rotate(-0.8deg);
          }
          80% {
            transform: translate(-50%, -50%) rotate(0.8deg);
          }
        }

        @keyframes edg_bugScan {
          0% {
            transform: translateY(0px);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translateY(120px);
            opacity: 0;
          }
        }

        @keyframes edg_bugPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.35);
            opacity: 1;
          }
        }

        /* class bindings */
        .edg-anim-shimmer {
          animation: edg_shimmer 2.6s ease-in-out infinite;
        }
        .edg-anim-shimmer-slow {
          animation: edg_shimmer 2.8s ease-in-out infinite;
        }
        .edg-anim-docs-float {
          animation: edg_docsFloat 3.2s ease-in-out infinite;
        }
        .edg-anim-form-drift {
          animation: edg_formDrift 3.6s ease-in-out infinite;
        }
        .edg-anim-cursor {
          animation: edg_cursor 1.2s steps(2, end) infinite;
        }
        .edg-anim-text-grow {
          animation: edg_textGrow 2.7s ease-in-out infinite;
          width: 0rem;
        }
        .edg-anim-check {
          animation: edg_check 3s ease-in-out infinite;
        }
        .edg-anim-emoji-float {
          animation: edg_emojiFloat 3s ease-in-out infinite;
        }
        .edg-anim-bubble-a {
          animation: edg_bubbleA 2.8s ease-in-out infinite;
        }
        .edg-anim-bubble-b {
          animation: edg_bubbleB 3.1s ease-in-out infinite;
        }
        .edg-anim-bug-jitter {
          animation: edg_bugJitter 2.4s ease-in-out infinite;
        }
        .edg-anim-bug-scan {
          animation: edg_bugScan 2.8s ease-in-out infinite;
        }
        .edg-anim-bug-pulse {
          animation: edg_bugPulse 1.6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
