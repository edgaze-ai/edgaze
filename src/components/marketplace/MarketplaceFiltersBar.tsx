"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  SlidersHorizontal,
  X,
  Sparkles,
  TrendingUp,
  Flame,
  Clock,
  Tag,
  Zap,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Estimate chip width: horizontal padding + charWidth per character (~10–11px text)
function estChipWidth(label: string, isMobile: boolean): number {
  const px = isMobile ? 20 : 24;
  const charW = isMobile ? 5.5 : 6;
  return px + label.length * charW;
}

// Compute max topics that fit in given width
function fitTopics(
  availableWidth: number,
  topics: string[],
  gap: number,
  isMobile: boolean,
): number {
  const buffer = 4;
  let used = 0;
  for (let i = 0; i < topics.length; i++) {
    const w = estChipWidth(topics[i] ?? "", isMobile);
    if (i > 0) used += gap;
    if (used + w > availableWidth - buffer) return i;
    used += w;
  }
  return topics.length;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type MarketplaceSort = "curated" | "trending" | "popular" | "newest";
export type ContentType = "all" | "prompt" | "workflow";

export type PriceRange = {
  min: number | null;
  max: number | null;
};

export type MarketplaceFilters = {
  sort: MarketplaceSort;
  topic: string | null;
  contentType: ContentType;
  priceRange: PriceRange;
  topics: string[];
};

const SORT_OPTIONS: { value: MarketplaceSort; label: string; icon: React.ElementType }[] = [
  { value: "curated", label: "Curated", icon: Sparkles },
  { value: "trending", label: "Trending", icon: TrendingUp },
  { value: "popular", label: "Popular", icon: Flame },
  { value: "newest", label: "Newest", icon: Clock },
];

const TOPIC_OPTIONS = [
  "All",
  "Writing",
  "Summarization",
  "Translation",
  "Image",
  "Coding",
  "Analytics",
  "Productivity",
  "Creative",
  "Research",
  "Education",
  "Marketing",
  "Content",
  "Chat",
  "Extraction",
  "Analysis",
  "Design",
  "Copywriting",
  "Social",
  "Data",
  "Automation",
  "SEO",
  "Support",
  "Sales",
  "Video",
  "Audio",
  "Finance",
  "Legal",
  "Health",
  "HR",
  "Customer",
];

const PRICE_PRESETS = [
  { label: "Any price", min: null, max: null },
  { label: "Under $5", min: null, max: 5 },
  { label: "$5 – $20", min: 5, max: 20 },
  { label: "$20 – $50", min: 20, max: 50 },
  { label: "$50+", min: 50, max: null },
];

export default function MarketplaceFiltersBar({
  filters,
  onFiltersChange,
  activeFilterCount,
}: {
  filters: MarketplaceFilters;
  onFiltersChange: (f: MarketplaceFilters) => void;
  activeFilterCount: number;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [visibleTopicCount, setVisibleTopicCount] = useState(6);
  const [topicDropdownPos, setTopicDropdownPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const topicScrollRef = useRef<HTMLDivElement>(null);
  const topicMeasureRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const topicTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    queueMicrotask(() => setIsMobile(mq.matches));
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const updateTopicDropdownPos = useCallback(() => {
    const btn = topicTriggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdownWidth = 200;
    const left = Math.max(
      8,
      Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 8),
    );
    setTopicDropdownPos({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (topicDropdownOpen) {
      updateTopicDropdownPos();
    } else {
      queueMicrotask(() => setTopicDropdownPos(null));
    }
  }, [topicDropdownOpen, updateTopicDropdownPos]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (topicTriggerRef.current?.contains(target) || topicDropdownRef.current?.contains(target)) {
        return;
      }
      setTopicDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const el = topicMeasureRef.current;
    if (!el) return;
    const updateCount = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const gap = isMobile ? 6 : 8;
      const n = fitTopics(w, TOPIC_OPTIONS, gap, isMobile);
      setVisibleTopicCount(Math.max(1, Math.min(n, TOPIC_OPTIONS.length)));
    };
    updateCount();
    const ro = new ResizeObserver(updateCount);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  const visibleTopics = TOPIC_OPTIONS.slice(0, visibleTopicCount);
  const dropdownTopics = TOPIC_OPTIONS.slice(visibleTopicCount);

  const updateFilters = (patch: Partial<MarketplaceFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const setTopic = (t: string) => {
    updateFilters({ topic: t === "All" ? null : t });
  };

  const setPriceRange = (preset: { min: number | null; max: number | null }) => {
    updateFilters({
      priceRange: { min: preset.min, max: preset.max },
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      topic: null,
      contentType: "all",
      priceRange: { min: null, max: null },
      topics: [],
    });
    setCustomOpen(false);
  };

  // Keep inactive chips softly boxed in grey, but with more readable text.
  const pillInactive =
    "bg-zinc-900/35 border border-zinc-800/60 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-700/70 hover:text-zinc-100";
  // Darker active state so the selection feels more intentional.
  const pillActive =
    "bg-white text-black border border-transparent hover:bg-white/95 hover:border-transparent";

  return (
    <section className="relative z-[10] mb-3">
      <div className="rounded-xl bg-zinc-950/35 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center px-2 py-1 sm:px-3 sm:py-1" style={{ minHeight: 0 }}>
          {/* Scroll container — compact 25% smaller, more topics fit */}
          <div
            className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth scroll-pl-0 scroll-pr-4 flex items-center"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 min-w-max py-0.5">
              {/* Topics */}
              <div className="hidden flex items-center gap-1.5 shrink-0 min-w-0">
                <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-zinc-600 shrink-0" />
                <span className="text-[10px] font-semibold tracking-[0.08em] text-zinc-600 uppercase hidden lg:inline shrink-0">
                  Topics
                </span>
              </div>
              <div
                ref={(el) => {
                  (topicScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                  (topicMeasureRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }}
                className="flex gap-1.5 min-w-max shrink-0"
              >
                {TOPIC_OPTIONS.map((t) => {
                  const isAll = t === "All";
                  const selected = isAll ? !filters.topic : filters.topic === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      className={cn(
                        "shrink-0 rounded-md border font-medium transition-all duration-200 h-7 leading-none",
                        "text-[10px] px-2.5",
                        selected ? pillActive : pillInactive,
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              {/* Three-dot: only when using fit-based layout; with scroll we show all inline */}
              {false && dropdownTopics.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    ref={topicTriggerRef}
                    type="button"
                    onClick={() => setTopicDropdownOpen((o) => !o)}
                    className={cn(
                      "flex items-center justify-center rounded-lg border transition-all duration-200 shrink-0",
                      "w-6 h-6 sm:w-7 sm:h-7",
                      topicDropdownOpen ? pillActive : pillInactive,
                    )}
                    aria-expanded={topicDropdownOpen}
                    aria-haspopup="true"
                    title="More topics"
                  >
                    <MoreHorizontal className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </button>
                  {typeof document !== "undefined" &&
                    topicDropdownOpen &&
                    topicDropdownPos &&
                    createPortal(
                      <AnimatePresence>
                        <motion.div
                          ref={topicDropdownRef}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="fixed z-[9999] min-w-[180px] sm:min-w-[200px] rounded-xl border border-white/15 bg-[#141418]/98 backdrop-blur-md shadow-xl overflow-hidden"
                          style={{
                            top: topicDropdownPos!.top,
                            left: topicDropdownPos!.left,
                          }}
                        >
                          <div className="max-h-[260px] overflow-y-auto p-2 scrollbar-hide">
                            <div className="grid grid-cols-2 gap-1.5">
                              {dropdownTopics.map((t) => {
                                const isAll = t === "All";
                                const selected = isAll ? !filters.topic : filters.topic === t;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                      setTopic(t);
                                      setTopicDropdownOpen(false);
                                    }}
                                    className={cn(
                                      "text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors border",
                                      selected ? pillActive : pillInactive,
                                    )}
                                  >
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>,
                      document.body,
                    )}
                </div>
              )}
            </div>
          </div>
          {/* Filters — fixed to the right */}
          <div className="shrink-0 pl-1 pr-1 py-1">
            <button
              type="button"
              onClick={() => setCustomOpen((o) => !o)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md h-7 px-2 text-[10px] font-medium transition-all duration-200 border leading-none",
                // Always keep the Filters control white to match the premium chip style.
                pillActive,
              )}
            >
              <SlidersHorizontal className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 opacity-90" />
              <span className="whitespace-nowrap">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-zinc-600 px-0.5 text-[9px] font-bold text-zinc-200">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Custom filters panel */}
        <AnimatePresence>
          {customOpen && (
            <motion.div
              ref={panelRef}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden border-t border-zinc-800/50"
            >
              <div className="px-4 py-4 sm:px-5 sm:py-5 space-y-5">
                {/* Sort — only in this panel (not in the horizontal bar) */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-[11px] font-semibold tracking-wider text-white/45 uppercase">
                      Sort
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SORT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = filters.sort === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateFilters({ sort: opt.value })}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 border",
                            active ? pillActive : pillInactive,
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              active ? "text-zinc-300" : "text-zinc-600",
                            )}
                          />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Content type */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-[11px] font-semibold tracking-wider text-white/45 uppercase">
                      Content type
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["all", "prompt", "workflow"] as ContentType[]).map((ct) => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => updateFilters({ contentType: ct })}
                        className={cn(
                          "rounded-xl px-4 py-2.5 text-sm font-semibold capitalize transition-all duration-200 border",
                          filters.contentType === ct ? pillActive : pillInactive,
                        )}
                      >
                        {ct}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price range */}
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-white/45 uppercase block mb-3">
                    Price range
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRICE_PRESETS.map((preset) => {
                      const active =
                        filters.priceRange.min === preset.min &&
                        filters.priceRange.max === preset.max;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setPriceRange({ min: preset.min, max: preset.max })}
                          className={cn(
                            "rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 border",
                            active ? pillActive : pillInactive,
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Additional topics (multi-select for custom) */}
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-white/45 uppercase block mb-3">
                    Extra topics
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {TOPIC_OPTIONS.filter((t) => t !== "All").map((t) => {
                      const selected = filters.topics.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const next = selected
                              ? filters.topics.filter((x) => x !== t)
                              : [...filters.topics, t];
                            updateFilters({ topics: next });
                          }}
                          className={cn(
                            "rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 border",
                            selected ? pillActive : pillInactive,
                          )}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <X className="h-4 w-4" />
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
