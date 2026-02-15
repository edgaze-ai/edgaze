"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Ctx = { uiScale: number; setUiScale: (v: number) => void };
const UISettingsCtx = createContext<Ctx | null>(null);

export function UISettingsProvider({ children }: { children: React.ReactNode }) {
  const [uiScale, setUiScaleState] = useState<number>(1.12); // bigger by default

  useEffect(() => {
    const saved = localStorage.getItem("edge:uiScale");
    if (saved) queueMicrotask(() => setUiScaleState(Number(saved)));
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
    localStorage.setItem("edge:uiScale", String(uiScale));
  }, [uiScale]);

  const value = useMemo<Ctx>(() => ({ uiScale, setUiScale: (v) => setUiScaleState(v) }), [uiScale]);
  return <UISettingsCtx.Provider value={value}>{children}</UISettingsCtx.Provider>;
}

export function useUISettings() {
  const ctx = useContext(UISettingsCtx);
  if (!ctx) throw new Error("useUISettings must be used within UISettingsProvider");
  return ctx;
}
