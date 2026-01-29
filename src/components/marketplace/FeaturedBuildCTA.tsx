"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "featured" | "compact";

/**
 * Premium CTA: "Create Your Own" / "Start Building".
 * variant "featured" = large card (random in feed). variant "compact" = slim bar (permanent under code section).
 */
export default function FeaturedBuildCTA({ variant = "featured" }: { variant?: Variant }) {
  const router = useRouter();

  const handleClick = () => {
    router.push("/builder");
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "group relative w-full cursor-pointer rounded-2xl text-left",
          "flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between",
          "border border-white/10 px-5 py-4 sm:px-6 sm:py-4",
          "bg-[#0a0b0f]/95 backdrop-blur-xl",
          "shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
          "transition-all duration-300 ease-out",
          "hover:border-white/15 hover:shadow-[0_16px_48px_rgba(0,0,0,0.45)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
        )}
        aria-label="Start building. Prompts and workflows, made simple."
      >
        {/* Edgaze vibe: faint cyan → pink gradient glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-100"
          aria-hidden
        >
          <div
            className="absolute -inset-px rounded-2xl opacity-50 blur-sm transition-opacity duration-300 group-hover:opacity-60"
            style={{
              background:
                "linear-gradient(135deg, rgba(34,211,238,0.12) 0%, rgba(56,189,248,0.06) 45%, rgba(236,72,153,0.10) 100%)",
            }}
          />
          <div
            className="absolute inset-0 rounded-2xl opacity-90"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 15% 50%, rgba(34,211,238,0.06), transparent 50%), radial-gradient(ellipse 60% 70% at 85% 50%, rgba(236,72,153,0.05), transparent 50%)",
            }}
          />
        </div>
        <div
          className="absolute inset-[1px] rounded-[15px] border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
          aria-hidden
        />

        <div className="relative flex min-w-0 flex-col gap-1 sm:gap-1.5">
          <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
            Build your own
          </span>
          <span className="text-sm text-white/55 sm:text-[15px] leading-snug">
            Prompts and workflows, made simple.
          </span>
        </div>
        <span
          className={cn(
            "relative shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white/95",
            "bg-white/10 ring-1 ring-white/15",
            "transition-all duration-300 ease-out",
            "hover:bg-white/15 hover:ring-white/20 hover:text-white",
            "active:scale-[0.98]"
          )}
        >
          Start building
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group relative w-full cursor-pointer rounded-2xl text-left",
        "min-h-[280px] sm:min-h-[300px]",
        "border border-white/10",
        "bg-[#0a0b0f]/95 backdrop-blur-xl",
        "shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
        "transition-all duration-300 ease-out",
        "hover:border-white/20 hover:shadow-[0_28px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]",
        "hover:-translate-y-1",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]",
        "lg:col-span-2"
      )}
      aria-label="Start building — create your own prompts and workflows"
    >
      {/* Faint cyan → pink gradient glow (Edgaze brand) */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-100"
        aria-hidden
      >
        <div
          className="absolute -inset-px rounded-2xl opacity-40 blur-sm transition-opacity duration-300 group-hover:opacity-60"
          style={{
            background:
              "linear-gradient(135deg, rgba(34,211,238,0.12) 0%, rgba(56,189,248,0.08) 40%, rgba(236,72,153,0.10) 70%, rgba(236,72,153,0.08) 100%)",
          }}
        />
        <div
          className="absolute inset-0 rounded-2xl opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 20% 40%, rgba(34,211,238,0.08), transparent 55%), radial-gradient(ellipse 70% 60% at 80% 60%, rgba(236,72,153,0.07), transparent 55%)",
          }}
        />
      </div>

      {/* Soft glass surface */}
      <div
        className="absolute inset-[1px] rounded-[15px] border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
        aria-hidden
      />

      {/* Content */}
      <div className="relative flex min-h-[280px] sm:min-h-[300px] flex-col justify-between p-6 sm:p-8">
        <div className="flex-1">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300/80" />
            <span>Your space</span>
          </div>

          <h3 className="text-2xl font-semibold tracking-tight text-white/95 sm:text-3xl">
            Create your own
          </h3>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-white/60 sm:text-lg">
            This is where you make something new. No jargon — just you and your idea.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-sm font-medium text-white/90 transition-colors group-hover:text-white">
          <span>Start building</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Hover glow */}
      <div
        className="pointer-events-none absolute -inset-1 rounded-[18px] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 30% 30%, rgba(34,211,238,0.15), transparent 50%), radial-gradient(ellipse 50% 50% at 70% 70%, rgba(236,72,153,0.12), transparent 50%)",
        }}
      />
    </button>
  );
}
