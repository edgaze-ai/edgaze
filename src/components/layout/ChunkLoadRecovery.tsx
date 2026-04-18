"use client";

import { useEffect } from "react";

const STORAGE_KEY = "edgaze:chunk-recovery-reloaded";

function isChunkLoadFailure(reason: unknown): boolean {
  if (reason instanceof Error) {
    if (reason.name === "ChunkLoadError") return true;
    const m = reason.message;
    return (
      m.includes("ChunkLoadError") ||
      m.includes("Loading chunk") ||
      m.includes("Failed to fetch dynamically imported module")
    );
  }
  return (
    typeof reason === "string" &&
    (reason.includes("ChunkLoadError") || reason.includes("Loading chunk"))
  );
}

function reloadOnceForStaleDeploy(): void {
  try {
    if (typeof window === "undefined" || sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    return;
  }
  window.location.reload();
}

/**
 * After a production deploy, a long-lived tab can still run an old JS manifest while
 * hashed chunks were replaced — chunk requests 404 and the app breaks. One hard reload
 * fetches a fresh document and aligns chunk hashes.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    // In development, HMR and transient chunk/network blips can fire script errors on `/_next/static/*`.
    // Reloading the tab causes a "full reload" loop and floods the server with GET / — only do this in production.
    if (process.env.NODE_ENV !== "production") return;

    const onError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLScriptElement)) return;
      const src = target.src || "";
      if (!src.includes("/_next/static/")) return;
      reloadOnceForStaleDeploy();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadFailure(event.reason)) return;
      event.preventDefault();
      reloadOnceForStaleDeploy();
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
