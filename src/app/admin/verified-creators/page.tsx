"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Loader2, Search, Shield } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { DEFAULT_AVATAR_SRC } from "@/config/branding";

type CreatorHit = {
  id: string;
  handle: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_verified_creator: boolean;
  is_founding_creator: boolean;
};

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";

function maskEmail(email: string | undefined | null) {
  if (!email) return "—";
  const [u, d] = email.split("@");
  if (!d) return "***";
  const prefix = (u ?? "").slice(0, 2);
  return `${prefix}***@${d}`;
}

export default function AdminVerifiedCreatorsPage() {
  const { authReady, getAccessToken } = useAuth();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [hits, setHits] = useState<CreatorHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CreatorHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<null | { kind: "ok" | "err"; text: string }>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(q.trim()), 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  const runSearch = useCallback(async () => {
    if (!debounced) {
      setHits([]);
      return;
    }
    setSearching(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/creator-search?q=${encodeURIComponent(debounced)}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setHits((data.creators || []) as CreatorHit[]);
    } catch (e: unknown) {
      setHits([]);
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Search failed" });
    } finally {
      setSearching(false);
    }
  }, [debounced, getAccessToken]);

  useEffect(() => {
    if (!authReady) return;
    void runSearch();
  }, [authReady, runSearch]);

  const displayName = useMemo(() => {
    if (!selected) return "";
    return selected.full_name?.trim() || (selected.handle ? `@${selected.handle}` : "Creator");
  }, [selected]);

  const setVerified = async (next: boolean) => {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/verified-creators", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          profileId: selected.id,
          is_verified_creator: next,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || res.statusText);

      setSelected((s) => (s ? { ...s, is_verified_creator: next } : s));
      setHits((prev) =>
        prev.map((h) => (h.id === selected.id ? { ...h, is_verified_creator: next } : h)),
      );

      const okText = (() => {
        if (!next) return "Verification removed for this creator.";
        const parts = ["Verified."];
        if (data.email_sent) {
          parts.push("Verification email sent.");
        } else if (data.email_skipped_no_address) {
          parts.push("No email on this profile or auth account — notification email was not sent.");
        } else if (data.email_error === "not_configured") {
          parts.push(
            "RESEND_API_KEY is not set in this Next.js environment (e.g. Vercel or .env.local). Supabase Edge Function secrets are separate — add the same key there too.",
          );
        } else if (data.email_error) {
          parts.push(`Notification email failed: ${String(data.email_error)}`);
        }
        return parts.join(" ");
      })();
      setMessage({
        kind: "ok",
        text: okText,
      });
    } catch (e: unknown) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/15 to-fuchsia-500/10">
            <BadgeCheck className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Verified creators</h1>
            <p className="mt-1 text-sm text-white/50 leading-relaxed">
              Search by handle, name, email, or profile ID. Granting verification sends email via
              Resend from{" "}
              <code className="break-all rounded bg-white/10 px-1 py-0.5 text-[11px] text-white/80">
                RESEND_FROM_EMAIL
              </code>{" "}
              or <strong className="text-white/80">sellers@edgaze.ai</strong>. Requires{" "}
              <code className="break-all rounded bg-white/10 px-1 py-0.5 text-[11px] text-white/80">
                RESEND_API_KEY
              </code>{" "}
              on the <strong className="text-white/80">Next.js</strong> host (not only Supabase
              Edge).
            </p>
          </div>
        </div>
      </div>

      <div className={`${cardClass} p-5 sm:p-6`}>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/45 mb-2">
          Search
        </label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. janedoe or @handle"
            className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-400/40"
          />
          {searching ? (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/45" />
          ) : null}
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : "border-red-400/30 bg-red-500/10 text-red-100"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
            Results {hits.length ? `(${hits.length})` : ""}
          </h2>
          <div className="space-y-2 max-h-[min(48vh,420px)] overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] sm:max-h-[540px]">
            {!debounced ? (
              <p className="text-sm text-white/40 py-6 text-center">Type to search profiles.</p>
            ) : hits.length === 0 && !searching ? (
              <p className="text-sm text-white/40 py-6 text-center">No matches.</p>
            ) : (
              hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelected(h)}
                  className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                    selected?.id === h.id
                      ? "border-cyan-400/40 bg-cyan-400/10"
                      : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5">
                      <Image
                        src={h.avatar_url || DEFAULT_AVATAR_SRC}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white truncate">
                          {h.full_name?.trim() || (h.handle ? `@${h.handle}` : "—")}
                        </span>
                        {h.is_verified_creator ? (
                          <span className="shrink-0 rounded-md bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200 ring-1 ring-cyan-400/25">
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-white/45 truncate">
                        {h.handle ? `@${h.handle}` : "—"} · {maskEmail(h.email)}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/45 mb-2">
            Selected profile
          </h2>
          {!selected ? (
            <div className={`${cardClass} py-16 text-center text-sm text-white/45`}>
              Select a creator to grant or remove verification.
            </div>
          ) : (
            <div className={`${cardClass} space-y-6 p-4 sm:p-6`}>
              <div className="flex items-start gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <Image
                    src={selected.avatar_url || DEFAULT_AVATAR_SRC}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-lg font-semibold text-white leading-tight">
                    {displayName}
                  </div>
                  <div className="text-sm text-white/50">
                    @{selected.handle || "—"} · {maskEmail(selected.email)}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selected.is_verified_creator ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Platform verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/55">
                        Not verified
                      </span>
                    )}
                    {selected.is_founding_creator ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100">
                        OG (profile only)
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4 text-xs text-white/50 leading-relaxed">
                <div className="flex items-center gap-2 text-white/70 font-medium mb-2">
                  <Shield className="h-4 w-4 text-cyan-300/80" />
                  What this does
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong className="text-white/80">Verified</strong> shows the cyan/pink check
                    next to their name across marketplace, comments, search, and listing pages.
                  </li>
                  <li>
                    <strong className="text-white/80">OG / founding</strong> is separate and only
                    appears on their public profile — change that in the database if needed.
                  </li>
                  <li>
                    The first time you <strong className="text-white/80">grant</strong>{" "}
                    verification, we email them from{" "}
                    <strong className="text-white/80">sellers@edgaze.ai</strong>.
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {selected.is_verified_creator ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setVerified(false)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Remove verification
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setVerified(true)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-gradient-to-r from-cyan-400/20 to-fuchsia-500/15 px-4 py-3 text-sm font-semibold text-cyan-50 hover:from-cyan-400/25 hover:to-fuchsia-500/20 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Grant verification & email
                  </button>
                )}
              </div>
              <p className="text-[11px] text-white/35 font-mono truncate" title={selected.id}>
                Profile ID · {selected.id}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
