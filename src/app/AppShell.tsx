"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// Lazy load heavy components for better initial performance
const Sidebar = dynamic(() => import("../components/layout/Sidebar"), {
  ssr: false,
  // Match desktop sidebar default "collapsed" width to avoid a transition blink
  // when navigating to routes where the sidebar mounts.
  loading: () => (
    <div
      className="w-[52px] bg-[#0b0b0b] border-r border-white/10 transition-[width] duration-250 ease-out"
      aria-hidden
    />
  ),
});

const MobileTopbar = dynamic(() => import("../components/layout/MobileTopbar"), {
  ssr: false,
});

const MobileSidebarDrawer = dynamic(() => import("../components/layout/MobileSidebarDrawer"), {
  ssr: false,
});

const HIDE_SIDEBAR_ROUTES = new Set([
  "/", // landing
  "/apply", // legacy apply flow
  "/careers", // careers portal - full-width, no sidebar
  "/about", // about page - full-width marketing
  "/diplomeme", // affiliate storefront - full-width, scrollable
  "/blogs", // blog portal - own sidebar, full-width
  "/pricing", // pricing page - full-width marketing
  "/welcome", // creator launch onboarding - full-width, no sidebar
  "/press", // press page - full-width, scrollable
  "/invest", // investor funnel — full-width, no sidebar
  "/auth/sign-in-to-buy", // full-screen sign-in for purchase — no sidebar/topbar, scrollable
  "/what-is-edgaze",
  "/how-edgaze-works",
  "/for-creators",
  "/for-buyers",
  "/ai-workflow-marketplace",
  "/workflow-studio",
  "/why-workflows-not-prompts",
  "/run-ai-workflows",
  "/monetize-ai-workflows",
  "/about/mission",
]);

const HIDE_SIDEBAR_PREFIXES = ["/blogs", "/auth/sign-in-to-buy"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathKey = (pathname || "/").replace(/\/+$/, "") || "/";
  const creatorLaunchMode = pathname.startsWith("/builder") && searchParams?.get("onboarding") === "1";
  const hideSidebar =
    HIDE_SIDEBAR_ROUTES.has(pathKey) ||
    HIDE_SIDEBAR_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    creatorLaunchMode;
  const isLibraryPage = pathname === "/library";
  const isLibraryAnalytics = pathname.startsWith("/library/analytics");
  const isCreatorsOnboarding = pathname === "/creators/onboarding";
  const isDashboardEarnings = pathname === "/dashboard/earnings";
  const isHelpPage = pathname === "/help";
  const isTemplatesRoute = pathname === "/templates" || pathname.startsWith("/templates/");
  const isAdminPage = pathname.startsWith("/admin");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Before mount: render a single static shell so server and client HTML match.
  // usePathname() can differ between server and client, causing hydration mismatches.
  if (!mounted) {
    return <main className="min-h-screen">{children}</main>;
  }

  // Pathname-dependent layout only after mount
  if (hideSidebar) {
    return <main className="min-h-screen">{children}</main>;
  }

  const isBuilderPage = pathname.startsWith("/builder");
  const mainClasses = isBuilderPage
    ? "app-shell-main flex-1 min-h-0 h-0 overflow-hidden"
    : isCreatorsOnboarding ||
        isDashboardEarnings ||
        isAdminPage ||
        isHelpPage ||
        isLibraryAnalytics ||
        isTemplatesRoute
      ? "app-shell-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      : isLibraryPage
        ? "app-shell-main flex-1 overflow-hidden library-page-main"
        : "app-shell-main flex-1 overflow-hidden";
  const containerClasses = isLibraryPage
    ? "relative isolate flex h-screen overflow-hidden library-page-container"
    : "relative isolate flex h-screen overflow-hidden";
  const contentClasses = isLibraryPage
    ? "relative z-0 flex-1 flex flex-col overflow-hidden library-page-content"
    : "relative z-0 flex-1 flex flex-col overflow-hidden";

  return (
    <div
      className={containerClasses}
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.2s ease-in" }}
    >
      {/* Desktop sidebar only. Mobile topbar/drawer are md:hidden, so these never coexist. */}
      <div className="relative z-[90] hidden md:block">
        <Sidebar />
      </div>

      {/* Content column */}
      <div className={contentClasses}>
        <MobileTopbar />
        <main className={mainClasses}>{children}</main>
      </div>

      {/* Mobile drawer overlay */}
      {mounted && <MobileSidebarDrawer />}
    </div>
  );
}
