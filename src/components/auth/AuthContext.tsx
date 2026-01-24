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
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import SignInModal from "./SignInModal";
import { identifyUser, resetIdentity, track } from "../../lib/mixpanel";

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
  plan: UserPlan;
  email_verified?: boolean | null;
};

export type AuthUser = {
  id: string;
  email: string | null;
  name: string;
  handle: string;
};

type AuthContextValue = {
  user: AuthUser | null;

  userId: string | null;
  userEmail: string | null;
  isVerified: boolean;
  profile: Profile | null;

  isAdmin: boolean;
  isBanned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;

  loading: boolean;
  authReady: boolean;

  openSignIn: () => void;
  closeSignIn: () => void;

  requireAuth: () => boolean;
  requireVerifiedEmail: () => boolean;

  refresh: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  updateProfile: (
    patch: Partial<Profile>
  ) => Promise<{ ok: boolean; error?: string }>;

  signOut: () => Promise<void>;

  signInWithGoogle: (redirectPath?: string) => Promise<void>;

  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (args: {
    email: string;
    password: string;
    fullName: string;
    handle: string;
  }) => Promise<void>;

  // Get access token for API calls
  getAccessToken: () => Promise<string | null>;
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

function safeReturnTo(path: string) {
  if (!path || typeof path !== "string") return "/marketplace";
  if (!path.startsWith("/")) return "/marketplace";
  if (path.startsWith("//")) return "/marketplace";
  if (path.includes("http://") || path.includes("https://")) return "/marketplace";
  return path;
}

function saveReturnTo(path: string) {
  try {
    localStorage.setItem("edgaze:returnTo", safeReturnTo(path));
  } catch {}
}

function isStillBannedRow(
  row: { is_banned?: boolean; ban_expires_at?: string | null } | null
) {
  if (!row?.is_banned) return false;
  const expires = row.ban_expires_at ?? null;
  if (!expires) return true;
  const t = new Date(expires).getTime();
  if (Number.isNaN(t)) return true;
  return t > Date.now();
}

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

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

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

  const openSignIn = useCallback(() => {
    if (modalOpenRef.current) return;
    modalOpenRef.current = true;
    setModalOpen(true);
    safeTrack("Sign In Modal Opened", { surface: "auth_context" });
  }, []);

  const closeSignIn = useCallback(() => {
    modalOpenRef.current = false;
    setModalOpen(false);
    safeTrack("Sign In Modal Closed", { surface: "auth_context" });
  }, []);

  const applyNoUser = useCallback(() => {
    setUserId(null);
    setUserEmail(null);
    setIsVerified(false);
    setProfile(null);

    setIsAdmin(false);
    setIsBanned(false);
    setBanReason(null);
    setBanExpiresAt(null);

    lastIdentifiedRef.current = null;

    // Critical: clears Mixpanel distinct_id to avoid cross-account contamination
    safeResetIdentity();

    safeTrack("Logout", { surface: "auth_context" });
  }, []);

  const loadProfile = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,email,full_name,handle,avatar_url,banner_url,bio,socials,plan,email_verified"
        )
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        setProfile(null);
        return;
      }
      setProfile((data as Profile) ?? null);
    },
    [supabase]
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
    [supabase]
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
    [supabase]
  );

  const applyUser = useCallback(
    async (user: any | null) => {
      if (!user) {
        applyNoUser();
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);
      setIsVerified(Boolean(user.email_confirmed_at));

      // Identify once per user id per session.
      // IMPORTANT: identifyUser() should alias anonymous -> user internally (in mixpanel.ts)
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
        });
      }

      loadProfile(user.id).catch(() => setProfile(null));
      loadAdmin(user.id).catch(() => setIsAdmin(false));

      loadModeration(user.id)
        .then((stillBanned) => {
          if (stillBanned) {
            safeTrack("User Banned Redirect", { surface: "auth_context" });
            if (
              typeof window !== "undefined" &&
              window.location.pathname !== "/banned"
            ) {
              window.location.href = "/banned";
            }
          }
        })
        .catch(() => {
          setIsBanned(false);
          setBanReason(null);
          setBanExpiresAt(null);
        });
    },
    [applyNoUser, loadAdmin, loadModeration, loadProfile]
  );

  const refresh = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current;

    inflightRef.current = (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          applyNoUser();
        } else {
          await applyUser(data.session?.user ?? null);
        }
      } finally {
        setLoading(false);
        setAuthReady(true);
        inflightRef.current = null;
      }
    })();

    return inflightRef.current;
  }, [applyNoUser, applyUser, supabase]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    await loadProfile(userId);
  }, [loadProfile, userId]);

  // Update People properties once profile is available (no aliasing here)
  useEffect(() => {
    if (!userId) return;
    if (!profile) return;

    safeIdentify(userId, {
      email: profile.email ?? userEmail ?? undefined,
      name: profile.full_name ?? undefined,
      handle: profile.handle ?? undefined,
      plan: profile.plan ?? undefined,
      email_verified: profile.email_verified ?? isVerified,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profile]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return { ok: false, error: "Not signed in" };

      const payload: any = { ...patch };
      if (typeof payload.handle === "string")
        payload.handle = normalizeHandle(payload.handle);

      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (error) return { ok: false, error: error.message };

      await loadProfile(userId);

      safeTrack("Profile Updated", {
        surface: "auth_context",
        keys: Object.keys(patch),
      });

      return { ok: true };
    },
    [loadProfile, supabase, userId]
  );

  useEffect(() => {
    refresh();

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      safeTrack("Auth State Changed", { event, hasSession: Boolean(session) });

      await applyUser(session?.user ?? null);
      setLoading(false);
      setAuthReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, [applyUser, refresh, supabase]);

  const requireAuth = () => {
    if (userId) return true;
    // Save current path before opening sign-in modal so we can redirect back after auth
    if (typeof window !== "undefined") {
      const returnTo =
        (window.location.pathname + window.location.search + window.location.hash) ||
        "/marketplace";
      saveReturnTo(returnTo);
    }
    openSignIn();
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
    // Don't overwrite returnTo if it's already set (e.g., from requireAuth with action=purchase)
    // Only save if there's no existing returnTo
    try {
      const existing = localStorage.getItem("edgaze:returnTo");
      if (!existing || existing === "/marketplace") {
        const returnTo =
          (window.location.pathname + window.location.search + window.location.hash) ||
          "/marketplace";
        saveReturnTo(returnTo);
      }
    } catch {
      // Fallback: save current path if localStorage access fails
      const returnTo =
        (window.location.pathname + window.location.search + window.location.hash) ||
        "/marketplace";
      saveReturnTo(returnTo);
    }

    const redirectTo = redirectPath
      ? `${window.location.origin}${safeReturnTo(redirectPath)}`
      : `${window.location.origin}/auth/callback`;

    safeTrack("OAuth Started", {
      provider: "google",
      surface: "auth_context",
      redirectTo: safeReturnTo(redirectPath || "/auth/callback"),
    });

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      safeTrack("OAuth Failed", {
        provider: "google",
        surface: "auth_context",
        message: error.message,
      });
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    safeTrack("Sign In Started", { surface: "auth_context", method: "email" });

    // Don't overwrite returnTo if it's already set (e.g., from requireAuth with action=purchase)
    // Only save if there's no existing returnTo
    if (typeof window !== "undefined") {
      try {
        const existing = localStorage.getItem("edgaze:returnTo");
        if (!existing || existing === "/marketplace") {
          const returnTo =
            (window.location.pathname + window.location.search + window.location.hash) ||
            "/marketplace";
          saveReturnTo(returnTo);
        }
      } catch {
        // Fallback: save current path if localStorage access fails
        const returnTo =
          (window.location.pathname + window.location.search + window.location.hash) ||
          "/marketplace";
        saveReturnTo(returnTo);
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      safeTrack("Login Failed", {
        surface: "auth_context",
        method: "email",
        message: error.message,
      });
      throw error;
    }

    // After successful sign-in, redirect to saved path
    // The auth state change listener will handle the redirect via useEffect
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

    safeTrack("Sign Up Started", { surface: "auth_context", method: "email" });

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
      });
      throw error;
    }

    safeTrack("Sign Up Submitted", {
      surface: "auth_context",
      method: "email",
      requiresVerification: true,
    });
  };

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      // First try to get the current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
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
          // Token is expired or about to expire, try to refresh
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn("Error refreshing session:", refreshError);
            // If refresh fails but we have a token, return it anyway (might still work)
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
  }, [supabase]);

  const user: AuthUser | null =
    userId && profile
      ? {
          id: userId,
          email: userEmail,
          name: profile.full_name || profile.handle || "Creator",
          handle: profile.handle,
        }
      : null;

  const value: AuthContextValue = {
    user,

    userId,
    userEmail,
    isVerified,
    profile,

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
    updateProfile,

    signOut,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,

    getAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SignInModal open={modalOpen} onClose={closeSignIn} />
    </AuthContext.Provider>
  );
}
