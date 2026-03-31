"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import {
  Home,
  Workflow,
  User,
  HelpCircle,
  Settings,
  Sparkles,
  BookOpen,
  DollarSign,
} from "lucide-react";

import { useSidebar } from "./SidebarContext";
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
  { href: "/library", label: "Library", icon: BookOpen },
];

const BUILD_ITEMS: NavItem[] = [
  { href: "/builder", label: "Workflow Studio", icon: Workflow },
  { href: "/prompt-studio", label: "Prompt Studio", icon: Sparkles },
];

// Monetisation → Creator Program (/creators) until Stripe onboarding done, then → Earnings
function getCreatorItems(canReceivePayments: boolean | null | undefined): NavItem[] {
  return [
    canReceivePayments
      ? { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign }
      : { href: "/creators", label: "Monetisation", icon: DollarSign },
  ];
}

// Include a query param so /profile can show a sign-in CTA only when opened from sidebar.
const ACCOUNT_ITEMS: NavItem[] = [{ href: "/profile?from=sidebar", label: "Profile", icon: User }];

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
    profile?.full_name?.trim() || (profile?.handle ? `@${profile.handle}` : "") || "Your account";

  const planLabel = (profile?.plan ?? "Free") + " plan";
  const sidebarRootRef = React.useRef<HTMLElement | null>(null);

  const isActive = (href: string) => pathname.startsWith(href);
  const widthClass = collapsed ? "w-[76px]" : "w-[260px]";

  const expandSidebar = () => setCollapsed(false);
  const collapseSidebar = () => setCollapsed(true);
  const handleBlur = () => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof Node) || !sidebarRootRef.current?.contains(activeElement)) {
        collapseSidebar();
      }
    });
  };

  return (
    <aside
      ref={sidebarRootRef}
      onMouseEnter={expandSidebar}
      onMouseLeave={collapseSidebar}
      onFocusCapture={expandSidebar}
      onBlurCapture={handleBlur}
      className={cn(
        // z-index: keep sidebar above any page-level fixed/absolute backgrounds in content
        "relative z-[90] flex-shrink-0 h-screen border-r border-white/10 bg-[#050505]",
        "transition-[width] duration-200 ease-out will-change-[width]",
        widthClass,
      )}
    >
      <div className="relative flex h-full flex-col px-3 pt-4 pb-3 gap-6">
        {/* TOP LOGO */}
        <div
          className={cn(
            "flex items-center gap-3 overflow-hidden",
            collapsed ? "pl-[2px]" : "",
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
        </div>

        {/* ACCOUNT CHIP (expanded only) */}
        {!collapsed ? (
          <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] px-3.5 py-3">
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/10" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-white/10" />
                  <div className="h-3 w-16 rounded bg-white/5" />
                </div>
              </div>
            ) : userId && profile ? (
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar
                  name={displayName}
                  avatarUrl={profile?.avatar_url || null}
                  size={36}
                  handle={profile?.handle}
                  userId={userId}
                />

                <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                    <ProfileLink
                      name={displayName}
                      handle={profile?.handle}
                      userId={userId}
                      showBadge={false}
                      linkClassName="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
                      className="truncate text-[13px] font-semibold text-white/95"
                    />
                  </div>
                  <span className="truncate text-[11px] text-white/50">{planLabel}</span>
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="shrink-0 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-white/70 transition-all duration-200 hover:bg-white/[0.08] hover:border-white/20 hover:text-white/90 active:scale-[0.98]"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                  <span className="truncate text-[13px] font-semibold text-white/95">
                    Not signed in
                  </span>
                  <span className="truncate text-[11px] text-white/50">
                    Sign in to save and publish
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openSignIn}
                  className="shrink-0 whitespace-nowrap rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-[12px] font-semibold text-white/95 transition-all duration-200 hover:bg-white/15 hover:border-white/25 active:scale-[0.98]"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] px-3.5 py-2.5">
            {loading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
            ) : userId && profile ? (
              <ProfileAvatar
                name={displayName}
                avatarUrl={profile?.avatar_url || null}
                size={32}
                handle={profile?.handle}
                userId={userId}
              />
            ) : (
              <button
                type="button"
                onClick={openSignIn}
                className="block rounded-full transition-opacity hover:opacity-90"
                aria-label="Sign in"
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-gray-600">
                  <Image
                    src="/brand/profile-default.png"
                    alt="Default profile"
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
              </button>
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
              title={collapsed ? "" : "Creator"}
              items={getCreatorItems(profile?.can_receive_payments)}
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
        "hover:translate-x-[1px]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl px-3.5 py-3",
          "transition-colors duration-150",
          active
            ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.55)]"
            : "border border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.06] hover:border-white/25",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
      </div>
    </Link>
  );
}
