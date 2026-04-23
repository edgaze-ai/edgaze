"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "../../../components/auth/AuthContext";

type AffiliateRow = {
  id: string;
  slug: string;
  label: string;
  ownerProfileHandle: string | null;
  storefrontPath: string;
  ctaUrl: string;
  isActive: boolean;
  views: number;
  uniqueVisitors: number;
  ctaClicks: number;
  conversionRatePct: number | null;
  daily: Array<{ date: string; views: number; ctaClicks: number }>;
};

type RecentEvent = {
  id: string;
  affiliateLinkId: string;
  eventType: "page_view" | "cta_click";
  occurredAt: string;
  pageUrl: string | null;
  referrer: string | null;
  targetUrl: string | null;
  visitor: string | null;
};

type ApiPayload = {
  days: number;
  rows: AffiliateRow[];
  recentEvents: RecentEvent[];
};

const card =
  "rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]";
const th = "text-left text-[11px] font-semibold uppercase tracking-wider text-white/45 pb-2 pr-4";
const td = "py-3 pr-4 text-[13px] text-white/85 align-top border-t border-white/[0.06]";

function fmtPct(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminAffiliateLinksPage() {
  const { getAccessToken, authReady } = useAuth();
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authReady) return;
    setLoading(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Not authenticated");
      const res = await fetch("/api/admin/affiliate-links?days=30", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load affiliate links");
      setPayload(data as ApiPayload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load affiliate links");
    } finally {
      setLoading(false);
    }
  }, [authReady, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <BarChart3 className="h-3.5 w-3.5" />
            Affiliate link tracking
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Affiliate links
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Views, unique visitors, CTA conversions, and daily performance for curated affiliate
            storefronts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.07] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className={`${card} p-5 sm:p-6`}>
        {loading && !payload ? (
          <div className="flex items-center gap-3 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading affiliate data…
          </div>
        ) : (payload?.rows.length ?? 0) === 0 ? (
          <p className="text-sm text-white/50">No affiliate links configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Affiliate link</th>
                  <th className={th}>Profile</th>
                  <th className={th}>Views</th>
                  <th className={th}>Unique</th>
                  <th className={th}>CTA clicks</th>
                  <th className={th}>Conversion</th>
                  <th className={th}>Destination</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payload?.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={td}>
                      <div className="font-semibold text-white">{row.label}</div>
                      <Link
                        href={row.storefrontPath}
                        className="mt-1 block text-xs text-cyan-300 hover:text-cyan-200"
                      >
                        edgaze.ai/{row.slug}
                      </Link>
                    </td>
                    <td className={td}>
                      {row.ownerProfileHandle ? (
                        <Link
                          href={`/profile/@${row.ownerProfileHandle}`}
                          className="text-white/80 hover:text-white"
                        >
                          @{row.ownerProfileHandle}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${td} tabular-nums`}>{row.views}</td>
                    <td className={`${td} tabular-nums`}>{row.uniqueVisitors}</td>
                    <td className={`${td} tabular-nums`}>{row.ctaClicks}</td>
                    <td className={`${td} tabular-nums`}>{fmtPct(row.conversionRatePct)}</td>
                    <td className={td}>
                      <code className="rounded bg-white/10 px-2 py-1 text-xs text-white/70">
                        {row.ctaUrl}
                      </code>
                    </td>
                    <td className={td}>
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                        {row.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${card} p-5 sm:p-6`}>
        <h2 className="text-sm font-semibold text-white/90">Daily performance</h2>
        <p className="mt-1 text-xs text-white/45">
          Last {payload?.days ?? 30} days by affiliate link.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Link</th>
                <th className={th}>Views</th>
                <th className={th}>CTA clicks</th>
                <th className={th}>Conversion</th>
              </tr>
            </thead>
            <tbody>
              {payload?.rows.flatMap((row) =>
                row.daily.map((day) => (
                  <tr key={`${row.id}:${day.date}`}>
                    <td className={td}>{day.date}</td>
                    <td className={td}>{row.label}</td>
                    <td className={`${td} tabular-nums`}>{day.views}</td>
                    <td className={`${td} tabular-nums`}>{day.ctaClicks}</td>
                    <td className={`${td} tabular-nums`}>
                      {fmtPct(
                        day.views > 0 ? Math.round((day.ctaClicks / day.views) * 1000) / 10 : null,
                      )}
                    </td>
                  </tr>
                )),
              )}
              {(payload?.rows.flatMap((row) => row.daily).length ?? 0) === 0 ? (
                <tr>
                  <td className={td} colSpan={5}>
                    No events in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${card} p-5 sm:p-6`}>
        <h2 className="text-sm font-semibold text-white/90">Recent event data</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Event</th>
                <th className={th}>Visitor</th>
                <th className={th}>Page</th>
                <th className={th}>Referrer</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.recentEvents ?? []).map((event) => (
                <tr key={event.id}>
                  <td className={td}>{fmtDate(event.occurredAt)}</td>
                  <td className={td}>
                    {event.eventType === "cta_click" ? "CTA click" : "Page view"}
                  </td>
                  <td className={td}>
                    <code className="text-xs text-white/50">{event.visitor || "unknown"}</code>
                  </td>
                  <td className={td}>{event.pageUrl || "—"}</td>
                  <td className={td}>{event.referrer || "—"}</td>
                </tr>
              ))}
              {(payload?.recentEvents.length ?? 0) === 0 ? (
                <tr>
                  <td className={td} colSpan={5}>
                    No recent affiliate events.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
