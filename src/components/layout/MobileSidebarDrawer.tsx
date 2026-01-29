"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { X, Home, Files, User, HelpCircle, Settings } from "lucide-react";
import { useSidebar } from "./SidebarContext";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

// MOBILE: intentionally exclude Workflow Studio + Prompt Studio
const MOBILE_ITEMS_TOP: NavItem[] = [
  { href: "/marketplace", label: "Marketplace", icon: Home },
  { href: "/library", label: "Library", icon: Files },
];

const MOBILE_ITEMS_ACCOUNT: NavItem[] = [{ href: "/profile", label: "Profile", icon: User }];

const MOBILE_ITEMS_BOTTOM: NavItem[] = [
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function MobileSidebarDrawer() {
  const pathname = usePathname();
  const { mobileOpen, closeMobile } = useSidebar();

  // Close drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeMobile]);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="md:hidden">
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[80] bg-black/60 transition-opacity",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeMobile}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-[90] h-full w-[86vw] max-w-[340px]",
          "bg-[#050505] border-r border-white/10",
          "transform transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="relative h-7 w-7">
                <Image src="/brand/edgaze-mark.png" alt="Edgaze" fill priority sizes="28px" />
              </div>
              <span className="text-[16px] font-semibold tracking-tight text-white">
                edgaze
              </span>
            </div>

            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close menu"
              className="inline-flex items-center justify-center rounded-xl border border-white/14 bg-black/40 hover:bg-black/60 active:scale-95 transition-all h-9 w-9"
            >
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4">
            <NavSection items={MOBILE_ITEMS_TOP} isActive={isActive} onNavigate={closeMobile} />
            <div className="h-px bg-white/10" />
            <NavSection items={MOBILE_ITEMS_ACCOUNT} isActive={isActive} onNavigate={closeMobile} />
          </div>

          {/* Footer */}
          <div className="px-3 pb-4">
            <div className="h-px bg-white/10 mb-4" />
            <NavSection items={MOBILE_ITEMS_BOTTOM} isActive={isActive} onNavigate={closeMobile} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function NavSection({
  items,
  isActive,
  onNavigate,
}: {
  items: NavItem[];
  isActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="block"
          >
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3.5 py-3",
                "transition-colors duration-150",
                active
                  ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.45)]"
                  : "border border-white/12 bg-white/[0.03] text-white/80 hover:bg-white/[0.08] hover:border-white/35"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium truncate">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
