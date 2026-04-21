"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Zap } from "lucide-react";
import ProfileAvatar from "../ui/ProfileAvatar";
import ProfileLink from "../ui/ProfileLink";
import { normalizeImageSrc } from "../../lib/normalize-image-src";
import type { TrendingItem } from "../../app/api/trending/this-week/route";

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

function clampText(s: string | null | undefined, max = 140) {
  const t = (s || "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max).trim()}…` : t;
}

function formatRelativeTime(iso: string | null | undefined) {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return "—";
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const rtf =
    typeof Intl !== "undefined" &&
    (Intl as { RelativeTimeFormat?: new (locale: string, opts: object) => Intl.RelativeTimeFormat })
      .RelativeTimeFormat
      ? new Intl.RelativeTimeFormat("en", { numeric: "always" })
      : null;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;
  const pick = () => {
    if (abs < minute) return { v: Math.round(diff / 1000), u: "second" as const };
    if (abs < hour) return { v: Math.round(diff / minute), u: "minute" as const };
    if (abs < day) return { v: Math.round(diff / hour), u: "hour" as const };
    if (abs < month) return { v: Math.round(diff / day), u: "day" as const };
    if (abs < year) return { v: Math.round(diff / month), u: "month" as const };
    return { v: Math.round(diff / year), u: "year" as const };
  };
  const { v, u } = pick();
  if (rtf) return rtf.format(v, u);
  const n = Math.abs(v);
  const unit = n === 1 ? u : `${u}s`;
  return diff < 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
}

function BlurredPromptThumbnail({ text }: { text: string }) {
  const snippet =
    (text || "EDGAZE").replace(/\s+/g, " ").trim().slice(0, 28).toUpperCase() || "EDGAZE";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950/80">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="scale-[1.35] blur-2xl opacity-80">
          <div className="whitespace-nowrap text-6xl font-extrabold tracking-[0.35em] text-white/25">
            {snippet}
          </div>
        </div>
      </div>
      <div className="absolute inset-3 rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur-md" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-cyan-400/55 via-cyan-400/8 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-pink-500/55 via-pink-500/8 to-transparent" />
    </div>
  );
}

type TrendCardProps = {
  item: TrendingItem;
};

function TrendCard({ item }: TrendCardProps) {
  const router = useRouter();
  const isFree = item.monetisation_mode === "free" || item.is_paid === false;
  const priceLabel =
    isFree || item.price_usd == null
      ? isFree
        ? "Free"
        : "Paid"
      : `$${Number(item.price_usd).toFixed(2)}`;
  const badgeLabel = item.type === "workflow" ? "Workflow" : "Prompt";
  const desc = clampText(item.description, 140);
  const publishedLabel = formatRelativeTime(item.published_at ?? item.created_at ?? null);
  const thumbnailSrc = normalizeImageSrc(item.thumbnail_url);

  const displayHandle = (item.owner_handle || "").replace(/^@/, "");
  const creatorName = item.owner_name ?? (displayHandle ? `@${displayHandle}` : "Creator");

  const detailPath =
    item.edgaze_code && displayHandle
      ? item.type === "workflow"
        ? `/${displayHandle}/${item.edgaze_code}`
        : `/p/${displayHandle}/${item.edgaze_code}`
      : undefined;

  const badgeClass =
    item.type === "workflow"
      ? "border-pink-400/25 bg-pink-500/10 text-pink-100"
      : "border-cyan-300/25 bg-cyan-400/10 text-cyan-50";

  const badgeGlow =
    item.type === "workflow"
      ? "shadow-[0_0_18px_rgba(236,72,153,0.22)]"
      : "shadow-[0_0_18px_rgba(56,189,248,0.22)]";

  const content = (
    <div className="group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={item.title || "Listing thumbnail"}
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
        ) : (
          <BlurredPromptThumbnail text={item.prompt_text || item.title || "EDGAZE"} />
        )}

        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur",
              badgeClass,
              badgeGlow,
            )}
          >
            {badgeLabel}
          </span>

          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-semibold tabular-nums backdrop-blur",
              isFree
                ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-300"
                : "border-white/12 bg-black/55 text-white/85",
            )}
          >
            {priceLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <ProfileAvatar
            name={creatorName}
            avatarUrl={item.owner_avatar_url ?? null}
            size={36}
            handle={displayHandle ?? undefined}
            className="mt-0.5"
          />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <h3
            className="truncate text-[15px] font-semibold leading-snug text-white/95"
            title={item.title || undefined}
          >
            {item.title || "Untitled listing"}
          </h3>

          <div
            className="mt-1 flex items-center gap-2 text-xs text-white/68 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ProfileLink
              name={creatorName}
              handle={displayHandle || undefined}
              verified={Boolean(item.owner_is_verified)}
              className="min-w-0 truncate"
            />
          </div>

          {desc ? (
            <div
              className="mt-1.5 line-clamp-2 text-[12px] leading-[1.45] text-white/58"
              title={item.description || undefined}
            >
              {desc}
            </div>
          ) : (
            <div className="mt-1.5 h-4" />
          )}

          <div className="mt-auto flex shrink-0 items-center gap-2 text-[11px] text-white/58">
            {item.edgaze_code ? (
              <span className="shrink-0 rounded-md bg-white/10 px-2 py-[3px] text-[10px] font-semibold text-white/85">
                /{item.edgaze_code}
              </span>
            ) : (
              <span className="shrink-0 rounded-md bg-white/5 px-2 py-[3px] text-[10px] text-white/60">
                No code
              </span>
            )}
            <span className="truncate">{publishedLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const cardClass =
    "flex h-[280px] min-h-[280px] w-[280px] min-w-[280px] shrink-0 flex-col overflow-hidden cursor-pointer";

  if (detailPath) {
    return (
      <div
        role="link"
        tabIndex={0}
        className={cn("block", cardClass)}
        onClick={() => router.push(detailPath)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(detailPath);
          }
        }}
      >
        {content}
      </div>
    );
  }

  return <div className={cn(cardClass)}>{content}</div>;
}

