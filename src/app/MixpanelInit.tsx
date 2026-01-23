"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initMixpanel, track, trackPageView } from "../lib/mixpanel";

export default function MixpanelInit() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitRef = useRef(false);
  const lastPageKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // StrictMode (dev) runs effects twice; ensure init/open only once.
    if (didInitRef.current) return;
    didInitRef.current = true;

    initMixpanel();

    // Once per tab/session. Useful for DAU & session counts.
    track("App Opened", { surface: "root" });
  }, []);

  useEffect(() => {
    // Track page views on App Router navigations.
    const qs = searchParams?.toString() ?? "";
    const key = `${pathname}?${qs}`;
    if (lastPageKeyRef.current === key) return;
    lastPageKeyRef.current = key;

    trackPageView({
      surface: "router",
      route: pathname,
      query: qs || undefined,
    });
  }, [pathname, searchParams]);

  return null;
}
