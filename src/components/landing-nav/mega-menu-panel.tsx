"use client";

import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { MegaNavColumn, MegaNavFeatured, MegaNavGroup, MegaNavItem } from "./landing-nav-config";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Keeps every mega menu (including sparse Builders / Creators) the same minimum footprint. */
const MEGA_MAIN_COLUMN_MIN = "min-h-[400px] lg:min-h-[420px]";

function Badge({ type }: { type: "New" | "Popular" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        type === "New" &&
          "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/25",
        type === "Popular" &&
          "bg-pink-500/12 text-pink-200 ring-1 ring-pink-400/22",
      )}
    >
      {type}
    </span>
  );
}

export function MegaNavItemIcon({ item }: { item: MegaNavItem }) {
  if (item.iconSrc && item.iconSpriteAlign) {
    return (
      <div
        className={cn(
          "h-10 w-10 shrink-0 rounded-xl ring-1 ring-white/[0.08]",
          "overflow-hidden bg-[#090a0f]",
        )}
        style={{
          backgroundImage: `url(${item.iconSrc})`,
          backgroundSize: "100% 200%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: item.iconSpriteAlign === "bottom" ? "center bottom" : "center top",
        }}
        aria-hidden
      />
    );
  }
  const Icon = item.icon;
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        "bg-white/[0.06] ring-1 ring-white/[0.08]",
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5 text-white/80" strokeWidth={1.75} />
    </div>
  );
}

function MegaMenuItemRow({
  item,
  Link,
  variant = "default",
}: {
  item: MegaNavItem;
  Link: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
  }>;
  variant?: "default" | "tile";
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group/item relative flex gap-4 rounded-2xl text-left transition-colors",
        "bg-[#0b0c11]/90 hover:bg-[#12141c]",
        "ring-1 ring-transparent hover:ring-cyan-400/15",
        "outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
        variant === "default" && "p-3.5",
        variant === "tile" &&
          "h-full min-h-[200px] flex-1 flex-col justify-between p-6 sm:min-h-[240px] sm:flex-row sm:items-center lg:p-7",
        variant === "default" && "items-start",
      )}
    >
      <MegaNavItemIcon item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-white/95">{item.title}</div>
          {item.badge ? <Badge type={item.badge} /> : null}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-white/55 group-hover/item:text-white/65">
          {item.description}
        </p>
      </div>
    </Link>
  );
}

function FeaturedCard({
  featured,
  Link,
}: {
  featured: MegaNavFeatured;
  Link: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
  }>;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full min-h-[280px] flex-1 flex-col justify-between overflow-hidden rounded-2xl",
        "bg-[#090a0f] p-7",
        "ring-1 ring-white/[0.09]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 0% 0%, rgba(34,211,238,0.12), transparent 55%), radial-gradient(ellipse 100% 70% at 100% 100%, rgba(236,72,153,0.1), transparent 50%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[#090a0f]/85" />
      <div className="relative">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Featured</div>
        <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-white">{featured.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{featured.description}</p>
      </div>
      <Link
        href={featured.href}
        className={cn(
          "relative mt-8 inline-flex items-center gap-2 self-start rounded-full px-4 py-2.5 text-sm font-medium",
          "bg-white/[0.08] text-white ring-1 ring-white/12 hover:bg-white/[0.12]",
          "outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45",
        )}
      >
        {featured.ctaLabel}
        <ArrowRight className="h-4 w-4 opacity-80" />
      </Link>
    </div>
  );
}

function TwoTilesFill({
  columns,
  Link,
}: {
  columns: MegaNavColumn[];
  Link: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
  }>;
}) {
  const col = columns[0];
  const items = col?.items ?? [];
  const [a, b] = items;
  if (items.length !== 2 || !a || !b) {
    return <Columns columns={columns} Link={Link} />;
  }
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {col?.label ? (
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
          {col.label}
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-3 sm:grid-cols-2 sm:grid-rows-1 sm:gap-4">
        <MegaMenuItemRow item={a} Link={Link} variant="tile" />
        <MegaMenuItemRow item={b} Link={Link} variant="tile" />
      </div>
    </div>
  );
}

function Columns({
  columns,
  Link,
}: {
  columns: MegaNavColumn[];
  Link: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
  }>;
}) {
  if (columns.length === 1) {
    const col = columns[0]!;
    return (
      <div className="min-w-0">
        {col.label ? (
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
            {col.label}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {col.items.map((item) => (
            <MegaMenuItemRow key={`${item.href}-${item.title}`} item={item} Link={Link} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-2">
      {columns.map((col, idx) => (
        <div key={col.label ?? `col-${idx}`} className="min-w-0">
          {col.label ? (
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {col.label}
            </div>
          ) : null}
          <div className="grid gap-2">
            {col.items.map((item) => (
              <MegaMenuItemRow key={`${item.href}-${item.title}`} item={item} Link={Link} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MegaMenuPanelBody({
  group,
  Link,
}: {
  group: MegaNavGroup;
  Link: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
  }>;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px]",
        "ring-1 ring-white/[0.12]",
        "shadow-[0_28px_90px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)_inset]",
      )}
    >
      <div className="absolute inset-0 bg-[#07080b]/75 backdrop-blur-md" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_0_1px_rgba(34,211,238,0.06)] rounded-[22px]" />

      <div className="relative grid gap-0 lg:grid-cols-[minmax(280px,34%)_1fr] lg:items-stretch">
        {group.featured ? (
          <div className="flex h-full flex-col border-b border-white/[0.07] p-4 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-5">
            <FeaturedCard featured={group.featured} Link={Link} />
          </div>
        ) : null}
        <div
          className={cn(
            "flex min-h-0 flex-col bg-[#0b0c11] p-6 lg:h-full lg:p-8",
            MEGA_MAIN_COLUMN_MIN,
            group.mainColumnMinClass,
          )}
        >
          {group.contentLayout === "two-tiles-fill" ? (
            <TwoTilesFill columns={group.columns} Link={Link} />
          ) : (
            <Columns columns={group.columns} Link={Link} />
          )}
        </div>
      </div>
    </div>
  );
}
