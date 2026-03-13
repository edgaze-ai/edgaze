"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { List, X } from "lucide-react";
import type { TOCItem } from "../utils/extractToc";

export default function DocTOC({ items }: { items: TOCItem[] }) {
  const trackGradId = useId().replace(/:/g, "-");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [scrollTick, setScrollTick] = useState(0);

  // Reset refs when items change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  // All visible headings: span the full viewport, generous margins for ultra smooth feel
  useEffect(() => {
    if (items.length === 0) return;

    const headingIds = items.map((i) => i.id);
    const inViewRef = { current: new Set<string>() };

    const run = () => {
      const els = headingIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));
      const sorted = [...els].sort((a, b) => a.offsetTop - b.offsetTop);

      const TRIGGER = 180;
      const updateActive = () => {
        const inView = inViewRef.current;
        let lastPassed: string | null = null;
        for (const el of sorted) {
          const rect = el.getBoundingClientRect();
          if (rect.top < TRIGGER) lastPassed = el.id;
        }
        if (inView.size > 0) {
          const inOrder = sorted.filter((el) => inView.has(el.id)).map((el) => el.id);
          setActiveIds(inOrder.length > 0 ? inOrder : lastPassed ? [lastPassed] : []);
        } else {
          setActiveIds(lastPassed ? [lastPassed] : sorted.length ? [sorted[0]!.id] : []);
        }
      };

      const observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const id = e.target.id;
            if (e.isIntersecting) inViewRef.current.add(id);
            else inViewRef.current.delete(id);
          }
          updateActive();
        },
        { root: null, rootMargin: "120px 0px 80px 0px", threshold: 0 }
      );

      sorted.forEach((el) => observer.observe(el));
      updateActive();

      let raf: number | undefined;
      const onScroll = () => {
        if (raf != null) return;
        raf = requestAnimationFrame(() => {
          raf = undefined;
          updateActive();
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", onScroll);
        if (raf != null) cancelAnimationFrame(raf);
        observer.disconnect();
      };
    };

    let dispose: (() => void) | undefined;
    const t = setTimeout(() => {
      dispose = run();
    }, 100);
    return () => {
      clearTimeout(t);
      dispose?.();
    };
  }, [items.map((i) => i.id).join("|")]);

  // Grey default track: bent path for ALL items (spans full TOC)
  const [trackPath, setTrackPath] = useState<{
    segments: { top: number; bottom: number; level: number }[];
  } | null>(null);

  useLayoutEffect(() => {
    if (items.length === 0 || !trackRef.current) {
      setTrackPath(null);
      return;
    }
    const track = trackRef.current;
    const trackRect = track.getBoundingClientRect();
    const trackTop = trackRect.top;
    const segments: { top: number; bottom: number; level: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const el = itemRefs.current[i];
      const item = items[i];
      if (!el || !item) continue;
      const r = el.getBoundingClientRect();
      segments.push({
        top: r.top - trackTop,
        bottom: r.bottom - trackTop,
        level: item.level,
      });
    }
    if (segments.length > 0) setTrackPath({ segments });
  }, [items, scrollTick]);

  // Progress: firstIdx and lastIdx into trackPath (gradient flows ON the track via dash)
  const [progressRange, setProgressRange] = useState<{ firstIdx: number; lastIdx: number } | null>(null);

  useLayoutEffect(() => {
    if (activeIds.length === 0) {
      setProgressRange(null);
      return;
    }
    const indices = items
      .map((item, idx) => (activeIds.includes(item.id) ? idx : -1))
      .filter((i) => i >= 0);
    if (indices.length === 0) {
      setProgressRange(null);
      return;
    }
    setProgressRange({
      firstIdx: Math.min(...indices),
      lastIdx: Math.max(...indices),
    });
  }, [activeIds, items]);

  // Recompute bar position when TOC nav scrolls (so line stays clamped)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => setScrollTick((t) => t + 1);
    nav.addEventListener("scroll", onScroll, { passive: true });
    return () => nav.removeEventListener("scroll", onScroll);
  }, []);

  const handleTocClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Auto-scroll TOC so the active item stays in a stable position (higher in view)
  const primaryId = activeIds.length > 0 ? activeIds[activeIds.length - 1] : null;
  const primaryIndex = primaryId != null ? items.findIndex((i) => i.id === primaryId) : -1;
  const lastScrolledToRef = useRef<number>(-1);

  useLayoutEffect(() => {
    if (primaryIndex < 0) return;
    const el = itemRefs.current[primaryIndex];
    const nav = navRef.current;
    if (!el || !nav) return;
    const TARGET_OFFSET = 56;
    const SLACK = 24;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const idealTop = navRect.top + TARGET_OFFSET;
    const isAbove = elRect.top < idealTop - SLACK;
    const isBelow = elRect.bottom > navRect.bottom - SLACK;
    const needsScroll = isAbove || isBelow;
    if (needsScroll && lastScrolledToRef.current !== primaryIndex) {
      lastScrolledToRef.current = primaryIndex;
      const targetScroll = Math.max(0, el.offsetTop - TARGET_OFFSET);
      nav.scrollTo({ top: targetScroll, behavior: "smooth" });
    } else if (!needsScroll) {
      lastScrolledToRef.current = primaryIndex;
    }
  }, [primaryIndex]);

  return (
    <>
      {/* Mobile TOC Button */}
      {items.length > 0 && (
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-3 shadow-lg hover:bg-white/15 transition-all"
            aria-label="Table of contents"
          >
            <List className="h-5 w-5 text-white/90" />
            <span className="text-sm font-medium text-white/90">Contents</span>
          </button>
        </div>
      )}

      {/* Mobile TOC Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-[#0b0b0f] border-l border-white/10 shadow-2xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
              <div className="text-sm font-semibold text-white/90">On this page</div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>
            <div className="h-[calc(100%-56px)] overflow-auto p-4">
              <nav className="flex flex-col gap-0.5">
                {items.map((t, idx) => {
                  const indentClass =
                    t.level === 2 ? "pl-3" : t.level === 3 ? "pl-5" : "pl-7";
                  return (
                    <a
                      key={`${idx}-${t.id}`}
                      href={`#${t.id}`}
                      onClick={(e) => {
                        handleTocClick(e, t.id);
                        setMobileOpen(false);
                      }}
                      className={`text-sm py-2 px-3 rounded-lg transition-all duration-200 ${indentClass} ${
                        activeIds.includes(t.id)
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/55 hover:text-white/85 hover:bg-white/5"
                      }`}
                    >
                      {t.text}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Desktop TOC */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <div className="text-[11px] uppercase tracking-wider text-white/35 mb-3">
            On this page
          </div>
          {items.length > 0 ? (
            <div className="relative pl-0 min-h-[40px] overflow-hidden" ref={trackRef}>
              <nav
                ref={(el) => {
                  navRef.current = el;
                }}
                className="flex flex-col gap-0.5 relative max-h-[calc(100vh-8rem)] overflow-auto z-0"
              >
                {items.map((t, idx) => {
                  const isActive = activeIds.includes(t.id);
                  const isPrimary = t.id === primaryId;
                  const indentClass =
                    t.level === 2 ? "pl-4" : t.level === 3 ? "pl-6" : "pl-8";
                  return (
                    <a
                      key={`${idx}-${t.id}`}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      href={`#${t.id}`}
                      onClick={(e) => handleTocClick(e, t.id)}
                      className={`relative block ${indentClass} pr-2 py-1 text-sm leading-snug transition-all duration-200 ${
                        isActive
                          ? isPrimary
                            ? "font-semibold text-white"
                            : "font-medium text-white/95"
                          : "text-white/55 hover:text-white/85"
                      }`}
                    >
                      {t.text}
                    </a>
                  );
                })}
              </nav>
              {/* Single track: grey base; gradient flows ON it via stroke-dash (no separate layer) */}
              {trackPath && trackPath.segments.length > 0 && (() => {
                const X_STEM = 1;
                const X_INDENT = 10;
                const STROKE = 2;
                const segs = trackPath.segments;

                const { path: fullPath, lengthAtEnd } = (() => {
                  const parts: string[] = [];
                  const lens: number[] = [];
                  let x = X_STEM;
                  let y = segs[0]!.top;
                  let total = 0;

                  const add = (nx: number, ny: number) => {
                    const d = Math.hypot(nx - x, ny - y);
                    total += d;
                    parts.push(`L ${nx} ${ny}`);
                    x = nx;
                    y = ny;
                  };

                  parts.push(`M ${X_STEM} ${segs[0]!.top}`);
                  let onStem = true;

                  for (let i = 0; i < segs.length; i++) {
                    const s = segs[i]!;
                    if (s.level === 2) {
                      if (onStem) add(X_STEM, s.bottom);
                      else {
                        add(X_STEM, s.top);
                        add(X_STEM, s.bottom);
                        onStem = true;
                      }
                    } else {
                      if (onStem) {
                        add(X_STEM, s.top);
                        add(X_INDENT, s.top);
                        add(X_INDENT, s.bottom);
                        onStem = false;
                      } else add(X_INDENT, s.bottom);
                    }
                    lens.push(total);
                  }
                  if (!onStem) {
                    add(X_STEM, segs[segs.length - 1]!.bottom);
                    lens.push(total);
                  }

                  return { path: parts.join(" "), lengthAtEnd: lens };
                })();

                const totalLen = lengthAtEnd[lengthAtEnd.length - 1] ?? 1;
                let dashStart = 0;
                let dashLen = 0;
                if (progressRange && totalLen > 0) {
                  const { firstIdx, lastIdx } = progressRange;
                  dashStart = firstIdx > 0 ? (lengthAtEnd[firstIdx - 1] ?? 0) : 0;
                  dashLen = (lengthAtEnd[lastIdx] ?? totalLen) - dashStart;
                  dashLen = Math.max(0, Math.min(dashLen, totalLen - dashStart));
                }

                return (
                  <svg
                    className="absolute left-0 top-0 w-6 h-full pointer-events-none z-10 overflow-hidden"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient id={trackGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(34, 211, 238)" />
                        <stop offset="50%" stopColor="rgb(56, 189, 248)" />
                        <stop offset="100%" stopColor="rgb(236, 72, 153)" />
                      </linearGradient>
                    </defs>
                    <path
                      d={fullPath}
                      fill="none"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth={STROKE}
                      strokeLinecap="butt"
                      strokeLinejoin="miter"
                    />
                    <path
                      d={fullPath}
                      fill="none"
                      stroke={`url(#${trackGradId})`}
                      strokeWidth={STROKE}
                      strokeLinecap="butt"
                      strokeLinejoin="miter"
                      strokeDasharray={dashLen > 0 ? `${dashLen} ${totalLen + 10}` : "0 9999"}
                      strokeDashoffset={dashLen > 0 ? -dashStart : 0}
                      style={{ transform: "translateZ(0)" }}
                    />
                  </svg>
                );
              })()}
            </div>
          ) : (
            <div className="text-sm text-white/35 italic">
              No sections available
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
