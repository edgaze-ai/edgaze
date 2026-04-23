"use client";

import { useEffect } from "react";

const AFFILIATE_SLUG = "diplomeme";
const STORAGE_KEY = "edgaze_affiliate_device_id";

function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return "storage-unavailable";
  }
}

function trackAffiliateEvent(eventType: "page_view" | "cta_click", targetUrl?: string) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    slug: AFFILIATE_SLUG,
    eventType,
    deviceFingerprint: getDeviceId(),
    pageUrl: window.location.href,
    referrer: document.referrer || null,
    targetUrl: targetUrl ?? null,
  });

  fetch("/api/affiliate/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export default function DiplomemeStorefrontTracker({ ctaUrl }: { ctaUrl: string }) {
  useEffect(() => {
    trackAffiliateEvent("page_view");
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest("[data-affiliate-cta]") : null;
      if (!target) return;
      trackAffiliateEvent("cta_click", ctaUrl);
    };

    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [ctaUrl]);

  return null;
}
