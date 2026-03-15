"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, ChevronDown, Briefcase } from "lucide-react";

const SORT_OPTIONS = ["Date added", "Relevance"] as const;
const LEVEL_FILTERS = ["Senior", "Junior", "Internship"] as const;
const LOCATION_FILTERS = ["Remote", "Hybrid", "On-site"] as const;
const TYPE_FILTERS = ["Full-time", "Part-time", "Contract"] as const;

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

function NoJobsAnimation() {
  return (
    <div className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute left-1/2 top-1/2 h-64 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/[0.04] blur-3xl" />
      </div>

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Clean looping animation */}
      <motion.div
        className="relative mb-6"
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-white/[0.03] ring-1 ring-white/[0.08]"
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(34,211,238,0)",
              "0 0 24px 0 rgba(34,211,238,0.08)",
              "0 0 0 0 rgba(34,211,238,0)",
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Briefcase className="h-8 w-8 text-white/35" />
        </motion.div>
      </motion.div>

      <motion.p
        className="relative text-lg font-medium tracking-tight text-white/95 sm:text-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        No jobs available right now
      </motion.p>
      <motion.p
        className="relative mt-1.5 text-[13px] text-white/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        Check back soon
      </motion.p>
    </div>
  );
}

export default function CareersPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string>("Date added");
  const [level, setLevel] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const pillActive = "bg-white/[0.08] text-white ring-1 ring-white/15";
  const pillInactive =
    "text-white/50 hover:bg-white/[0.04] hover:text-white/80 ring-1 ring-white/[0.06]";

  const activeCount = [level, location, type].filter(Boolean).length;

  return (
    <div className="min-h-screen w-full bg-[#050608]">
      {/* Background — deep dark, subtle */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050608]" />
        <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.08),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(236,72,153,0.05),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 pt-20 sm:pt-24 pb-12 sm:pb-16">
        {/* Header: Logo + Careers only */}
        <header className="mb-12 sm:mb-16">
          <Link
            href="/"
            className="inline-flex items-center gap-3 sm:gap-4 group"
            aria-label="Edgaze home"
          >
            <img
              src="/brand/edgaze-mark.png"
              alt="Edgaze"
              className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 transition-transform group-hover:scale-105"
            />
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-white">
              Careers
            </h1>
          </Link>
        </header>

        {/* Filters — compact, expandable */}
        <section className="mb-8">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {/* Visible row: search + Date added + expand */}
            <div className="flex flex-wrap items-center gap-2 p-3 sm:p-3.5">
              <div className="relative flex-1 min-w-[180px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  type="text"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/10"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSort(opt)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[12px] font-medium transition-all",
                      sort === opt ? pillActive : pillInactive,
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFiltersExpanded((e) => !e)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all",
                  filtersExpanded || activeCount > 0 ? pillActive : pillInactive,
                )}
              >
                Filters {activeCount > 0 && `(${activeCount})`}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    filtersExpanded && "rotate-180",
                  )}
                />
              </button>
            </div>

            {/* Expandable filters */}
            <AnimatePresence>
              {filtersExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className="overflow-hidden border-t border-white/[0.05]"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 pt-3">
                    <div>
                      <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase block mb-2">
                        Level
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {LEVEL_FILTERS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setLevel((p) => (p === l ? null : l))}
                            className={cn(
                              "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all",
                              level === l ? pillActive : pillInactive,
                            )}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase block mb-2">
                        Location
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {LOCATION_FILTERS.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setLocation((p) => (p === loc ? null : loc))}
                            className={cn(
                              "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all",
                              location === loc ? pillActive : pillInactive,
                            )}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase block mb-2">
                        Type
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {TYPE_FILTERS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setType((p) => (p === t ? null : t))}
                            className={cn(
                              "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all",
                              type === t ? pillActive : pillInactive,
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Main jobs area — animated empty state */}
        <section className="mb-16">
          <NoJobsAnimation />
        </section>

        {/* About Edgaze */}
        <section className="mb-16 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
          <h2 className="text-[11px] font-semibold tracking-[0.2em] text-white/45 uppercase mb-4">
            About Edgaze
          </h2>
          <p className="text-[15px] leading-relaxed text-white/65 max-w-2xl">
            Edgaze is a marketplace for AI prompts and workflows. Creators build once, publish a
            clean product page, and share one link. We&apos;re building the infrastructure for the
            AI creator economy—making it easy to create, sell, and distribute AI products with
            clarity and trust.
          </p>
          <Link
            href="/about"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/75 hover:text-white transition-colors"
          >
            <span>Learn more</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-6 border-t border-white/[0.06]">
          <Link
            href="/about"
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-white/50 hover:text-white/80 transition-colors"
          >
            <span>About Edgaze</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="mailto:support@edgaze.ai?subject=Careers%20inquiry"
            className="inline-flex items-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.08] px-4 py-2 text-[13px] font-medium text-white/90 hover:bg-white/[0.09] transition-colors"
          >
            Get in touch
          </a>
        </footer>
      </div>
    </div>
  );
}
