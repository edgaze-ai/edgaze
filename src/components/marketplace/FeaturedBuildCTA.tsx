"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, X, FileText, Workflow } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "featured" | "compact";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    queueMicrotask(() => setIsMobile(mq.matches));
    const listener = () => setIsMobile(mq.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return isMobile;
}

/**
 * Premium CTA: "Create Your Own" / "Explore builders".
 * variant "featured" = large card in feed. variant "compact" = slim bar.
 * On click: desktop = modal (Prompt studio / Workflow studio); mobile = desktop-only message.
 */
export default function FeaturedBuildCTA({ variant = "featured" }: { variant?: Variant }) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = () => {
    setModalOpen(true);
  };

  const goToPromptStudio = () => {
    setModalOpen(false);
    router.push("/prompt-studio");
  };

  const goToWorkflowStudio = () => {
    setModalOpen(false);
    router.push("/builder");
  };

  if (variant === "compact") {
    return (
      <>
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
          aria-label="Explore builders. Prompts and workflows, made simple."
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
              Turn prompts and Workflows into powerful tools in minutes. No code. Share instantly. Monetize when ready.
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
            Explore builders
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </button>
        {modalOpen && (
          <ExploreBuildersModal
            isMobile={isMobile}
            onClose={() => setModalOpen(false)}
            onPromptStudio={goToPromptStudio}
            onWorkflowStudio={goToWorkflowStudio}
          />
        )}
      </>
    );
  }

  return (
    <>
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
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
        )}
        aria-label="Explore builders — Prompt studio and Workflow studio"
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
              Turn prompts and Workflows into powerful tools in minutes. No code. Share instantly. Monetize when ready.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-white/90 transition-colors group-hover:text-white">
            <span>Explore builders</span>
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

      {modalOpen && (
        <ExploreBuildersModal
          isMobile={isMobile}
          onClose={() => setModalOpen(false)}
          onPromptStudio={goToPromptStudio}
          onWorkflowStudio={goToWorkflowStudio}
        />
      )}
    </>
  );
}

function ExploreBuildersModal({
  isMobile,
  onClose,
  onPromptStudio,
  onWorkflowStudio,
}: {
  isMobile: boolean;
  onClose: () => void;
  onPromptStudio: () => void;
  onWorkflowStudio: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explore-builders-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-white/10",
          "bg-[#0a0b0f]/98 backdrop-blur-xl",
          "shadow-[0_24px_60px_rgba(0,0,0,0.5)]",
          "overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Edgaze gradient accent */}
        <div
          className="absolute inset-0 opacity-100 pointer-events-none"
          aria-hidden
        >
          <div
            className="absolute -inset-px rounded-2xl opacity-60 blur-sm"
            style={{
              background:
                "linear-gradient(135deg, rgba(34,211,238,0.15) 0%, rgba(56,189,248,0.08) 45%, rgba(236,72,153,0.12) 100%)",
            }}
          />
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34,211,238,0.08), transparent 50%), radial-gradient(ellipse 60% 60% at 80% 80%, rgba(236,72,153,0.06), transparent 50%)",
            }}
          />
        </div>
        <div className="absolute inset-[1px] rounded-[15px] border border-white/[0.06] bg-[#0a0b0f]/95" aria-hidden />

        <div className="relative p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <img src="/brand/edgaze-mark.png" alt="" className="h-10 w-10" />
              <h2 id="explore-builders-title" className="text-lg font-semibold text-white">
                Explore builders
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isMobile ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-center">
              <p className="text-sm text-amber-200/95 leading-relaxed">
                Building is desktop only. Visit Edgaze on a desktop device to start building.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition-colors"
              >
                Got it
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={onPromptStudio}
                className={cn(
                  "group flex flex-col items-start gap-3 rounded-xl border border-white/10 p-5 text-left",
                  "bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-400/30",
                  "transition-all duration-200 ease-out",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0f]"
                )}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 transition-colors group-hover:bg-cyan-500/25"
                  aria-hidden
                >
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-base font-semibold text-white">Prompt studio</span>
                  <p className="mt-1 text-xs text-white/55 leading-snug">
                    Create and publish prompts with placeholders. No code.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/50 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all mt-auto" />
              </button>

              <button
                type="button"
                onClick={onWorkflowStudio}
                className={cn(
                  "group flex flex-col items-start gap-3 rounded-xl border border-white/10 p-5 text-left",
                  "bg-white/[0.03] hover:bg-white/[0.06] hover:border-pink-400/30",
                  "transition-all duration-200 ease-out",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0f]"
                )}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/15 text-pink-400 transition-colors group-hover:bg-pink-500/25"
                  aria-hidden
                >
                  <Workflow className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-base font-semibold text-white">Workflow studio</span>
                  <p className="mt-1 text-xs text-white/55 leading-snug">
                    Visual workflows. Connect nodes, run and publish.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/50 group-hover:text-pink-400 group-hover:translate-x-0.5 transition-all mt-auto" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
