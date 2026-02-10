"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initMixpanel, track, trackPageView } from "../lib/mixpanel";

export default function MixpanelInit() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitRef = useRef(false);
  const lastPageKeyRef = useRef<string | null>(null);
  const appOpenedTrackedRef = useRef(false);

  useEffect(() => {
    // Defer Mixpanel initialization until after page load to improve initial performance
    const initAfterLoad = () => {
      // StrictMode (dev) runs effects twice; ensure init/open only once.
      if (didInitRef.current) return;
      didInitRef.current = true;

      // Initialize Mixpanel first
      initMixpanel();

      // Track app opened event only once per session
      // This is critical for accurate DAU (Daily Active Users) tracking
      if (!appOpenedTrackedRef.current) {
        appOpenedTrackedRef.current = true;
        
        // Small delay to ensure Mixpanel is initialized
        setTimeout(() => {
          track("App Opened", {
            surface: "root",
            // Track as anonymous user if not logged in
            user_type: "anonymous",
          });
        }, 100);
      }
    };

    // Wait for page to be interactive before loading analytics
    if (document.readyState === 'complete') {
      // Page already loaded, defer slightly
      setTimeout(initAfterLoad, 100);
      return; // Explicit return for TypeScript
    } else {
      // Wait for page load
      window.addEventListener('load', initAfterLoad, { once: true });
      return () => window.removeEventListener('load', initAfterLoad);
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
      // Track user type for segmentation
      user_type: "anonymous", // Will be updated by AuthContext when user logs in
    });
  }, [pathname, searchParams]);

  return null;
}
