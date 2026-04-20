"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Search, X } from "lucide-react";
import DocsSidebar from "./DocsSidebar";
import type { DocMeta } from "../utils/docs";

function docHref(slug: string) {
  return slug === "builder" ? "/docs/builder" : `/docs/${slug}`;
}

function groupLabel(doc: DocMeta) {
  return doc.category === "builder" ? "Builder" : "Docs";
}

function rankDocs(docs: DocMeta[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return docs.slice(0, 8);
  }

  return docs
    .map((doc) => {
      const title = doc.title.toLowerCase();
      const description = doc.description.toLowerCase();
      const slug = doc.slug.toLowerCase();
      let score = 0;

      if (title === normalizedQuery) score += 120;
      if (title.startsWith(normalizedQuery)) score += 70;
      if (title.includes(normalizedQuery)) score += 48;
      if (slug === normalizedQuery) score += 42;
      if (slug.includes(normalizedQuery)) score += 28;
      if (description.includes(normalizedQuery)) score += 14;

      return { doc, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
    .map((item) => item.doc);
}

function SearchResultsPanel({
  docs,
  query,
  pathname,
  onSelect,
}: {
  docs: DocMeta[];
  query: string;
  pathname: string;
  onSelect?: () => void;
}) {
  const trimmedQuery = query.trim();

  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#050505] shadow-[0_28px_90px_rgba(0,0,0,0.65)]">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/34">
          {trimmedQuery ? `${docs.length} matching docs` : "Suggested docs"}
        </div>
      </div>

      <div className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
        {docs.length > 0 ? (
          <div className="flex flex-col gap-1">
            {docs.map((doc) => {
              const href = docHref(doc.slug);
              const active = pathname === href;

              return (
                <Link
                  key={doc.slug}
                  href={href}
                  onClick={onSelect}
                  className={[
                    "rounded-[18px] border px-4 py-3 transition-colors",
                    active
                      ? "border-white/14 bg-white/[0.06]"
                      : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white/92">{doc.title}</div>
                      {doc.description ? (
                        <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-white/52">
                          {doc.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/34">
                      {groupLabel(doc)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <div className="text-sm font-medium text-white/72">No matching docs</div>
            <div className="mt-1 text-[13px] leading-6 text-white/42">
              Try a product name, policy title, or feature like workflow studio.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DocsShell({
  docs,
  children,
}: {
  docs: DocMeta[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(true);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setIsMobile(mq.matches);
      const ua = navigator.userAgent || "";
      const platform = navigator.platform || "";
      const isApple = /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS/.test(ua);
      setShortcutLabel(isApple ? "⌘ K" : "Ctrl K");
    };
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isApple =
        /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") ||
        /Mac OS/.test(navigator.userAgent || "");
      const wantsSearch =
        event.key.toLowerCase() === "k" && (isApple ? event.metaKey : event.ctrlKey);
      if (!wantsSearch) return;
      event.preventDefault();
      if (window.matchMedia("(max-width: 767px)").matches) {
        setMobileSearchOpen(true);
        setTimeout(() => {
          mobileSearchInputRef.current?.focus();
          mobileSearchInputRef.current?.select();
        }, 0);
        return;
      }
      setSearchOpen(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!searchRootRef.current?.contains(target)) {
        setSearchOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileSearchOpen]);

  const handleBackClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const filteredCount = useMemo(() => {
    return docs.length;
  }, [docs]);

  const searchResults = useMemo(() => rankDocs(docs, query), [docs, query]);

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      {/* Top bar - original structure, logo design only */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/25 backdrop-blur">
        <div className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="lg:hidden inline-flex items-center justify-center text-white/90 hover:text-white transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open docs menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <Link href="/docs" className="flex items-center gap-3">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={28}
                height={28}
                priority
                className="shrink-0 translate-y-[2px]"
              />
              <span className="text-[15px] font-medium tracking-tight text-white/90 -translate-x-[5px]">
                Edgaze <span className="text-white/50 font-normal">Docs</span>
              </span>
            </Link>
          </div>
          <div ref={searchRootRef} className="mx-auto w-full max-w-[720px] min-w-0">
            <div className="relative">
              <div className="hidden md:block">
                <div className="flex items-center gap-2.5 rounded-[16px] border border-white/10 bg-black px-3.5 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.22)] focus-within:border-white/18">
                  <Search className="h-4 w-4 text-white/38" />
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search docs"
                    className="edge-search-input min-w-0 w-full appearance-none bg-transparent text-sm text-white/88 outline-none shadow-none placeholder:text-white/34"
                  />
                  {!isMobile ? (
                    <div className="hidden shrink-0 items-center gap-1 rounded-[9px] border border-white/10 bg-[#111111] px-2 py-0.5 text-[10px] font-medium text-white/46 sm:flex">
                      <span>{shortcutLabel.split(" ")[0]}</span>
                      <span className="text-white/26">{shortcutLabel.split(" ")[1]}</span>
                    </div>
                  ) : null}
                </div>

                {searchOpen ? (
                  <div className="absolute inset-x-0 top-full z-[80] mt-3">
                    <SearchResultsPanel
                      docs={searchResults}
                      query={query}
                      pathname={pathname}
                      onSelect={() => setSearchOpen(false)}
                    />
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-[16px] border border-white/10 bg-black px-3.5 py-2 text-left shadow-[0_14px_36px_rgba(0,0,0,0.22)] md:hidden"
                onClick={() => {
                  setMobileSearchOpen(true);
                  setTimeout(() => {
                    mobileSearchInputRef.current?.focus();
                    mobileSearchInputRef.current?.select();
                  }, 0);
                }}
                aria-label="Open docs search"
              >
                <Search className="h-4 w-4 text-white/38" />
                <div className="min-w-0 flex-1 truncate text-sm text-white/34">
                  {query.trim() ? query : "Search docs"}
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleBackClick}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main layout: left sidebar pinned, content fills rest */}
      <div className="min-h-[calc(100vh-56px)] grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left sidebar (desktop) */}
        <aside className="hidden lg:block border-r border-white/10 bg-black/10">
          <div className="h-[calc(100vh-56px)] sticky top-14 overflow-auto">
            <div className="p-4">
              <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
                {filteredCount} results
              </div>
              <DocsSidebar docs={docs} />
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] bg-[#0b0b0f] border-r border-white/10">
              <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Image
                    src="/brand/edgaze-mark.png"
                    alt="Edgaze"
                    width={28}
                    height={28}
                    priority
                    className="shrink-0 translate-y-[2px]"
                  />
                  <span className="text-[15px] font-medium tracking-tight text-white/90 -translate-x-[5px]">
                    Edgaze <span className="text-white/50 font-normal">Docs</span>
                  </span>
                </div>
                <button
                  className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-xl transition-all duration-200 hover:bg-white/10 hover:ring-white/20 active:scale-95 active:bg-white/[0.08]"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close docs menu"
                >
                  <X
                    className="h-[18px] w-[18px] text-white/80 transition-colors group-hover:text-white"
                    strokeWidth={2.25}
                  />
                </button>
              </div>

              <div
                className="h-[calc(100%-56px)] overflow-auto p-4"
                onClick={() => setMobileOpen(false)}
              >
                <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
                  {filteredCount} results
                </div>
                <DocsSidebar docs={docs} />
              </div>
            </div>
          </div>
        ) : null}

        {mobileSearchOpen ? (
          <div className="fixed inset-0 z-[120] md:hidden">
            <div
              className="absolute inset-0 bg-black/72 backdrop-blur-sm"
              onClick={() => setMobileSearchOpen(false)}
            />
            <div className="absolute inset-x-3 top-3 bottom-3 overflow-hidden rounded-[26px] border border-white/10 bg-[#050505] shadow-[0_30px_100px_rgba(0,0,0,0.72)]">
              <div className="border-b border-white/8 px-4 py-4">
                <div className="flex items-center gap-2.5 rounded-[16px] border border-white/10 bg-black px-3.5 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.22)] focus-within:border-white/18">
                  <Search className="h-4 w-4 text-white/38" />
                  <input
                    ref={mobileSearchInputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search docs"
                    className="edge-search-input min-w-0 w-full appearance-none bg-transparent text-sm text-white/88 outline-none shadow-none placeholder:text-white/34"
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-white/50"
                    onClick={() => setMobileSearchOpen(false)}
                    aria-label="Close docs search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="h-[calc(100%-81px)] overflow-y-auto p-3">
                <SearchResultsPanel
                  docs={searchResults}
                  query={query}
                  pathname={pathname}
                  onSelect={() => setMobileSearchOpen(false)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Content container */}
        <div className="w-full [scroll-behavior:smooth]">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-8">
            {children}
            <div className="mt-10 text-[11px] text-white/35">
              © 2026 Edge Platforms, Inc. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
