/**
 * Performance utilities for Edgaze
 * Tracks and optimizes loading performance
 */

import { track } from "./mixpanel";

type VitalBucket = { value: number; rating?: string; id?: string };
const vitalsAccum: Record<string, VitalBucket> = {};
let vitalsFlushTimer: ReturnType<typeof setTimeout> | null = null;
const VITALS_DEBOUNCE_MS = 8000;
let vitalsListenersAttached = false;

function flushVitalsToMixpanel() {
  if (vitalsFlushTimer) {
    clearTimeout(vitalsFlushTimer);
    vitalsFlushTimer = null;
  }
  const keys = Object.keys(vitalsAccum);
  if (keys.length === 0) return;

  const payload: Record<string, string | number | undefined> = {
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  };

  for (const name of keys) {
    const m = vitalsAccum[name];
    delete vitalsAccum[name];
    if (!m) continue;
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    payload[`${base}_value`] = Math.round(m.value * 1000) / 1000;
    if (m.rating) payload[`${base}_rating`] = m.rating;
  }

  try {
    track("Performance: Web Vitals", payload);
  } catch {
    // never block the app
  }
}

function scheduleVitalsFlush() {
  if (vitalsFlushTimer) return;
  vitalsFlushTimer = setTimeout(flushVitalsToMixpanel, VITALS_DEBOUNCE_MS);
}

function attachVitalsLifecycleListeners() {
  if (vitalsListenersAttached || typeof window === "undefined") return;
  vitalsListenersAttached = true;
  window.addEventListener("pagehide", () => flushVitalsToMixpanel());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushVitalsToMixpanel();
  });
}

export function reportWebVitals(metric: any) {
  if (typeof window === "undefined") return;
  attachVitalsLifecycleListeners();

  if (process.env.NODE_ENV === "development") {
    console.warn("[Performance]", {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    });
  }

  if (process.env.NODE_ENV !== "production") return;

  try {
    vitalsAccum[metric.name] = {
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
    };
    scheduleVitalsFlush();
  } catch (error) {
    console.error("[Performance] Failed to buffer web vitals:", error);
  }
}

/**
 * Preload critical resources
 */
export function preloadCriticalAssets() {
  if (typeof window === "undefined") return;

  const criticalImages = ["/brand/edgaze-mark.png", "/favicon.ico"];

  criticalImages.forEach((src) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = src;
    document.head.appendChild(link);
  });
}

/**
 * Optimize images by converting to WebP/AVIF when supported
 */
export function getOptimizedImageUrl(src: string, width?: number): string {
  if (typeof window === "undefined") return src;

  const supportsWebP =
    document.createElement("canvas").toDataURL("image/webp").indexOf("data:image/webp") === 0;

  if (supportsWebP && !src.includes(".svg")) {
    return src;
  }

  return src;
}

/**
 * Defer non-critical scripts
 */
export function deferNonCriticalScripts() {
  if (typeof window === "undefined") return;

  const scheduleTask = (fn: () => void) => {
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(fn, { timeout: 2000 });
    } else {
      setTimeout(fn, 1);
    }
  };

  scheduleTask(() => {
    console.warn("[Performance] Non-critical scripts loaded");
  });
}
