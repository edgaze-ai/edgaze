"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// Lazy load heavy components for better initial performance
const Sidebar = dynamic(() => import("../components/layout/Sidebar"), {
  ssr: false,
  loading: () => <div className="w-[300px] bg-[#0b0b0b] border-r border-white/10" />,
});

const MobileTopbar = dynamic(() => import("../components/layout/MobileTopbar"), {
  ssr: false,
  loading: () => <div className="h-16 bg-[#0b0b0b] border-b border-white/10 md:hidden" />,
});

const MobileSidebarDrawer = dynamic(() => import("../components/layout/MobileSidebarDrawer"), {
  ssr: false,
});

const HIDE_SIDEBAR_ROUTES = new Set([
  "/", // landing
  "/apply", // legacy apply flow
  "/careers", // careers portal - full-width, no sidebar
  "/about", // about page - full-width marketing
  "/blogs", // blog portal - own sidebar, full-width
  "/pricing", // pricing page - full-width marketing
  "/help", // help page - full-width, scrollable
  "/auth/sign-in-to-buy", // full-screen sign-in for purchase — no sidebar/topbar, scrollable
]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar =
    HIDE_SIDEBAR_ROUTES.has(pathname) ||
    pathname.startsWith("/blogs") ||
    pathname.startsWith("/auth/sign-in-to-buy");
  const isLibraryPage = pathname === "/library";
  const isCreatorsOnboarding = pathname === "/creators/onboarding";
  const isDashboardEarnings = pathname === "/dashboard/earnings";
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

  const mainClasses =
    isCreatorsOnboarding || isDashboardEarnings
      ? "flex-1 min-h-0 overflow-y-auto"
      : isLibraryPage
        ? "flex-1 overflow-hidden library-page-main"
        : "flex-1 overflow-hidden";
  const containerClasses = isLibraryPage
    ? "flex h-screen overflow-hidden library-page-container"
    : "flex h-screen overflow-hidden";
  const contentClasses = isLibraryPage
    ? "flex-1 flex flex-col overflow-hidden library-page-content"
    : "flex-1 flex flex-col overflow-hidden";

  return (
    <div
      className={containerClasses}
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.2s ease-in" }}
    >
      {/* Desktop sidebar only */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Content column */}
      <div className={contentClasses}>
        {/* Mobile topbar only */}
        <MobileTopbar />
        <main className={mainClasses}>{children}</main>
      </div>

      {/* Mobile drawer overlay */}
      {mounted && <MobileSidebarDrawer />}
    </div>
  );
}
