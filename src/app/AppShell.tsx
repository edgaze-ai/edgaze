"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// Lazy load heavy components for better initial performance
const Sidebar = dynamic(() => import("../components/layout/Sidebar"), {
  ssr: false,
  loading: () => <div className="w-[300px] bg-[#0b0b0b] border-r border-white/10" />
});

const MobileTopbar = dynamic(() => import("../components/layout/MobileTopbar"), {
  ssr: false,
  loading: () => <div className="h-16 bg-[#0b0b0b] border-b border-white/10 md:hidden" />
});

const MobileSidebarDrawer = dynamic(() => import("../components/layout/MobileSidebarDrawer"), {
  ssr: false,
});

const HIDE_SIDEBAR_ROUTES = new Set([
  "/",      // landing
  "/apply", // your apply flow
]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = HIDE_SIDEBAR_ROUTES.has(pathname);
  const isLibraryPage = pathname === "/library";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (hideSidebar) {
    return <main className="min-h-screen">{children}</main>;
  }

  // On mobile, library page needs to scroll naturally - use CSS class for mobile override
  const containerClasses = isLibraryPage 
    ? "flex h-screen overflow-hidden library-page-container"
    : "flex h-screen overflow-hidden";
  
  const contentClasses = isLibraryPage
    ? "flex-1 flex flex-col overflow-hidden library-page-content"
    : "flex-1 flex flex-col overflow-hidden";
  
  const mainClasses = isLibraryPage
    ? "flex-1 overflow-hidden library-page-main"
    : "flex-1 overflow-hidden";

  return (
    <div className={containerClasses} style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.2s ease-in' }}>
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
