"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../components/layout/Sidebar";
import MobileTopbar from "../components/layout/MobileTopbar";
import MobileSidebarDrawer from "../components/layout/MobileSidebarDrawer";

const HIDE_SIDEBAR_ROUTES = new Set([
  "/",      // landing
  "/apply", // your apply flow
]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = HIDE_SIDEBAR_ROUTES.has(pathname);
  const isLibraryPage = pathname === "/library";

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
    <div className={containerClasses}>
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
      <MobileSidebarDrawer />
    </div>
  );
}
