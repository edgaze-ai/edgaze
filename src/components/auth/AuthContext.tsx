"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import SignInModal from "./SignInModal";
import { identifyUser, resetIdentity, track, setUserProperties } from "../../lib/mixpanel";

export type UserPlan = "Free" | "Pro" | "Team";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  handle: string;
  avatar_url: string | null;
  banner_url?: string | null;
  bio?: string | null;
  socials?: Record<string, string> | null;
  country?: string | null;
  plan: UserPlan;
  email_verified?: boolean | null;
  /** Platform verified badge (marketplace, etc.). */
  is_verified_creator?: boolean | null;
  /** OG / founding — public profile only. */
  is_founding_creator?: boolean | null;
  handle_last_changed_at?: string | null;
  can_receive_payments?: boolean | null;
  /** admin_provisioned | self_signup (column may be missing until migration runs) */
  source?: string | null;
  claim_status?: string | null;
};

export type HandleChangeStatus = {
  canChange: boolean;
  lastChangedAt: string | null;
  nextAllowedAt: string | null;
  daysRemaining: number;
};

export type AuthUser = {
  id: string;
  email: string | null;
  name: string;
  handle: string;
};

/** Use the standard SignInModal even on product URLs (e.g. report flow — not sign-in-to-buy). */
export type OpenSignInOptions = {
  preferModal?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;

  userId: string | null;
  userEmail: string | null;
  isVerified: boolean;
  profile: Profile | null;
  workspaceUserId: string | null;
  workspaceProfile: Profile | null;
  impersonationActive: boolean;

  isAdmin: boolean;
  isBanned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;

  loading: boolean;
  authReady: boolean;

  openSignIn: (opts?: OpenSignInOptions) => void;
  closeSignIn: () => void;

  requireAuth: (opts?: OpenSignInOptions) => boolean;
  requireVerifiedEmail: () => boolean;

  refresh: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshImpersonation: () => Promise<void>;

  updateProfile: (patch: Partial<Profile>) => Promise<{ ok: boolean; error?: string }>;

  signOut: () => Promise<void>;

  signInWithGoogle: (redirectPath?: string) => Promise<void>;

  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  signUpWithEmail: (args: {
    email: string;
    password: string;
    fullName: string;
    handle: string;
  }) => Promise<void>;

  // Get access token for API calls
  getAccessToken: (options?: { eagerRefresh?: boolean }) => Promise<string | null>;

  // Refresh the auth session (e.g. before checkout to avoid 401)
  refreshAuthSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function normalizeHandle(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 24);
}

/**
 * Simple function to clean a path - extracts relative path from full URL if needed
 */
