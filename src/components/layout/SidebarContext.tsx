"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type SidebarCtx = {
  // Desktop behavior (collapsed/narrow vs expanded)
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;

  // Mobile behavior (drawer open/close)
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  toggleMobile: () => void;
  closeMobile: () => void;
};

const Ctx = createContext<SidebarCtx | undefined>(undefined);

export function useSidebar(): SidebarCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSidebar must be used within <SidebarProvider>");
  return c;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Desktop: start collapsed by default
  const [collapsed, setCollapsed] = useState(true);

  // Mobile: drawer closed by default
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();

  // Any time route changes:
  // - collapse desktop sidebar (max space)
  // - close mobile drawer (prevent stale open drawer after navigation)
  useEffect(() => {
    queueMicrotask(() => {
      setCollapsed(true);
      setMobileOpen(false);
    });
  }, [pathname]);

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      mobileOpen,
      setMobileOpen,
      toggleMobile: () => setMobileOpen((v) => !v),
      closeMobile: () => setMobileOpen(false),
    }),
    [collapsed, mobileOpen]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// default export so existing imports keep working
export default SidebarProvider;
