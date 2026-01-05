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

  if (hideSidebar) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar only */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Content column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar only */}
        <MobileTopbar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      {/* Mobile drawer overlay */}
      <MobileSidebarDrawer />
    </div>
  );
}
