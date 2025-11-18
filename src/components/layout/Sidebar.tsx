"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  PanelsTopLeft,
  User,
  HelpCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSidebar } from "./SidebarContext";

/* simple className joiner */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MAIN_ITEMS: NavItem[] = [
  { href: "/", label: "Marketplace", icon: Home },
  { href: "/builder", label: "Builder", icon: PanelsTopLeft },
];

const ACCOUNT_ITEMS: NavItem[] = [
  { href: "/profile", label: "Profile", icon: User },
];

const FOOTER_ITEMS: NavItem[] = [
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleToggle = () => setCollapsed(!collapsed);

  const widthClass = collapsed ? "w-[76px]" : "w-[260px]";

  return (
    <aside
      className={cn(
        "relative flex-shrink-0 h-screen border-r border-white/10 bg-[#050505]",
        "transition-[width] duration-250 ease-out",
        widthClass
      )}
    >
      {/* vertical accent line */}
      <div className="pointer-events-none absolute inset-y-2 left-[2px] w-[2px] rounded-full bg-gradient-to-b from-cyan-400 via-pink-400 to-cyan-400 opacity-70" />

      <div className="relative flex h-full flex-col px-3 pt-4 pb-3 gap-6">
        {/* HEADER: logo + wordmark + toggle */}
        <div
          className={cn(
            collapsed
              ? "flex flex-col items-center gap-2"
              : "flex items-center justify-between gap-2"
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {/* big logo – never covered */}
            <div className="relative h-11 w-11 flex-shrink-0">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                fill
                priority
                className="object-contain drop-shadow-[0_0_22px_rgba(56,189,248,0.9)]"
              />
            </div>
            {!collapsed && (
              <span className="truncate text-[20px] font-semibold tracking-tight text-white">
                edgaze
              </span>
            )}
          </div>

          {/* toggle sits under logo when collapsed so it never overlaps */}
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              "inline-flex items-center justify-center rounded-full border border-white/14",
              "bg-black/60 hover:bg-black/80 active:scale-95 transition-all",
              "h-7 w-7 text-white/70",
              collapsed ? "mt-1 self-center" : ""
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Account chip only when expanded */}
        {!collapsed && (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs">
              N
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white/90">
                Your account
              </span>
              <span className="text-[11px] text-white/50">
                Profile & settings
              </span>
            </div>
          </div>
        )}

        {/* NAVIGATION */}
        <div className="flex-1 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <NavGroup
              title={collapsed ? "" : "Workspace"}
              items={MAIN_ITEMS}
              collapsed={collapsed}
              isActive={isActive}
            />
            <NavGroup
              title={collapsed ? "" : "Account"}
              items={ACCOUNT_ITEMS}
              collapsed={collapsed}
              isActive={isActive}
            />
          </div>

          <div className="flex flex-col gap-3">
            <NavGroup
              title={collapsed ? "" : "Support"}
              items={FOOTER_ITEMS}
              collapsed={collapsed}
              isActive={isActive}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

type NavGroupProps = {
  title?: string;
  items: NavItem[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
};

function NavGroup({ title, items, collapsed, isActive }: NavGroupProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {title && (
        <div className="px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
          {title}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isActive(item.href)}
          />
        ))}
      </div>
    </div>
  );
}

type NavButtonProps = {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
};

function NavButton({ item, collapsed, active }: NavButtonProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group block rounded-2xl transition-transform duration-150",
        "hover:translate-x-[1px]"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl",
          "px-3.5 py-3", // slightly larger buttons
          "border transition-colors duration-150",
          active
            ? "border-transparent bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.55)]"
            : "border-white/12 bg-white/[0.03] text-white/75 hover:bg-white/[0.08] hover:border-white/40"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}
      </div>
    </Link>
  );
}
