"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initMixpanel, trackPageView } from "../lib/mixpanel";

export default function MixpanelInit() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitRef = useRef(false);
  const lastPageKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const initAfterLoad = () => {
      if (didInitRef.current) return;
      didInitRef.current = true;
      initMixpanel();
    };

    // Wait for page to be interactive before loading analytics
    if (document.readyState === "complete") {
      // Page already loaded, defer slightly
      setTimeout(initAfterLoad, 100);
      return; // Explicit return for TypeScript
    } else {
      // Wait for page load
      window.addEventListener("load", initAfterLoad, { once: true });
      return () => window.removeEventListener("load", initAfterLoad);
    }
  }, []);

  useEffect(() => {
    // Track page views on App Router navigations with deduplication
    if (!pathname) return;

    const qs = searchParams?.toString() ?? "";
    const key = `${pathname}?${qs}`;

    // Prevent duplicate page views
    if (lastPageKeyRef.current === key) return;
    lastPageKeyRef.current = key;

    // Track page view with comprehensive properties
    trackPageView({
      surface: "router",
      route: pathname,
      query: qs || undefined,
    });
  }, [pathname, searchParams]);

  return null;
}
