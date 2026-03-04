"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { List, X } from "lucide-react";

type TOCItem = {
  id: string;
  text: string;
};

export default function DocTOC({ items }: { items: TOCItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [barStyle, setBarStyle] = useState<{ top: number; height: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // Reset refs when items change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  // IntersectionObserver: run after mount so headings exist
  useEffect(() => {
    if (items.length === 0) return;

    const headingIds = items.map((i) => i.id);

    const run = () => {
      const elements = headingIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));

      if (elements.length === 0) return;

      // Helpers: get all headings currently in viewport (any part visible), in document order
      const getVisibleInViewport = () => {
        const viewportTop = 0;
        const viewportBottom = window.innerHeight;
        const inView: string[] = [];
        const sorted = [...elements].sort((a, b) => a.offsetTop - b.offsetTop);
        for (const el of sorted) {
          const rect = el.getBoundingClientRect();
          if (rect.bottom >= viewportTop && rect.top <= viewportBottom) {
            if (el.id) inView.push(el.id);
          }
        }
        return inView;
      };

      // Initial: all sections visible on load
      setActiveIds(getVisibleInViewport());

      // Any heading that has any part visible in the viewport counts as "on screen"
      const observer = new IntersectionObserver(
        () => {
          const visible = getVisibleInViewport();
          if (visible.length > 0) {
            setActiveIds(visible);
          } else {
            // Fallback: last heading above the fold
            const scrollY = window.scrollY;
            const sorted = [...elements].sort((a, b) => a.offsetTop - b.offsetTop);
            let current: string | null = null;
            for (const el of sorted) {
              if (el.offsetTop <= scrollY + 120) current = el.id;
              else break;
            }
            setActiveIds(current ? [current] : []);
          }
        },
        {
          root: null,
          rootMargin: "0px 0px 0px 0px",
          threshold: 0,
        }
      );

      elements.forEach((el) => observer.observe(el));
      return () => observer.disconnect();
    };

    const t = setTimeout(run, 100);
    return () => clearTimeout(t);
  }, [items.map((i) => i.id).join("|")]);

  // Single progress bar: position relative to the track so it starts at the top of the first active link
  useLayoutEffect(() => {
    if (activeIds.length === 0 || !trackRef.current) {
      setBarStyle(null);
      return;
    }
    const track = trackRef.current;
    const trackRect = track.getBoundingClientRect();
    const indices = items
      .map((item, idx) => (activeIds.includes(item.id) ? idx : -1))
      .filter((i) => i >= 0);
    if (indices.length === 0) {
      setBarStyle(null);
      return;
    }
    const firstIdx = Math.min(...indices);
    const lastIdx = Math.max(...indices);
    const firstEl = itemRefs.current[firstIdx];
    const lastEl = itemRefs.current[lastIdx];
    if (!firstEl || !lastEl) {
      setBarStyle(null);
      return;
    }
    const firstR = firstEl.getBoundingClientRect();
    const lastR = lastEl.getBoundingClientRect();
    const top = firstR.top - trackRect.top;
    const height = lastR.bottom - firstR.top;
    setBarStyle({ top, height });
  }, [activeIds, items]);

  const handleTocClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const primaryId = activeIds.length > 0 ? activeIds[activeIds.length - 1] : null;

  // Auto-scroll TOC so the active section stays visible when it changes
  const primaryIndex = primaryId != null ? items.findIndex((i) => i.id === primaryId) : -1;

  useLayoutEffect(() => {
    if (primaryIndex < 0) return;
    const el = itemRefs.current[primaryIndex];
    if (el && trackRef.current) {
      const track = trackRef.current;
      const trackRect = track.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const isAbove = elRect.top < trackRect.top;
      const isBelow = elRect.bottom > trackRect.bottom;
      if (isAbove || isBelow) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  }, [primaryIndex, activeIds.join(",")]);

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
              <nav className="flex flex-col gap-2">
                {items.map((t, idx) => (
                  <a
                    key={`${idx}-${t.id}`}
                    href={`#${t.id}`}
                    onClick={(e) => {
                      handleTocClick(e, t.id);
                      setMobileOpen(false);
                    }}
                    className={`text-sm py-2 px-3 rounded-lg transition ${
                      activeIds.includes(t.id)
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/55 hover:text-white/85 hover:bg-white/5"
                    }`}
                  >
                    {t.text}
                  </a>
                ))}
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
            <div className="relative border-l border-white/10 pl-0 min-h-[40px]" ref={trackRef}>
              {/* Single continuous bar (Edgaze gradient) */}
              {barStyle && (
                <span
                  className="absolute left-0 w-[2px] rounded-full bg-gradient-to-b from-cyan-400 via-sky-400 to-indigo-400"
                  style={{
                    top: barStyle.top,
                    height: Math.max(barStyle.height, 4),
                  }}
                  aria-hidden
                />
              )}
              <nav className="flex flex-col gap-1.5 relative max-h-[calc(100vh-8rem)] overflow-auto">
                {items.map((t, idx) => {
                  const isActive = activeIds.includes(t.id);
                  const isPrimary = t.id === primaryId;
                  return (
                    <a
                      key={`${idx}-${t.id}`}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      href={`#${t.id}`}
                      onClick={(e) => handleTocClick(e, t.id)}
                      className={`relative block pl-4 pr-2 py-1.5 text-sm transition-colors ${
                        isActive
                          ? isPrimary
                            ? "font-medium text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300"
                            : "text-white/90 font-medium"
                          : "text-white/55 hover:text-white/85"
                      }`}
                    >
                      {t.text}
                    </a>
                  );
                })}
              </nav>
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
