// src/app/auth/callback/CallbackClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

/**
 * Clean a path - extract relative path from full URL if needed
 * IMPORTANT: Preserves query parameters and hash (needed for action=run, action=purchase, etc.)
 */
function cleanPath(path: string): string | null {
  if (!path || typeof path !== "string") return null;
  
  let cleaned = path.trim();
  if (!cleaned) return null;
  
  // If it's a full URL, extract just the path part (including query and hash)
  if (cleaned.includes("http://") || cleaned.includes("https://")) {
    try {
      const url = new URL(cleaned);
      // CRITICAL: Preserve query params and hash (needed for action=run, action=purchase, etc.)
      cleaned = url.pathname + url.search + url.hash;
    } catch {
      // If URL parsing fails, try to extract path manually
      const match = cleaned.match(/^https?:\/\/[^\/]+(\/.*)$/);
      if (match?.[1]) {
        cleaned = match[1];
      } else {
        return null;
      }
    }
  }
  
  // Must be a relative path starting with /
  if (!cleaned.startsWith("/")) return null;
  if (cleaned.startsWith("//")) return null;
  
  // Don't allow redirect to auth pages or root (to avoid loops)
  // But allow query params and hash
  const pathOnly = cleaned.split("?")[0]?.split("#")[0];
  if (!pathOnly || pathOnly === "/" || pathOnly.startsWith("/auth/")) return null;
  
  return cleaned;
}

/**
 * Get return path from storage
 */
function getReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  
  try {
    const fromLocal = localStorage.getItem("edgaze:returnTo");
    const fromSession = sessionStorage.getItem("edgaze:returnTo");
    const result = fromLocal || fromSession;
    console.log("[Callback getReturnPath] Retrieved:", result, "from localStorage:", !!fromLocal, "from sessionStorage:", !!fromSession);
    return result;
  } catch (err) {
    console.error("[Callback getReturnPath] Error reading path:", err);
    return null;
  }
}

/**
 * Clear return path from storage
 */
