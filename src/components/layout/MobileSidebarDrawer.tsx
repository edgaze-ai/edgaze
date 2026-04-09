"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  X,
  Home,
  BookOpen,
  User,
  HelpCircle,
  Settings,
  FileText,
  Shield,
} from "lucide-react";
import { useSidebar } from "./SidebarContext";
import { ADMIN_NAV_ITEMS } from "../admin/adminNav";
import { useAuth } from "../auth/AuthContext";

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
  { href: "/library", label: "Library", icon: BookOpen },
];

// Include a query param so /profile can show a sign-in CTA only when opened from sidebar.
const MOBILE_ITEMS_ACCOUNT: NavItem[] = [
  { href: "/profile?from=sidebar", label: "Profile", icon: User },
];

const MOBILE_ITEMS_BOTTOM: NavItem[] = [
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_ADMIN_ITEMS: NavItem[] = [
  { href: "/admin/accounting", label: "Accounting", icon: FileText },
  { href: "/admin/moderation", label: "Admin", icon: Shield },
];

function isAppNavActive(pathname: string, href: string) {
  const path = href.split("?")[0] || href;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isAdminNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileSidebarDrawer() {
  const pathname = usePathname() || "";
  const isAdmin = pathname.startsWith("/admin");
  const { isAdmin: userIsAdmin } = useAuth();
  const { mobileOpen, closeMobile } = useSidebar();

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Close drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeMobile]);

  const isActiveApp = (href: string) => isAppNavActive(pathname, href);

  return (
    <div className="xl:hidden">
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[80] transition-[opacity,backdrop-filter]",
          isAdmin ? "bg-black/70 backdrop-blur-[2px]" : "bg-black/60",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
        onClick={closeMobile}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-[90] h-dvh w-[min(88vw,360px)]",
          "transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "shadow-[24px_0_80px_rgba(0,0,0,0.55)]",
          isAdmin
            ? "border-r border-white/[0.07] bg-[#070708]/98 backdrop-blur-2xl"
            : "bg-[#050505] border-r border-gray-600/50",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!mobileOpen}
        role="dialog"
        aria-modal="true"
        aria-label={isAdmin ? "Admin navigation" : "Main navigation"}
      >
        {isAdmin ? (
          <AdminDrawerBody pathname={pathname} onNavigate={closeMobile} />
        ) : (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-600/50">
              <div className="flex items-center gap-2">
                <div className="relative h-7 w-7">
                  <Image src="/brand/edgaze-mark.png" alt="Edgaze" fill priority sizes="28px" />
                </div>
                <span className="text-[16px] font-semibold tracking-tight text-white">edgaze</span>
              </div>

              <button
                type="button"
                onClick={closeMobile}
                aria-label="Close menu"
                className="inline-flex items-center justify-center rounded-xl border border-gray-600/50 bg-black/40 hover:bg-black/60 active:scale-95 transition-all h-9 w-9"
              >
                <X className="h-5 w-5 text-white/80" />
              </button>
            </div>

            {/* Nav */}
            <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4 overscroll-contain">
              <NavSection
                items={MOBILE_ITEMS_TOP}
                isActive={isActiveApp}
                onNavigate={closeMobile}
              />
              <div className="h-px bg-gray-600/50" />
              <NavSection
                items={MOBILE_ITEMS_ACCOUNT}
                isActive={isActiveApp}
                onNavigate={closeMobile}
              />
              {userIsAdmin ? (
                <>
                  <div className="h-px bg-gray-600/50" />
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
                    Admin
                  </p>
                  <NavSection
                    items={MOBILE_ADMIN_ITEMS}
                    isActive={isActiveApp}
                    onNavigate={closeMobile}
                  />
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="h-px bg-gray-600/50 mb-4" />
              <NavSection
                items={MOBILE_ITEMS_BOTTOM}
                isActive={isActiveApp}
                onNavigate={closeMobile}
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function AdminDrawerBody({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="relative overflow-hidden border-b border-white/[0.06] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(120% 90% at 0% 0%, rgba(34,211,238,0.14) 0%, transparent 55%), radial-gradient(80% 70% at 100% 0%, rgba(249,115,22,0.06) 0%, transparent 50%)",
          }}
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 pt-0.5">
            <Image
              src="/brand/edgaze-mark.png"
              alt="Edgaze"
              width={36}
              height={36}
              className="shrink-0 translate-y-[1px]"
            />
            <span className="text-[1.25rem] font-semibold tracking-[-0.02em] text-white/90 leading-tight">
              Edgaze <span className="font-semibold text-emerald-400">Admin</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close admin navigation"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition-all h-10 w-10"
          >
            <X className="h-5 w-5 text-white/85" />
          </button>
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-1"
        aria-label="Admin sections"
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isAdminNavActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} className="block">
              <div
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-cyan-400/18 via-sky-500/12 to-fuchsia-500/10 text-white border border-cyan-400/25 shadow-[0_0_0_1px_rgba(34,211,238,0.12),inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    : "text-white/78 border border-transparent hover:bg-white/[0.05] hover:border-white/[0.08] hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                    active
                      ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-200"
                      : "border-white/[0.08] bg-white/[0.03] text-white/70 group-hover:border-white/[0.12] group-hover:text-white/85",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[14px] font-medium tracking-tight leading-tight">
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/35 to-transparent">
        <Link href="/marketplace" onClick={onNavigate} className="block">
          <div className="flex items-center gap-3 rounded-2xl px-3.5 py-3.5 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all active:scale-[0.99]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-black/25">
              <ArrowLeft className="h-5 w-5 text-white/75" />
            </span>
            <div className="min-w-0">
              <span className="block text-[14px] font-semibold text-white tracking-tight">
                Back to app
              </span>
              <span className="block text-[12px] text-white/45 mt-0.5">
                Return to Edgaze marketplace
              </span>
            </div>
          </div>
        </Link>
      </div>
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
          <Link key={item.href} href={item.href} onClick={onNavigate} className="block">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3.5 py-3",
                "transition-colors duration-150",
                active
                  ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.45)]"
                  : "border border-gray-600/50 bg-white/[0.03] text-white/80 hover:bg-white/[0.08] hover:border-gray-500/60",
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
