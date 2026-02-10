"use client";

import dynamic from "next/dynamic";

// Lazy load analytics and mixpanel to improve initial load
const LazyMixpanelInit = dynamic(() => import("../../app/MixpanelInit"), { ssr: false });
const LazyAnalytics = dynamic(
  () => import("@vercel/analytics/react").then((mod) => ({ default: mod.Analytics })),
  { ssr: false }
);

export default function LazyAnalyticsWrapper() {
  return (
    <>
      <LazyMixpanelInit />
      <LazyAnalytics />
    </>
  );
}