function clearReturnPath() {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem("edgaze:returnTo");
    sessionStorage.removeItem("edgaze:returnTo");
  } catch {}
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function CallbackClient() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      // CRITICAL: Log current origin to debug redirect issues
      const currentOrigin = typeof window !== "undefined" ? window.location.origin : "unknown";
      const currentUrl = typeof window !== "undefined" ? window.location.href : "unknown";
      
      console.log("[Auth Callback] Current origin:", currentOrigin);
      console.log("[Auth Callback] Current URL:", currentUrl);
      console.log("[Auth Callback] Expected origin for localhost:", "http://localhost:3000");
      console.log("[Auth Callback] Expected origin for production:", "https://edgaze.ai");
      
      // If we're on localhost but got redirected to production, show error
      if (currentOrigin.includes("edgaze.ai") && typeof window !== "undefined") {
        const referrer = document.referrer;
        console.error("[Auth Callback] ERROR: Redirected to production from localhost!", {
          currentOrigin,
          referrer,
          expectedOrigin: "http://localhost:3000",
        });
        
        // Check if we came from localhost
        if (referrer.includes("localhost")) {
          setError(
            `Redirect Error: You were redirected to production (edgaze.ai) instead of localhost. ` +
            `This is likely a Supabase Dashboard configuration issue. ` +
            `Check your Supabase Dashboard → Authentication → URL Configuration → Site URL should be empty or set to http://localhost:3000 for local development.`
          );
          setDebugInfo(`Current: ${currentOrigin} | Referrer: ${referrer}`);
          return;
        }
      }
      // Apply flow: we must exchange the code FIRST, then redirect to /apply?resume=1
      // so the user lands with a session and sees the verifying screen (not marketplace).
      // Do NOT redirect early here — that would send them to /apply without a session.
      const isApplyFlow = (() => {
        try {
          const resume = sessionStorage.getItem("edgaze:apply:resume") === "1";
          const resumeStep = sessionStorage.getItem("edgaze:apply:resumeStep");
          return resume && resumeStep === "auth";
        } catch {
          return false;
        }
      })();

      // Determine where to redirect after OAuth callback
      // Priority: apply flow / storage / query param / referrer / default to marketplace
      let returnTo: string | null = null;
      let redirectReason = "";
      let fromStorage: string | null = null;

      // If user came from apply flow (e.g. sign-in from apply page), send them to marketplace.
      if (isApplyFlow) {
        returnTo = "/marketplace";
        redirectReason = "apply flow (sessionStorage flags)";
        console.log("[Auth Callback] Apply flow detected, will redirect to /marketplace after exchanging code");
      }

      // Priority 1: Check query parameter (passed in redirectTo URL) — unless already set by apply flow
      const nextParam = params.get("next");
      if (!returnTo && nextParam) {
        try {
          const decoded = decodeURIComponent(nextParam);
          const cleaned = cleanPath(decoded);
          if (cleaned) {
            // If next points to apply, ensure we use /apply?resume=1 so they see verifying screen
            returnTo = cleaned.includes("/apply") ? "/apply?resume=1" : cleaned;
            redirectReason = `query param (${decoded})`;
            console.log("[Auth Callback] Using path from query param:", returnTo);
          }
        } catch {
          const cleaned = cleanPath(nextParam);
          if (cleaned) {
            returnTo = cleaned.includes("/apply") ? "/apply?resume=1" : cleaned;
            redirectReason = `query param (raw: ${nextParam})`;
            console.log("[Auth Callback] Using path from query param (raw):", returnTo);
          }
        }
      }

      // Priority 2: Check storage (saved when modal was opened or by apply flow)
      // This should include query params like action=run, action=purchase, resume=1
      if (!returnTo) {
        fromStorage = getReturnPath();
        if (fromStorage) {
          const cleaned = cleanPath(fromStorage);
          if (cleaned) {
            returnTo = cleaned.includes("/apply") ? "/apply?resume=1" : cleaned;
            redirectReason = `storage (${fromStorage})`;
            console.log("[Auth Callback] Using path from storage:", returnTo);
          }
        }
      }
      
      // Priority 3: Check referrer (if user came from our domain)
      // Only use if same origin to prevent production URLs on localhost
      if (!returnTo && typeof window !== "undefined" && document.referrer) {
        try {
          const referrerUrl = new URL(document.referrer);
          // CRITICAL: Only use referrer if it's from the SAME origin
          // This prevents production URLs from being used on localhost
          if (referrerUrl.origin === window.location.origin) {
            const referrerPath = referrerUrl.pathname + referrerUrl.search + referrerUrl.hash;
            const cleaned = cleanPath(referrerPath);
            if (cleaned) {
              returnTo = cleaned.includes("/apply") ? "/apply?resume=1" : cleaned;
              redirectReason = `referrer (${referrerPath})`;
              console.log("[Auth Callback] Using path from referrer:", returnTo);
            }
          } else {
            console.warn("[Auth Callback] Ignoring referrer from different origin:", referrerUrl.origin, "vs", window.location.origin);
          }
        } catch (err) {
          console.error("[Auth Callback] Error parsing referrer:", err);
        }
      }
      
      // Default to marketplace if no valid path found
      if (!returnTo) {
        returnTo = "/marketplace";
        redirectReason = "default (no valid path found)";
        console.warn("[Auth Callback] No valid path found, defaulting to marketplace");
        
        // Show error if we're defaulting to marketplace when we shouldn't
        const hasQueryParams = typeof window !== "undefined" && window.location.search;
        if (hasQueryParams) {
          console.error("[Auth Callback] WARNING: Defaulting to marketplace but URL has query params:", window.location.search);
          setError(
            `Redirect Error: Could not determine where to redirect after sign-in. ` +
            `Redirecting to marketplace. ` +
            `This might happen if the return path wasn't saved properly before sign-in. ` +
            `Check browser console for details.`
          );
        }
      }
      
      console.log("[Auth Callback] Final redirect decision:", {
        returnTo,
        reason: redirectReason,
        currentOrigin: typeof window !== "undefined" ? window.location.origin : "unknown",
        hasActionParam: returnTo.includes("action="),
        hasResumeParam: returnTo.includes("resume="),
        storageHadPath: !!fromStorage,
        queryParamHadPath: !!params.get("next"),
      });

      const code = params.get("code");

      // DON'T clear storage yet - we need it if auth fails and we need to retry
      // Only clear AFTER successful redirect

      // 1) If already signed in, redirect immediately
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        console.log("[Auth Callback] Already signed in, redirecting to:", returnTo);
        clearReturnPath(); // Clear only after we're about to redirect
        router.replace(returnTo);
        return;
      }

      // 2) If no code, nothing to exchange. Redirect.
      if (!code) {
        console.warn("[Auth Callback] No code parameter, redirecting to:", returnTo);
        clearReturnPath(); // Clear only after we're about to redirect
        router.replace(returnTo);
        return;
      }

      // 3) Exchange code for session
      console.log("[Auth Callback] Exchanging code for session...");
      const { error, data } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.session) {
        console.log("[Auth Callback] Session created successfully, redirecting to:", returnTo);
        clearReturnPath(); // Clear only after we're about to redirect
        router.replace(returnTo);
        return;
      }

      if (error) {
        console.error("[Auth Callback] Error exchanging code:", error);
      }

      // Fallback: wait a bit then check session again
      console.log("[Auth Callback] Waiting and checking session again...");
      await sleep(250);
      const again = await supabase.auth.getSession();

      if (again.data.session) {
        console.log("[Auth Callback] Session found after wait, redirecting to:", returnTo);
        clearReturnPath(); // Clear only after we're about to redirect
        router.replace(returnTo);
        return;
      }

      // Last resort: go to marketplace
      console.error("[Auth Callback] Failed to authenticate after all attempts");
      clearReturnPath(); // Clear on failure too
      
      // Show error with details about what went wrong
      const errorDetails = [
        `Failed to complete authentication.`,
        `Redirecting to marketplace.`,
        `Reason: ${redirectReason || "authentication failed"}.`,
      ];
      
      if (returnTo === "/marketplace") {
        errorDetails.push(
          `\n\nNote: No return path was found. ` +
          `This might happen if:`,
          `1. The sign-in modal wasn't opened from a page`,
          `2. The return path wasn't saved properly`,
          `3. Browser storage was cleared during sign-in`
        );
      } else {
        errorDetails.push(
          `\n\nNote: Intended redirect was: ${returnTo} ` +
          `but authentication failed, so redirecting to marketplace instead.`
        );
      }
      
      setError(errorDetails.join(" "));
      router.replace("/marketplace");
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show error UI if there's an error
  if (error) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center p-6">
        <div className="max-w-2xl w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-xl font-semibold text-red-400 mb-2">Authentication Redirect Error</h1>
          <p className="text-sm text-white/80 mb-4">{error}</p>
          {debugInfo && (
            <div className="text-xs text-white/60 font-mono bg-black/50 p-3 rounded mb-4">
              {debugInfo}
            </div>
          )}
          <div className="text-xs text-white/60 space-y-2">
            <p><strong>To fix this:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Go to Supabase Dashboard → Authentication → URL Configuration</li>
              <li>Set <strong>Site URL</strong> to: <code className="bg-black/50 px-1 rounded">http://localhost:3000</code> (for local dev)</li>
              <li>Ensure <strong>Redirect URLs</strong> includes: <code className="bg-black/50 px-1 rounded">http://localhost:3000/auth/callback</code></li>
              <li>Clear browser cache and try again</li>
            </ol>
          </div>
          <button
            onClick={() => {
              clearReturnPath();
              router.push("/marketplace");
            }}
            className="mt-4 px-4 py-2 bg-white text-black rounded-lg font-semibold hover:bg-white/90"
          >
            Go to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center">
      <div className="text-white/60">Completing sign-in...</div>
    </div>
  );
}
