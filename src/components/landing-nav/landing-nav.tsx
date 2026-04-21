"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Menu, X } from "lucide-react";
import { LANDING_MEGA_NAV } from "./landing-nav-config";
import { MegaMenuPanelBody, MegaNavItemIcon } from "./mega-menu-panel";
import { LandingLink } from "./LandingLink";
import { useMegaMenu } from "./useMegaMenu";

/** Smooth “premium” ease: fast settle, no bounce (cubic bezier). */
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_OUT_SOFT: [number, number, number, number] = [0.16, 1, 0.32, 1];
/** Section swap: blink-fast, stays readable (no full fade). */
const SECTION_CHANGE_MS = 0.11;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type LandingNavProps = {
  onTop: boolean;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
};

export function LandingNav({ onTop, scrollerRef }: LandingNavProps) {
  const reduce = useReducedMotion();
  const { openId, requestOpen, scheduleClose, cancelClose, closeNow } = useMegaMenu();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const activeGroup = useMemo(
    () => LANDING_MEGA_NAV.find((g) => g.id === openId) ?? null,
    [openId],
  );

  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const onFocusOut = () => {
      requestAnimationFrame(() => {
        if (!el.contains(document.activeElement)) scheduleClose();
      });
    };
    el.addEventListener("focusout", onFocusOut);
    return () => el.removeEventListener("focusout", onFocusOut);
  }, [scheduleClose]);

  return (
    <header
      className={cn("fixed left-0 right-0 top-0 z-50", "transition-all duration-300")}
      role="banner"
    >
      <div className="mx-auto w-full min-w-0 max-w-[1400px] px-3 pt-3 sm:px-4 sm:pt-4 md:px-5 md:pt-5 md:max-w-[1500px]">
        <div
          className={cn(
            "flex lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-between lg:justify-normal min-w-0",
            "rounded-full",
            "pl-3.5 pr-2 py-1.5 sm:pl-4 sm:pr-[10px] sm:py-2 md:pl-5 lg:pl-6 md:py-2.5",
            "gap-2 sm:gap-3 lg:gap-6 xl:gap-8",
            "bg-white/[0.06] backdrop-blur-2xl border border-white/[0.06]",
            "shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_0_0_1px_rgba(255,255,255,0.03),0_4px_24px_-4px_rgba(0,0,0,0.25)]",
            "transition-all duration-300 ease-out",
            !onTop &&
              "bg-white/[0.08] border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.07)_inset,0_0_0_1px_rgba(255,255,255,0.04),0_8px_32px_-4px_rgba(0,0,0,0.35)]",
          )}
        >
          <LandingLink
            scrollerRef={scrollerRef}
            href="#top"
            className="flex items-center gap-2 shrink-0 text-white hover:opacity-90 transition-opacity lg:justify-self-start min-w-0"
            aria-label="Edgaze home"
          >
            <img
              src="/brand/edgaze-mark.png"
              alt="Edgaze"
              className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
            />
            <span className="text-[13px] font-semibold tracking-tight sm:text-[14px] md:text-[15px]">
              Edgaze
            </span>
          </LandingLink>

          <div
            ref={zoneRef}
            className="relative z-[60] hidden min-w-0 lg:block lg:justify-self-center"
            onMouseLeave={(e) => {
              const next = e.relatedTarget;
              if (next instanceof Node && zoneRef.current?.contains(next)) return;
              scheduleClose();
            }}
          >
            <nav
              aria-label="Primary navigation"
              className="flex items-center gap-1 xl:gap-2"
              onMouseEnter={cancelClose}
            >
              {LANDING_MEGA_NAV.map((g) => {
                const open = openId === g.id;
                return (
                  <LandingLink
                    key={g.id}
                    href={g.href ?? "/"}
                    scrollerRef={scrollerRef}
                    className={cn(
                      "flex items-center gap-0.5 rounded-full px-2.5 py-2 text-[13px] transition-colors",
                      open ? "text-white" : "text-white/75 hover:text-white",
                    )}
                    aria-expanded={open}
                    aria-haspopup="true"
                    aria-controls="landing-mega-panel"
                    onMouseEnter={() => requestOpen(g.id)}
                    onFocus={() => requestOpen(g.id)}
                  >
                    {g.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-white/50 transition-transform duration-200",
                        open && "rotate-180",
                      )}
                    />
                  </LandingLink>
                );
              })}
            </nav>

            <div
              className="absolute left-1/2 top-full z-[70] w-[min(1100px,calc(100vw-2.5rem))] -translate-x-1/2 pt-3"
              onMouseEnter={cancelClose}
            >
              {/* Outer shell = real open/close. Inner motion = fast tick on section change only (high min opacity so it never reads as closing). */}
              <AnimatePresence initial={false}>
                {openId && activeGroup ? (
                  <motion.div
                    key="landing-mega-open"
                    id="landing-mega-panel"
                    role="region"
                    aria-label={`${activeGroup.label} navigation`}
                    className="w-full"
                    initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            opacity: { duration: 0.22, ease: EASE_OUT_SOFT },
                            y: { duration: 0.26, ease: EASE_OUT },
                          }
                    }
                  >
                    <motion.div
                      key={openId}
                      className="min-w-0 will-change-[opacity,transform]"
                      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0.93, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduce ? 0 : SECTION_CHANGE_MS,
                        ease: EASE_OUT,
                      }}
                    >
                      <MegaMenuPanelBody
                        group={activeGroup}
                        scrollerRef={scrollerRef}
                        afterNavigate={closeNow}
                      />
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:justify-self-end">
            <a
              href="/marketplace"
              className={cn(
                "hidden lg:inline-flex items-center justify-center",
                "rounded-full px-4 py-2 md:px-5 text-[12px] md:text-[13px] font-medium text-white",
                "bg-white/10 hover:bg-white/15",
                "border border-white/10",
                "active:scale-[0.98] transition-all duration-200",
                "whitespace-nowrap",
              )}
            >
              Open marketplace
            </a>

            <button
              type="button"
              className={cn(
                "inline-flex min-h-10 min-w-10 items-center justify-center lg:hidden",
                "-translate-x-0 sm:-translate-x-[10px] -mr-0.5 sm:-mr-1.5 pl-0 sm:pl-1 text-white/85 hover:text-white",
                "transition-colors duration-200 active:opacity-80",
              )}
              aria-expanded={mobileOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? (
                <X className="h-6 w-6 stroke-[1.75]" />
              ) : (
                <Menu className="h-6 w-6 stroke-[1.75]" />
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-[80] lg:hidden"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              id="landing-mobile-nav"
              className="absolute right-0 top-0 flex h-[100dvh] w-full max-w-md flex-col border-l border-white/10 bg-[#07080b] shadow-[-24px_0_80px_rgba(0,0,0,0.55)]"
              initial={reduce ? false : { x: "100%" }}
              animate={reduce ? undefined : { x: 0 }}
              exit={reduce ? undefined : { x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <span className="text-sm font-semibold text-white">Menu</span>
                <button
                  type="button"
                  className="inline-flex min-h-10 min-w-10 items-center justify-end pr-1 text-white/80 hover:text-white transition-colors"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6 stroke-[1.75]" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                {LANDING_MEGA_NAV.map((g) => {
                  const exp = mobileExpanded === g.id;
                  return (
                    <div
                      key={g.id}
                      className="mb-1 border-b border-white/[0.07] pb-1 last:border-b-0"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3.5 text-left text-sm font-medium text-white/90 hover:bg-white/[0.04]"
                        aria-expanded={exp}
                        onClick={() => setMobileExpanded((x) => (x === g.id ? null : g.id))}
                      >
                        {g.label}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-white/45 transition-transform",
                            exp && "rotate-180",
                          )}
                        />
                      </button>
                      {exp ? (
                        <div className="space-y-1 px-1 pb-3">
                          {g.featured ? (
                            <LandingLink
                              scrollerRef={scrollerRef}
                              afterNavigate={() => {
                                closeNow();
                                setMobileOpen(false);
                              }}
                              href={g.featured.href}
                              className={cn(
                                "mb-3 block rounded-2xl p-4 ring-1 ring-cyan-400/20",
                                "bg-[#0a0b10] hover:bg-[#0d0e14]",
                              )}
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/70">
                                Featured
                              </div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {g.featured.title}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-white/55">
                                {g.featured.description}
                              </p>
                              <div className="mt-3 text-xs font-medium text-cyan-300/90">
                                {g.featured.ctaLabel} →
                              </div>
                            </LandingLink>
                          ) : null}
                          {g.columns
                            .flatMap((c) => c.items)
                            .map((item) => {
                              return (
                                <LandingLink
                                  scrollerRef={scrollerRef}
                                  afterNavigate={() => {
                                    closeNow();
                                    setMobileOpen(false);
                                  }}
                                  key={`${g.id}-${item.href}-${item.title}`}
                                  href={item.href}
                                  className={cn(
                                    "flex gap-3 rounded-xl p-3 transition-colors",
                                    "hover:bg-white/[0.05] ring-1 ring-transparent hover:ring-white/[0.08]",
                                  )}
                                >
                                  <MegaNavItemIcon item={item} />
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white/95">
                                      {item.title}
                                    </div>
                                    <p className="mt-0.5 text-xs leading-relaxed text-white/55">
                                      {item.description}
                                    </p>
                                  </div>
                                </LandingLink>
                              );
                            })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
