"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
  Legend,
} from "recharts";

import { useAuth } from "../../../components/auth/AuthContext";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type MetricsRow = {
  date: string;
  views: number;
  runs: number;
  salesCents: number;
  likes: number;
  salesUsd: number;
};

type ListingInfo = {
  id: string;
  type: "prompt" | "workflow";
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  edgaze_code: string | null;
  monetisation_mode: string | null;
  is_paid: boolean | null;
  price_usd: number | null;
  likes_count: number;
};

type MetricsResponse = {
  listing?: ListingInfo;
  series: MetricsRow[];
  summary: {
    totalViews: number;
    totalRuns: number;
    purchasesCount: number;
    totalSalesCents: number;
    likesTotal: number;
    viewToRunPct: number | null;
    runToPurchasePct: number | null;
  };
  period: string;
};

const CHART_COLORS = {
  views: "#22d3ee",
  runs: "#f472b6",
  likes: "#94a3b8",
  sales: "#c4b5fd",
} as const;

function shortDateLabel(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const tooltipStyle = {
  background: "rgba(11, 18, 32, 0.96)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  fontSize: 12,
};

function MetricChartCard(props: {
  title: string;
  headlineValue: string;
  headlineSub?: string;
  explanation: string;
  data: MetricsRow[];
  dataKey: keyof Pick<MetricsRow, "views" | "runs" | "likes" | "salesUsd" | "salesCents">;
  color: string;
  valueFormatter?: (v: number) => string;
  dashed?: boolean;
}) {
  const {
    title,
    headlineValue,
    headlineSub,
    explanation,
    data,
    dataKey,
    color,
    valueFormatter = (v) => String(v),
    dashed,
  } = props;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] via-white/[0.02] to-transparent p-4 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-[0.12]"
        style={{
          background: `radial-gradient(circle at center, ${color}, transparent 70%)`,
        }}
      />
      <div className="relative">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {title}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">
            {headlineValue}
          </span>
          {headlineSub ? (
            <span className="text-[12px] font-medium text-white/45">{headlineSub}</span>
          ) : null}
        </div>
        <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-white/50">{explanation}</p>
        <div className="mt-4 h-[200px] w-full sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 6"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={shortDateLabel}
                tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "rgba(255,255,255,0.55)" }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as MetricsRow | undefined;
                  return p ? shortDateLabel(p.date) : "";
                }}
                formatter={(value: number | string) => [valueFormatter(Number(value)), title]}
              />
              <Line
                type="monotone"
                dataKey={dataKey as string}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                strokeDasharray={dashed ? "5 5" : undefined}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ListingAnalyticsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind") === "workflow" ? "workflow" : "prompt";
  const id = searchParams.get("id")?.trim() ?? "";
  const { getAccessToken } = useAuth();

  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setErr("Missing listing");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const token = await getAccessToken();
      const qs = new URLSearchParams({
        listingId: id,
        listingType: kind,
        period,
      });
      const res = await fetch(`/api/creator/listing-metrics?${qs}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      const json = (await res.json()) as MetricsResponse;
      setData(json);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id, kind, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = data?.series ?? [];
  const summary = data?.summary;
  const listing = data?.listing;

  const priceLabel = useMemo(() => {
    if (!listing) return null;
    if (!listing.is_paid) return "Free";
    if (listing.price_usd != null) return `$${Number(listing.price_usd).toFixed(2)}`;
    return "Paid";
  }, [listing]);

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[#030306] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(56,189,248,0.14), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 0%, rgba(244,114,182,0.08), transparent 50%), radial-gradient(ellipse 50% 40% at 0% 20%, rgba(167,139,250,0.07), transparent 45%)",
        }}
      />

      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#030306]/75 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={() => router.push("/library")}
            className="group inline-flex items-center gap-1 text-white/55 transition-colors hover:text-white"
            aria-label="Back to library"
          >
            <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-[13px] font-medium">Back</span>
          </button>
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all sm:text-[12px]",
                  period === p
                    ? "border-cyan-400/40 bg-gradient-to-r from-cyan-500/25 via-sky-500/15 to-fuchsia-500/20 text-white shadow-[0_0_24px_-8px_rgba(56,189,248,0.45)]"
                    : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/18 hover:text-white/80",
                )}
              >
                {p === "7d" ? "7d" : p === "30d" ? "30d" : "90d"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="relative w-full px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pb-20 lg:pt-10">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center gap-2 text-white/55">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-300/80" />
            <span className="text-sm">Loading analytics…</span>
          </div>
        ) : err ? (
          <div className="rounded-2xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100/90">
            {err}
          </div>
        ) : (
          <div className="flex flex-col gap-8 lg:gap-10">
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-8 lg:items-start">
              {/* Listing card — marketplace-style */}
              <aside className="lg:col-span-4 xl:col-span-3">
                <div
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_32px_120px_-48px_rgba(0,0,0,0.9)]"
                  style={{ backdropFilter: "blur(14px)" }}
                >
                  <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-white/10 to-white/[0.02]">
                    {listing?.thumbnail_url ? (
                      <Image
                        src={listing.thumbnail_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 320px"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/25">
                        <Sparkles className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md">
                        {listing?.type === "workflow" ? "Workflow" : "Prompt"}
                      </span>
                      {listing?.edgaze_code ? (
                        <span className="rounded-md border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white/80 backdrop-blur-md">
                          {listing.edgaze_code}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-3 p-4 sm:p-5">
                    <div>
                      <h1 className="text-[15px] font-semibold leading-snug text-white sm:text-base">
                        {listing?.title || "Your listing"}
                      </h1>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-white/50">
                        {listing?.description?.trim() || "No description on this listing."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-white/55">
                      {priceLabel ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 font-medium text-white/80">
                          {priceLabel}
                        </span>
                      ) : null}
                      {listing?.monetisation_mode ? (
                        <span className="rounded-full border border-white/10 px-2.5 py-1 capitalize">
                          {String(listing.monetisation_mode).replace(/_/g, " ")}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/10 px-2.5 py-1 tabular-nums">
                        {listing?.likes_count ?? summary?.likesTotal ?? 0} likes
                      </span>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="min-w-0 space-y-6 lg:col-span-8 xl:col-span-9">
                {/* Funnel strip */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.07] px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/55">
                      View → run
                    </div>
                    <div className="mt-0.5 text-xl font-semibold tabular-nums text-cyan-50">
                      {summary?.viewToRunPct != null ? `${summary.viewToRunPct}%` : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-fuchsia-400/15 bg-fuchsia-500/[0.07] px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200/55">
                      Run → purchase
                    </div>
                    <div className="mt-0.5 text-xl font-semibold tabular-nums text-fuchsia-50">
                      {summary?.runToPurchasePct != null ? `${summary.runToPurchasePct}%` : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 sm:col-span-2 xl:col-span-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Revenue (period)
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                      <span className="text-xl font-semibold tabular-nums text-white">
                        ${((summary?.totalSalesCents ?? 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-[12px] text-white/45">
                        {summary?.purchasesCount ?? 0} sales
                      </span>
                    </div>
                  </div>
                </div>

                {/* Combined chart */}
                <div
                  className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent p-4 sm:p-6"
                  style={{
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 100px -48px rgba(0,0,0,0.85)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Overview
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                    Performance over time
                  </h2>
                  <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-white/45">
                    Combined trend for listing views, marketplace runs (studio tests excluded),
                    total likes, and gross sales. Left axis: activity; right axis: revenue.
                  </p>
                  <div className="mt-5 h-[300px] w-full sm:h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 6"
                          stroke="rgba(255,255,255,0.06)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={shortDateLabel}
                          tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fill: "rgba(196,181,253,0.75)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelFormatter={(_, payload) => {
                            const p = payload?.[0]?.payload as MetricsRow | undefined;
                            return p ? shortDateLabel(p.date) : "";
                          }}
                          formatter={(value: number | string, name: string) => {
                            const n = Number(value);
                            if (name === "salesUsd") return [`$${n.toFixed(2)}`, "Sales"];
                            if (name === "likes") return [n, "Likes (total)"];
                            return [n, name];
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
                          formatter={(value) => <span className="text-white/55">{value}</span>}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="views"
                          name="Views"
                          stroke={CHART_COLORS.views}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="runs"
                          name="Runs (marketplace)"
                          stroke={CHART_COLORS.runs}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="likes"
                          name="Likes (total)"
                          stroke={CHART_COLORS.likes}
                          strokeWidth={1.5}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="salesUsd"
                          name="Sales ($)"
                          stroke={CHART_COLORS.sales}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Individual charts */}
                <div className="grid gap-4 md:grid-cols-2 xl:gap-5">
                  <MetricChartCard
                    title="Views"
                    headlineValue={String(summary?.totalViews ?? 0)}
                    headlineSub="in period"
                    explanation="Unique listing page loads we could attribute after bot filtering and cooldowns. Anonymous visitors need a stable device id — we now send one from the product page."
                    data={chartData}
                    dataKey="views"
                    color={CHART_COLORS.views}
                  />
                  <MetricChartCard
                    title="Runs"
                    headlineValue={String(summary?.totalRuns ?? 0)}
                    headlineSub="marketplace only"
                    explanation="Completed runs from customers on the public listing. Builder previews and hosted demo runs are tracked internally but excluded here."
                    data={chartData}
                    dataKey="runs"
                    color={CHART_COLORS.runs}
                  />
                  <MetricChartCard
                    title="Likes"
                    headlineValue={String(summary?.likesTotal ?? 0)}
                    headlineSub="total on listing"
                    explanation="Total likes on this listing today. We don’t yet store daily like history, so this line is flat at the current total across the chart."
                    data={chartData}
                    dataKey="likes"
                    color={CHART_COLORS.likes}
                    dashed
                  />
                  <MetricChartCard
                    title="Sales"
                    headlineValue={`$${((summary?.totalSalesCents ?? 0) / 100).toFixed(2)}`}
                    headlineSub={`${summary?.purchasesCount ?? 0} purchases`}
                    explanation="Gross merchandise value (your payouts are net of fees). Each point is sales recorded that day."
                    data={chartData}
                    dataKey="salesUsd"
                    color={CHART_COLORS.sales}
                    valueFormatter={(v) => `$${v.toFixed(2)}`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function LibraryAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#030306] text-white/55">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300/70" />
        </div>
      }
    >
      <ListingAnalyticsInner />
    </Suspense>
  );
}
