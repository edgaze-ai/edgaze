// src/components/search/GlobalSearch.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SearchResult } from "../../app/api/search/route";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";

type Props = {
  placeholder?: string;
};

export default function GlobalSearch({ placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults(null);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );

        // Don’t throw – just handle gracefully
        if (!res.ok) {
          console.error("Search HTTP error", res.status);
          setResults(null);
          setOpen(false);
          return;
        }

        const data = (await res.json()) as SearchResult;
        setResults(data);
        setOpen(true);
      } catch (err) {
        console.error("Search failed", err);
        setResults(null);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 200); // 200ms debounce

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const hasResults =
    results &&
    ((results.profiles && results.profiles.length > 0) ||
      (results.workflows && results.workflows.length > 0));

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Input */}
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white focus-within:border-cyan-400">
        <Search className="h-4 w-4 text-white/50" />
        <input
          className="w-full bg-transparent outline-none placeholder:text-white/40 text-sm"
          placeholder={placeholder ?? "Search workflows, creators, or tags..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (hasResults) setOpen(true);
          }}
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
      </div>

      {/* Dropdown */}
      {open && hasResults && (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-white/12 bg-[#050505] shadow-2xl overflow-hidden">
          {/* Profiles */}
          {results!.profiles.length > 0 && (
            <div className="border-b border-white/10">
              <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                Creators
              </div>
              {results!.profiles.map((p) => (
                <Link
                  key={p.id}
                  href={
                    p.handle
                      ? `/profile/@${p.handle}`
                      : `/profile?id=${encodeURIComponent(p.id)}`
                  }
                  className="flex items-center gap-3 px-3 py-2 text-sm text-white/85 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {p.displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{p.displayName}</span>
                    {p.handle && (
                      <span className="text-xs text-white/55">
                        @{p.handle}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Workflows */}
          {results!.workflows.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                Workflows
              </div>
              {results!.workflows.map((w) => (
                <Link
                  key={w.id}
                  href={
                    w.slug
                      ? `/workflow/${w.slug}`
                      : `/workflow?id=${encodeURIComponent(w.id)}`
                  }
                  className="flex items-center gap-3 px-3 py-2 text-sm text-white/85 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  <div className="h-8 w-8 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {w.bannerUrl && (
                      <img
                        src={w.bannerUrl}
                        alt={w.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium truncate">{w.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
