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
  Sparkles,
  Files,
} from "lucide-react";

import { useSidebar } from "./SidebarContext";
import FoundingCreatorBadge from "../ui/FoundingCreatorBadge";
import { useAuth } from "../auth/AuthContext";
import ProfileAvatar from "../ui/ProfileAvatar";
import ProfileLink from "../ui/ProfileLink";

/* joiner */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/* -------------------- NAV GROUPS -------------------- */

const WORKSPACE_ITEMS: NavItem[] = [
  { href: "/marketplace", label: "Marketplace", icon: Home },
  { href: "/library", label: "Library", icon: Files },
];

const BUILD_ITEMS: NavItem[] = [
  { href: "/builder", label: "Workflow Studio", icon: PanelsTopLeft },
  { href: "/prompt-studio", label: "Prompt Studio", icon: Sparkles },
];

const ACCOUNT_ITEMS: NavItem[] = [{ href: "/profile", label: "Profile", icon: User }];

const FOOTER_ITEMS: NavItem[] = [
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

/* -------------------- SIDEBAR COMPONENT -------------------- */

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  // Supabase auth
  const { profile, userId, openSignIn, signOut, loading } = useAuth();

  const displayName =
    profile?.full_name?.trim() ||
    (profile?.handle ? `@${profile.handle}` : "") ||
    "Your account";

  const planLabel = (profile?.plan ?? "Free") + " plan";

  const initials =
    (displayName || "")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const avatarSrc = profile?.avatar_url || "/brand/edgaze-mark.png";

  const isActive = (href: string) => pathname.startsWith(href);
  const widthClass = collapsed ? "w-[76px]" : "w-[260px]";

  return (
    <aside
      className={cn(
        "relative flex-shrink-0 h-screen border-r border-white/10 bg-[#050505]",
        "transition-[width] duration-250 ease-out",
        widthClass
      )}
    >
      <div className="relative flex h-full flex-col px-3 pt-4 pb-3 gap-6">
        {/* TOP LOGO + TOGGLE */}
        <div
          className={cn(
            collapsed
              ? "flex flex-col items-center gap-2"
              : "flex items-center justify-between gap-2"
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative h-11 w-11 flex-shrink-0">
              <Image src="/brand/edgaze-mark.png" alt="Edgaze" fill priority sizes="44px" />
            </div>
            {!collapsed && (
              <span className="truncate text-[20px] font-semibold tracking-tight text-white">
                edgaze
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
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

        {/* ACCOUNT CHIP (expanded only) */}
        {!collapsed && (
          <div className="rounded-xl border border-gray-600/50 bg-white/5 px-3 py-2.5">
            {loading ? (
              <div className="text-xs text-white/60">Loading account…</div>
            ) : userId && profile ? (
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  name={displayName}
                  avatarUrl={profile?.avatar_url || null}
                  size={32}
                  handle={profile?.handle}
                  userId={userId}
                />

                <div className="flex flex-1 flex-col min-w-0">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <ProfileLink
                      name={displayName}
                      handle={profile?.handle}
                      userId={userId}
                      showBadge={true}
                      badgeSize="md"
                      className="min-w-0 truncate text-xs font-medium text-white/90"
                    />
                  </div>
                  <span className="text-[11px] text-white/50">{planLabel}</span>
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-[11px] text-white/60 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/90">
                    Not signed in
                  </span>
                  <span className="text-[11px] text-white/50">
                    Sign in to save and publish
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openSignIn}
                  className="rounded-xl border border-white/14 bg-black/40 px-3 py-1.5 text-[11px] text-white/80 hover:bg-black/60"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        )}

        {/* NAVIGATION */}
        <div className="flex-1 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <NavGroup
              title={collapsed ? "" : "Workspace"}
              items={WORKSPACE_ITEMS}
              collapsed={collapsed}
              isActive={isActive}
            />
            <NavGroup
              title={collapsed ? "" : "Build"}
              items={BUILD_ITEMS}
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

/* -------------------- SUBCOMPONENTS -------------------- */

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
          "flex items-center gap-3 rounded-2xl px-3.5 py-3",
          "transition-colors duration-150",
          active
            ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.55)]"
            : "border border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.06] hover:border-white/25"
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