function CardSkeleton() {
  return (
    <div className="h-[280px] min-h-[280px] w-[280px] min-w-[280px] shrink-0 animate-pulse">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="aspect-video w-full rounded-2xl bg-white/10" />
        <div className="mt-3 flex gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="h-3 w-full rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

type TrendingRowProps = {
  label: string;
  items: TrendingItem[];
  loading: boolean;
  exploreHref: string;
  direction?: "right" | "left";
};

function TrendingRow({
  label,
  items,
  loading,
  exploreHref,
  direction = "right",
}: TrendingRowProps) {
  const loopItems = items.length > 0 ? [...items, ...items, ...items] : [];
  const trackClass =
    direction === "right" ? "infinite-carousel-track" : "infinite-carousel-track-reverse";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">{label}</h3>
        <Link
          href={exploreHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/20 hover:bg-white/8 hover:text-white/90"
        >
          Explore
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="relative -mx-5 sm:-mx-6">
        {/* Left edge fade - blends cards into background */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-20 sm:w-28"
          style={{
            background:
              "linear-gradient(90deg, #07080b 0%, rgba(7,8,11,0.95) 25%, rgba(7,8,11,0.5) 60%, transparent 100%)",
          }}
        />
        {/* Right edge fade */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-20 sm:w-28"
          style={{
            background:
              "linear-gradient(270deg, #07080b 0%, rgba(7,8,11,0.95) 25%, rgba(7,8,11,0.5) 60%, transparent 100%)",
          }}
        />

        <div className="overflow-hidden px-5 sm:px-6 py-2">
          <div
            className={cn(
              "flex flex-nowrap gap-4 w-max",
              !loading && items.length > 0 && trackClass,
            )}
            style={{ minHeight: 280 }}
          >
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
            ) : items.length === 0 ? (
              <div className="flex min-w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-12 text-center">
                <div>
                  <Zap className="mx-auto h-10 w-10 text-white/30" />
                  <p className="mt-2 text-sm text-white/55">
                    No top items yet – publish the first one
                  </p>
                  <Link
                    href="/marketplace"
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                  >
                    Publish a workflow
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              loopItems.map((item, i) => (
                <TrendCard key={`${item.type}-${item.id}-${i}`} item={item} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrendingThisWeekSection() {
  const [data, setData] = useState<{
    topWorkflowsThisWeek: TrendingItem[];
    topPromptsThisWeek: TrendingItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setError(false);
    });

    fetch("/api/trending/this-week")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        if (!text.trim()) throw new Error("Empty response body");
        try {
          return JSON.parse(text) as {
            topWorkflowsThisWeek?: TrendingItem[];
            topPromptsThisWeek?: TrendingItem[];
          };
        } catch {
          throw new SyntaxError("Invalid JSON from trending API");
        }
      })
      .then((json) => {
        if (cancelled) return;
        setData({
          topWorkflowsThisWeek: json.topWorkflowsThisWeek ?? [],
          topPromptsThisWeek: json.topPromptsThisWeek ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setData({ topWorkflowsThisWeek: [], topPromptsThisWeek: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error && !data) return null;

  return (
    <section id="trending" className="px-5 py-16 sm:py-20" style={{ scrollMarginTop: 92 }}>
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Trending on Edgaze
          </h2>
          <p className="mt-2 text-sm text-white/60">
            What people are actually using on Edgaze this week.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm sm:p-8">
          <div className="space-y-10">
            <TrendingRow
              label="Most used workflows this week"
              items={data?.topWorkflowsThisWeek ?? []}
              loading={loading}
              exploreHref="/marketplace"
              direction="right"
            />
            <TrendingRow
              label="Most used prompts this week"
              items={data?.topPromptsThisWeek ?? []}
              loading={loading}
              exploreHref="/marketplace"
              direction="left"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