function cleanPath(path: string): string | null {
  if (!path || typeof path !== "string") return null;

  let cleaned = path.trim();
  if (!cleaned) return null;

  // If it's a full URL, extract just the path part
  if (cleaned.includes("http://") || cleaned.includes("https://")) {
    try {
      const url = new URL(cleaned);
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
 * Save return path to storage - simple and reliable
 * IMPORTANT: Preserves query params and hash
 */
function saveReturnPath(path: string) {
  if (typeof window === "undefined") return;

  try {
    const cleaned = cleanPath(path);
    if (cleaned) {
      console.warn("[saveReturnPath] Saving path:", cleaned, "from original:", path);
      localStorage.setItem("edgaze:returnTo", cleaned);
      sessionStorage.setItem("edgaze:returnTo", cleaned);
    } else {
      console.warn("[saveReturnPath] Failed to clean path:", path);
    }
  } catch (err) {
    console.error("[saveReturnPath] Error saving path:", err);
  }
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
    console.warn(
      "[getReturnPath] Retrieved:",
      result,
      "from localStorage:",
      !!fromLocal,
      "from sessionStorage:",
      !!fromSession,
    );
    return result;
  } catch (err) {
    console.error("[getReturnPath] Error reading path:", err);
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

function isStillBannedRow(row: { is_banned?: boolean; ban_expires_at?: string | null } | null) {
  if (!row?.is_banned) return false;
  const expires = row.ban_expires_at ?? null;
  if (!expires) return true;
  const t = new Date(expires).getTime();
  if (Number.isNaN(t)) return true;
  return t > Date.now();
}

/**
 * Rare auth-side events only. Sign-in → "Login Completed"; sign-out → "User Logged Out" + "Logout Started".
 * Skip INITIAL_SESSION, TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT (noisy or covered elsewhere).
 */
const TRACKED_AUTH_BRIDGE_EVENTS = new Set(["USER_UPDATED", "PASSWORD_RECOVERY"]);

function safeTrack(event: string, props?: Record<string, any>) {
  try {
    track(event, props);
  } catch {}
}

function safeIdentify(userId: string, props?: Record<string, any>) {
  try {
    identifyUser(userId, props);
  } catch {}
}

function safeResetIdentity() {
  try {
    resetIdentity();
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname() || "";

  // next/navigation's router can change identity between renders in dev; putting it in effect deps
  // re-subscribes onAuthStateChange + refresh() repeatedly → RSC refetch spam and flaky UI.
  const routerRef = useRef(router);
  const pathnameRef = useRef(pathname);
  routerRef.current = router;
  pathnameRef.current = pathname;

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaceProfile, setWorkspaceProfile] = useState<Profile | null>(null);
  const [impersonationActive, setImpersonationActive] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [banExpiresAt, setBanExpiresAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const modalOpenRef = useRef(false);

  const inflightRef = useRef<Promise<void> | null>(null);

  // Prevent duplicate identify/alias loops
  const lastIdentifiedRef = useRef<string | null>(null);

  // Track if we've just signed in to handle redirect
  const justSignedInRef = useRef(false);

  /** Supabase session user_metadata fallback when profile row is slow or select fails */
  const [authSessionMeta, setAuthSessionMeta] = useState<{
    full_name?: string;
    handle?: string;
  } | null>(null);

  /** Last resolved user id for SIGNED_IN redirect (avoid unstable effect deps / INITIAL_SESSION false positives) */
  const lastUserIdRef = useRef<string | null>(null);

  const openSignIn = useCallback(
    (opts?: OpenSignInOptions) => {
      if (modalOpenRef.current) return;

      if (typeof window === "undefined") return;

      const preferModal = Boolean(opts?.preferModal);
      const currentPath = window.location.pathname + window.location.search + window.location.hash;

      // Product page: /p/owner/code (prompts+workflows) or /owner/code (workflow storefront)
      // Default: full-screen sign-in-to-buy. preferModal: keep traditional SignInModal (e.g. report).
      const pathSegments = window.location.pathname
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(Boolean);
      const isProductPageP = pathSegments[0] === "p" && pathSegments.length >= 3;
      const isProductPageWorkflow =
        pathSegments.length === 2 &&
        ![
          "auth",
          "marketplace",
          "library",
          "builder",
          "creators",
          "admin",
          "settings",
          "profile",
          "store",
          "apply",
          "dashboard",
        ].includes(pathSegments[0] ?? "");
      const demoQuery = new URLSearchParams(window.location.search).get("demo")?.trim();
      // Demo share links: never hijack with full-screen sign-in — modal keeps ?demo= in the URL.
      if ((isProductPageP || isProductPageWorkflow) && demoQuery) {
        if (currentPath && currentPath !== "/" && !currentPath.startsWith("/auth/")) {
          saveReturnPath(currentPath);
        }
        modalOpenRef.current = true;
        setModalOpen(true);
        safeTrack("Sign In Modal Opened", {
          surface: "auth_context",
          user_type: userId ? "authenticated" : "anonymous",
          reason: "demo_link_product_page",
        });
        return;
      }
      if (!preferModal && (isProductPageP || isProductPageWorkflow)) {
        const type = isProductPageP ? "prompt" : "workflow";
        if (currentPath && currentPath !== "/" && !currentPath.startsWith("/auth/")) {
          safeTrack("Sign In To Buy Redirect", {
            surface: "auth_context",
            from_product_page: true,
            type,
          });
          window.location.href = `/auth/sign-in-to-buy?return=${encodeURIComponent(currentPath)}&type=${type}`;
        }
        return;
      }

      // Save current path BEFORE opening modal (non-product pages)
      if (currentPath && currentPath !== "/" && !currentPath.startsWith("/auth/")) {
        saveReturnPath(currentPath);
      }

      modalOpenRef.current = true;
      setModalOpen(true);
      safeTrack("Sign In Modal Opened", {
        surface: "auth_context",
        user_type: userId ? "authenticated" : "anonymous",
      });
    },
    [userId],
  );

  const closeSignIn = useCallback(() => {
    modalOpenRef.current = false;
    setModalOpen(false);
    safeTrack("Sign In Modal Closed", { surface: "auth_context" });
  }, []);

  const clearImpersonation = useCallback(() => {
    setImpersonationActive(false);
    setWorkspaceProfile(null);
  }, []);

  const applyNoUser = useCallback(() => {
    setAuthSessionMeta(null);
    setUserId(null);
    setUserEmail(null);
    setIsVerified(false);
    setProfile(null);
    clearImpersonation();

    setIsAdmin(false);
    setIsBanned(false);
    setBanReason(null);
    setBanExpiresAt(null);

    lastIdentifiedRef.current = null;

    // Critical: clears Mixpanel distinct_id to avoid cross-account contamination
    safeResetIdentity();
  }, [clearImpersonation]);

  const PROFILE_SELECT_BASE =
    "id,email,full_name,handle,avatar_url,banner_url,bio,socials,country,plan,email_verified,is_founding_creator,is_verified_creator,can_receive_payments";

  const loadProfile = useCallback(
    async (uid: string) => {
      const withProvisioning = `${PROFILE_SELECT_BASE},source,claim_status`;

      const first = await supabase
        .from("profiles")
        .select(withProvisioning)
        .eq("id", uid)
        .maybeSingle();

      let row: Profile | null = first.data as Profile | null;
      let error = first.error;

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const code = (error as { code?: string }).code;

        if (msg.includes("is_verified_creator")) {
          const withFounding =
            "id,email,full_name,handle,avatar_url,banner_url,bio,socials,country,plan,email_verified,is_founding_creator,can_receive_payments,source,claim_status";
          const second = await supabase
            .from("profiles")
            .select(withFounding)
            .eq("id", uid)
            .maybeSingle();
          row = second.data as Profile | null;
          error = second.error;
          if (row) {
            const r = row as Profile & { is_founding_creator?: boolean | null };
            row = { ...r, is_verified_creator: false };
          }
        } else if (code === "42703" || msg.includes("claim_status") || msg.includes("source")) {
          const legacyBase =
            "id,email,full_name,handle,avatar_url,banner_url,bio,socials,country,plan,email_verified,is_founding_creator,can_receive_payments";
          const second = await supabase
            .from("profiles")
            .select(legacyBase)
            .eq("id", uid)
            .maybeSingle();
          row = second.data as Profile | null;
          error = second.error;
        }
      }

      if (error) {
        console.warn("[Auth] loadProfile failed:", error.message);
        setProfile(null);
        return;
      }
      setProfile(row);
    },
    [supabase],
  );

  const loadModeration = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from("user_moderation")
        .select("is_banned,ban_reason,ban_expires_at")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        setIsBanned(false);
        setBanReason(null);
        setBanExpiresAt(null);
        return false;
      }

      const row =
        (data as any as {
          is_banned?: boolean;
          ban_reason?: string | null;
          ban_expires_at?: string | null;
        }) ?? null;

      const stillBanned = isStillBannedRow(row);
      setIsBanned(stillBanned);
      setBanReason((row?.ban_reason as string | null) ?? null);
      setBanExpiresAt((row?.ban_expires_at as string | null) ?? null);

      return stillBanned;
    },
    [supabase],
  );

  const loadAdmin = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from("admin_roles")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        setIsAdmin(false);
        return false;
      }
      const ok = Boolean((data as any)?.user_id);
      setIsAdmin(ok);
      return ok;
    },
    [supabase],
  );

  const applyUser = useCallback(
    async (user: any | null) => {
      if (!user) {
        applyNoUser();
        return;
      }

      setAuthSessionMeta({
        full_name: user.user_metadata?.full_name ?? user.user_metadata?.name,
        handle: user.user_metadata?.handle,
      });

      setUserId(user.id);
      setUserEmail(user.email ?? null);
      setIsVerified(Boolean(user.email_confirmed_at));

      // Identify once per user id per session.
      // IMPORTANT: identifyUser() should alias anonymous -> user internally (in mixpanel.ts)
      // This merges all anonymous events into the user's profile
      if (lastIdentifiedRef.current !== user.id) {
        lastIdentifiedRef.current = user.id;

        safeIdentify(user.id, {
          email: user.email ?? undefined,
          email_verified: Boolean(user.email_confirmed_at),
          provider: user.app_metadata?.provider ?? undefined,
        });

        safeTrack("Login Completed", {
          surface: "auth_context",
          method: user.app_metadata?.provider ?? "email",
          email_verified: Boolean(user.email_confirmed_at),
          user_type: "authenticated",
        });
      }

      // Load profile immediately (critical for UI) - but don't block on it
      loadProfile(user.id).catch(() => setProfile(null));

      // Defer non-critical checks to improve initial load time
      // Use requestIdleCallback for better performance, fallback to setTimeout
      const scheduleTask = (fn: () => void, delay: number) => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          (window as any).requestIdleCallback(fn, { timeout: delay });
        } else {
          setTimeout(fn, delay);
        }
      };

      // Admin check can wait until browser is idle
      scheduleTask(() => {
        loadAdmin(user.id).catch(() => setIsAdmin(false));
      }, 100);

      // Moderation check is important but can be slightly deferred
      scheduleTask(() => {
        loadModeration(user.id)
          .then((stillBanned) => {
            if (stillBanned) {
              safeTrack("User Banned Redirect", { surface: "auth_context" });
              if (typeof window !== "undefined" && window.location.pathname !== "/banned") {
                window.location.href = "/banned";
              }
            }
          })
          .catch(() => {
            setIsBanned(false);
            setBanReason(null);
            setBanExpiresAt(null);
          });
      }, 200);
    },
    [applyNoUser, loadAdmin, loadModeration, loadProfile],
  );

  const refresh = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current;

    inflightRef.current = (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          lastUserIdRef.current = null;
          applyNoUser();
        } else {
          await applyUser(data.session?.user ?? null);
          lastUserIdRef.current = data.session?.user?.id ?? null;
        }
      } finally {
        setLoading(false);
        setAuthReady(true);
        inflightRef.current = null;
      }
    })();

    return inflightRef.current;
  }, [applyNoUser, applyUser, supabase]);

  // Update People properties once profile is available (no aliasing here)
  // This updates user properties without re-aliasing
  useEffect(() => {
    if (!userId) return;
    if (!profile) return;

    // Use setUserProperties instead of identifyUser to avoid duplicate aliasing
    try {
      setUserProperties({
        email: profile.email ?? userEmail ?? undefined,
        name: profile.full_name ?? undefined,
        handle: profile.handle ?? undefined,
        plan: profile.plan ?? undefined,
        email_verified: profile.email_verified ?? isVerified,
        user_type: "authenticated",
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profile]);

  const effectiveProfile = impersonationActive && workspaceProfile ? workspaceProfile : profile;
  const effectiveWorkspaceId =
    impersonationActive && workspaceProfile?.id ? workspaceProfile.id : userId;

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return { ok: false, error: "Not signed in" };

      const payload: any = { ...patch };
      const previousHandle = effectiveProfile?.handle ?? undefined;
      if (typeof payload.handle === "string") payload.handle = normalizeHandle(payload.handle);

      // Use backend API endpoint that enforces 60-day cooldown for handle changes
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

        const res = await fetch("/api/profile/update", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Update failed" }));
          return { ok: false, error: errorData.error || "Failed to update profile" };
        }

        await loadProfile(userId);
        if (impersonationActive) {
          setWorkspaceProfile((current) =>
            current
              ? {
                  ...current,
                  ...payload,
                }
              : current,
          );
        }

        // Cascade handle/full_name to workflows, prompts, comments; record old handle for redirects
        if (payload.handle !== undefined || payload.full_name !== undefined) {
          try {
            const body: { oldHandle?: string } = {};
            if (payload.handle !== undefined && previousHandle) body.oldHandle = previousHandle;
            const cascadeRes = await fetch("/api/profile/cascade-handle", {
              method: "POST",
              credentials: "include",
              headers,
              body: Object.keys(body).length ? JSON.stringify(body) : undefined,
            });
            if (!cascadeRes.ok) {
              console.warn("[Auth] cascade-handle failed", await cascadeRes.text());
            }
          } catch (e) {
            console.warn("[Auth] cascade-handle request failed", e);
          }
        }

        safeTrack("Profile Updated", {
          surface: "auth_context",
          keys: Object.keys(patch),
        });

        return { ok: true };
      } catch (e: any) {
        console.error("[Auth] Profile update failed:", e);
        return { ok: false, error: e.message || "Network error" };
      }
    },
    [effectiveProfile?.handle, impersonationActive, loadProfile, supabase, userId],
  );

  useEffect(() => {
    refresh();

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (TRACKED_AUTH_BRIDGE_EVENTS.has(event)) {
        safeTrack("Auth Lifecycle", {
          auth_event: event,
          has_session: Boolean(session),
        });
      }

      const previousUserId = lastUserIdRef.current;
      await applyUser(session?.user ?? null);
      setLoading(false);
      setAuthReady(true);

      const newUserId = session?.user?.id ?? null;
      lastUserIdRef.current = newUserId;

      // Only SIGNED_IN: skip INITIAL_SESSION so refresh + existing cookie does not spuriously redirect
      if (event === "SIGNED_IN" && !previousUserId && newUserId && typeof window !== "undefined") {
        const isOnCallback = window.location.pathname.startsWith("/auth/callback");

        if (!isOnCallback) {
          justSignedInRef.current = true;

          setTimeout(() => {
            try {
              const returnPath = getReturnPath();

              console.warn(
                "[Auth State Change] Email sign-in detected, checking return path:",
                returnPath,
              );

              if (returnPath) {
                const cleaned = cleanPath(returnPath);

                if (cleaned && pathnameRef.current !== cleaned) {
                  console.warn("[Auth State Change] Redirecting to:", cleaned);
                  clearReturnPath();
                  routerRef.current.push(cleaned);
                } else {
                  console.warn(
                    "[Auth State Change] Invalid path or already on target, clearing storage",
                  );
                  clearReturnPath();
                }
              } else {
                console.warn("[Auth State Change] No return path found, staying on current page");
              }

              justSignedInRef.current = false;
            } catch (err) {
              console.error("[Auth State Change] Redirect error:", err);
              clearReturnPath();
              justSignedInRef.current = false;
            }
          }, 300);
        } else {
          console.warn(
            "[Auth State Change] On callback page, letting callback handler manage redirect",
          );
        }
      }
    });

    return () => {
      data.subscription.unsubscribe();
      // Reset inflight ref so a remount (React Strict Mode double-invoke in dev) starts a fresh refresh.
      // Without this, the remounted instance sees inflightRef still set, skips refresh(), and
      // setLoading/setAuthReady are never called on the live instance → permanent black screen.
      inflightRef.current = null;
    };
  }, [applyUser, refresh, supabase]);

  const requireAuth = (opts?: OpenSignInOptions) => {
    if (userId) return true;
    // openSignIn already saves the current path, so just call it
    openSignIn(opts);
    return false;
  };

  const requireVerifiedEmail = () => {
    if (!requireAuth()) return false;
    if (isVerified) return true;
    return false;
  };

  const signOut = async () => {
    safeTrack("Logout Started", { surface: "auth_context" });
    await supabase.auth.signOut();
    applyNoUser();
  };

  const signInWithGoogle = async (redirectPath?: string) => {
    // Get the path we want to redirect to after OAuth
    let returnPath: string | null = null;

    if (redirectPath) {
      // Explicit path provided
      returnPath = cleanPath(redirectPath);
    } else {
      // Use saved path from when modal was opened
      returnPath = getReturnPath();
    }

    // CRITICAL: Always use current origin (window.location.origin)
    // This ensures localhost uses localhost, production uses production
    const currentOrigin = window.location.origin;
    const callbackUrl = `${currentOrigin}/auth/callback`;

    // Build redirectTo URL for Supabase (must be full URL)
    // CRITICAL: Always pass returnPath as query param, even if it's null
    // This ensures the callback handler can always find it, even if localStorage is cleared
    const redirectTo = returnPath
      ? `${callbackUrl}?next=${encodeURIComponent(returnPath)}`
      : callbackUrl;

    console.warn("[signInWithGoogle] Prepared redirect:", {
      returnPath,
      callbackUrl,
      redirectTo,
      currentOrigin,
    });

    // CRITICAL DEBUG: Log what we're sending to Supabase
    console.warn("[OAuth] Starting Google sign-in with:", {
      currentOrigin,
      callbackUrl,
      redirectTo,
      returnPath,
      windowLocation: window.location.href,
    });

    // Validate that we're using the correct origin
    if (currentOrigin.includes("localhost") && redirectTo.includes("edgaze.ai")) {
      console.error("[OAuth] ERROR: redirectTo contains edgaze.ai but we're on localhost!", {
        currentOrigin,
        redirectTo,
      });
      throw new Error(
        "Redirect URL mismatch: localhost detected but redirectTo contains production domain",
      );
    }

    safeTrack("OAuth Started", {
      provider: "google",
      surface: "auth_context",
      returnPath: returnPath || "none",
      redirectTo,
      currentOrigin,
    });

    const { error, data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
        // Skip browser redirect - we'll handle it manually if needed
        skipBrowserRedirect: false,
      },
    });

    // Log the response
    if (data?.url) {
      console.warn("[OAuth] Supabase returned URL:", data.url);
      // Check if Supabase is trying to redirect to wrong domain
      if (currentOrigin.includes("localhost") && data.url.includes("edgaze.ai")) {
        console.error("[OAuth] ERROR: Supabase is redirecting to production!", {
          currentOrigin,
          supabaseUrl: data.url,
        });
      }
    }

    if (error) {
      safeTrack("OAuth Failed", {
        provider: "google",
        surface: "auth_context",
        message: error.message,
      });
      throw error;
    }
  };

  const resetPasswordForEmail = async (email: string) => {
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
    // Land directly on the reset page with ?code=… — Supabase often drops extra query params on /auth/callback,
    // which used to lose flow=recovery and send users to the marketplace default.
    const redirectTo = `${currentOrigin}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      safeTrack("Password Reset Failed", {
        surface: "auth_context",
        message: error.message,
      });
      throw error;
    }

    safeTrack("Password Reset Email Sent", {
      surface: "auth_context",
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    safeTrack("Sign In Started", {
      surface: "auth_context",
      method: "email",
      user_type: "anonymous", // Tracking as anonymous before login
    });

    // Path should already be saved when modal was opened
    // But ensure we have it saved (in case modal was opened differently)
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname + window.location.search + window.location.hash;
      if (currentPath && currentPath !== "/" && !currentPath.startsWith("/auth/")) {
        saveReturnPath(currentPath);
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      safeTrack("Login Failed", {
        surface: "auth_context",
        method: "email",
        message: error.message,
        user_type: "anonymous",
      });
      throw error;
    }

    // Redirect will be handled by auth state change listener
  };

  const signUpWithEmail = async ({
    email,
    password,
    fullName,
    handle,
  }: {
    email: string;
    password: string;
    fullName: string;
    handle: string;
  }) => {
    const normalizedHandle = normalizeHandle(handle);

    safeTrack("Sign Up Started", {
      surface: "auth_context",
      method: "email",
      user_type: "anonymous", // Tracking as anonymous before signup
    });

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirmed`,
        data: { full_name: fullName, handle: normalizedHandle },
      },
    });

    if (error) {
      safeTrack("Sign Up Failed", {
        surface: "auth_context",
        method: "email",
        message: error.message,
        user_type: "anonymous",
      });
      throw error;
    }

    safeTrack("Sign Up Submitted", {
      surface: "auth_context",
      method: "email",
      requiresVerification: true,
      user_type: "anonymous",
    });
  };

  const getAccessToken = useCallback(
    async (options?: { eagerRefresh?: boolean }): Promise<string | null> => {
      const eagerRefresh = options?.eagerRefresh !== false;
      try {
        // First try to get the current session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn("Error getting session in getAccessToken:", error);
          return null;
        }

        if (!session?.access_token) {
          return null;
        }

        // Check if token is expired or about to expire (within 60 seconds)
        // expires_at is in seconds since epoch
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const now = Math.floor(Date.now() / 1000);
          const expiresIn = expiresAt - now;

          // If token expires within 60 seconds, refresh it
          if (expiresIn < 60) {
            if (!eagerRefresh) {
              // Hot paths like starting a live run should use the current token immediately and
              // refresh in the background so the request is not blocked on auth churn.
              void supabase.auth
                .refreshSession()
                .then(async ({ data: refreshData, error: refreshError }) => {
                  if (refreshError) return;
                  if (refreshData?.session?.user) {
                    await applyUser(refreshData.session.user);
                  }
                })
                .catch(() => {});
              return session.access_token;
            }
            // Token is expired or about to expire, try to refresh
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              // Invalid/missing refresh token (e.g. session revoked, storage cleared)
              // Clear the bad session and treat as signed out
              const isRefreshTokenError =
                refreshError.message?.includes("Refresh Token") ||
                refreshError.message?.includes("refresh_token") ||
                refreshError.message?.includes("refresh token");
              if (isRefreshTokenError) {
                await supabase.auth.signOut();
                applyNoUser();
                return null;
              }
              // Other refresh errors: return existing token (may still work for short grace period)
              console.warn("Error refreshing session:", refreshError);
              return session.access_token;
            }
            return refreshData?.session?.access_token ?? session.access_token;
          }
        }

        // Token is still valid
        return session.access_token;
      } catch (error) {
        console.error("Unexpected error in getAccessToken:", error);
        return null;
      }
    },
    [supabase, applyNoUser, applyUser],
  );

  const refreshImpersonation = useCallback(async () => {
    if (!userId || !isAdmin) {
      clearImpersonation();
      return;
    }

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/impersonation/current", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        clearImpersonation();
        return;
      }

      const data = await res.json();
      if (!data?.active || !data?.profile) {
        clearImpersonation();
        return;
      }

      setImpersonationActive(true);
      setWorkspaceProfile(data.profile as Profile);
    } catch {
      clearImpersonation();
    }
  }, [clearImpersonation, getAccessToken, isAdmin, userId]);

  const refreshProfile = useCallback(async () => {
    const tasks: Promise<unknown>[] = [];
    if (userId) tasks.push(loadProfile(userId));
    if (isAdmin) tasks.push(refreshImpersonation());
    if (tasks.length === 0) return;
    await Promise.all(tasks);
  }, [isAdmin, loadProfile, refreshImpersonation, userId]);

  useEffect(() => {
    if (!authReady) return;
    if (!userId || !isAdmin) {
      clearImpersonation();
      return;
    }
    void refreshImpersonation();
  }, [authReady, clearImpersonation, isAdmin, refreshImpersonation, userId]);

  const refreshAuthSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        applyNoUser();
      } else if (data?.session?.user) {
        await applyUser(data.session.user);
      }
    } catch {
      applyNoUser();
    }
  }, [supabase, applyNoUser, applyUser]);

  const user: AuthUser | null = userId
    ? {
        id: effectiveWorkspaceId ?? userId,
        email: effectiveProfile?.email ?? userEmail,
        name:
          effectiveProfile?.full_name ||
          effectiveProfile?.handle ||
          authSessionMeta?.full_name ||
          authSessionMeta?.handle ||
          (userEmail?.split("@")[0] ?? "") ||
          "Creator",
        handle:
          effectiveProfile?.handle ||
          authSessionMeta?.handle ||
          (userEmail
            ? userEmail
                .split("@")[0]!
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_")
                .replace(/_{2,}/g, "_")
                .slice(0, 24) || "user"
            : "user"),
      }
    : null;

  const value: AuthContextValue = {
    user,

    userId,
    userEmail,
    isVerified,
    profile: effectiveProfile,
    workspaceUserId: effectiveWorkspaceId,
    workspaceProfile: effectiveProfile,
    impersonationActive,

    isAdmin,
    isBanned,
    banReason,
    banExpiresAt,

    loading,
    authReady,

    openSignIn,
    closeSignIn,

    requireAuth,
    requireVerifiedEmail,

    refresh,
    refreshProfile,
    refreshImpersonation,
    updateProfile,

    signOut,
    signInWithGoogle,
    signInWithEmail,
    resetPasswordForEmail,
    signUpWithEmail,

    getAccessToken,
    refreshAuthSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SignInModal open={modalOpen} onClose={closeSignIn} />
    </AuthContext.Provider>
  );
}
