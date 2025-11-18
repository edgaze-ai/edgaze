"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type SidebarCtx = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
};

const Ctx = createContext<SidebarCtx | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // start collapsed by default
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();

  // Any time route changes, auto-collapse so the page gets max space.
  useEffect(() => {
    setCollapsed(true);
  }, [pathname]);

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
    }),
    [collapsed]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSidebar(): SidebarCtx {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error("useSidebar must be used within <SidebarProvider>");
  }
  return c;
}
