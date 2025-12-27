"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../components/layout/Sidebar";

const HIDE_SIDEBAR_ROUTES = new Set([
  "/",        // landing
  "/apply",   // your apply flow
]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = HIDE_SIDEBAR_ROUTES.has(pathname);

  if (hideSidebar) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
