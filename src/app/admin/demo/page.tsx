"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../components/auth/AuthContext";
import { Copy, ExternalLink, Loader2, Search } from "lucide-react";

type Product = {
  id: string;
  type: "prompt" | "workflow";
  owner_handle: string | null;
  edgaze_code: string | null;
  title: string | null;
  path: string;
  demo_mode_enabled: boolean;
  demo_token: string | null;
};

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";
const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function AdminDemoPage() {
  const { authReady, getAccessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 280);
  const [toggling, setToggling] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/admin/demo${debouncedQuery ? `?q=${encodeURIComponent(debouncedQuery)}` : ""}`,
        { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch (e) {
      console.error("Failed to fetch products:", e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, getAccessToken]);

  useEffect(() => {
    if (!authReady) return;
    fetchProducts();
  }, [authReady, fetchProducts]);

  // Enable scrolling like other admin pages
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.style.overflowY = "auto";
    main.style.overflowX = "hidden";
    return () => {
      main.style.overflowY = "";
      main.style.overflowX = "";
    };
  }, []);

  async function toggleDemo(p: Product) {
    setToggling(p.id);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/demo", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          target_type: p.type,
          target_id: p.id,
          enabled: !p.demo_mode_enabled,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchProducts();
    } catch (e) {
      console.error("Toggle demo failed:", e);
    } finally {
      setToggling(null);
    }
  }

  function getDemoUrl(p: Product): string | null {
    if (!p.demo_mode_enabled || !p.demo_token) return null;
    return `${baseUrl}${p.path}?demo=${encodeURIComponent(p.demo_token)}`;
  }

  async function copyDemoLink(p: Product) {
    const url = getDemoUrl(p);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Demo mode</h1>
        <p className="mt-1 text-[13px] text-white/50 max-w-xl">
          Enable demo mode for any prompt or workflow. Users visiting the special link can run it without signing in.
        </p>
      </div>

      <div className={cardClass + " p-5"}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, description, tags, owner, code…"
            className={inputClass + " pl-10"}
          />
        </div>
      </div>

      {loading && products.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] py-12 text-center text-[13px] text-white/50">
          No products found.
        </div>
      ) : (
        <div className={`relative space-y-3 ${loading ? "opacity-70" : ""}`}>
          {loading && products.length > 0 && (
            <div className="sticky top-20 z-10 -mt-2 mb-2 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[12px] text-white/70 backdrop-blur-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating…
              </span>
            </div>
          )}
          {products.map((p) => {
            const demoUrl = getDemoUrl(p);
            const isToggling = toggling === p.id;
            const isCopied = copiedId === p.id;

            return (
              <div
                key={`${p.type}-${p.id}`}
                className={`${cardClass} p-4 flex flex-col sm:flex-row sm:items-center gap-4`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium uppercase ${
                        p.type === "workflow"
                          ? "bg-cyan-500/20 text-cyan-300"
                          : "bg-pink-500/20 text-pink-300"
                      }`}
                    >
                      {p.type}
                    </span>
                    <span className="text-[13px] font-medium text-white truncate">
                      {p.title || "Untitled"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-white/50 truncate">
                    @{p.owner_handle ?? "—"} / {p.edgaze_code ?? "—"}
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleDemo(p)}
                    disabled={isToggling}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all ${
                      p.demo_mode_enabled
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    } disabled:opacity-50`}
                  >
                    {isToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : p.demo_mode_enabled ? (
                      "Demo on"
                    ) : (
                      "Enable demo"
                    )}
                  </button>

                  {p.demo_mode_enabled && demoUrl && (
                    <>
                      <a
                        href={demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                        title="Open demo link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => copyDemoLink(p)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {isCopied ? "Copied" : "Copy link"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
