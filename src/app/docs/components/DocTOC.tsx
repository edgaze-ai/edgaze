"use client";

import { useState } from "react";
import { List, X } from "lucide-react";

type TOCItem = {
  id: string;
  text: string;
};

export default function DocTOC({ items }: { items: TOCItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
                {items.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-white/55 hover:text-white/85 transition py-2 px-3 rounded-lg hover:bg-white/5"
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
            <div className="border-l border-white/10 pl-4">
              <nav className="flex flex-col gap-2">
                {items.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className="text-sm text-white/55 hover:text-white/85 transition"
                  >
                    {t.text}
                  </a>
                ))}
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
