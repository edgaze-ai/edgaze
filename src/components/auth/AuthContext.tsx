"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
  useSession,
} from "next-auth/react";
import SignInModal, { OAuthProvider } from "./SignInModal";

export type UserPlan = "Free" | "Pro" | "Team";

export type User = {
  id: string;
  name: string;
  email: string;
  image?: string;
  plan: UserPlan;
};

type AuthContextValue = {
  user: User | null;
  openSignIn: () => void;
  closeSignIn: () => void;
  requireAuth: () => boolean;
  signOut: () => void;

  // real external sign-in
  debugSignInWithProvider: (provider: OAuthProvider) => void;
  debugSignInWithEmail: (email: string) => void;

  // profile picture override
  updateProfileImage: (dataUrl: string) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [modalOpen, setModalOpen] = useState(false);

  // local user state so we can override image etc
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setUser(null);
      return;
    }

    setUser((prev) => {
      const base: User = {
        id: (session.user as any).id ?? "unknown",
        name: session.user.name ?? "Edgaze user",
        email: session.user.email ?? "",
        image:
          prev?.image ??
          session.user.image ??
          "/brand/edgaze-mark.png",
        plan: ((session.user as any).plan as UserPlan) ?? "Free",
      };
      return base;
    });
  }, [session]);

  // close modal automatically on successful sign-in
  useEffect(() => {
    if (session?.user && modalOpen) {
      setModalOpen(false);
    }
  }, [session, modalOpen]);

  const openSignIn = useCallback(() => setModalOpen(true), []);
  const closeSignIn = useCallback(() => setModalOpen(false), []);

  const signOut = useCallback(() => {
    setUser(null);
    nextAuthSignOut({ callbackUrl: "/" });
  }, []);

  const requireAuth = useCallback(() => {
    if (!user) {
      setModalOpen(true);
      return false;
    }
    return true;
  }, [user]);

  const debugSignInWithProvider = useCallback((provider: OAuthProvider) => {
    // now REAL OAuth, not fake
    nextAuthSignIn(provider);
  }, []);

  const debugSignInWithEmail = useCallback((email: string) => {
    // requires Email provider in authOptions if you want this
    nextAuthSignIn("email", { email });
  }, []);

  const updateProfileImage = useCallback((dataUrl: string) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            image: dataUrl,
          }
        : prev
    );
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      openSignIn,
      closeSignIn,
      requireAuth,
      signOut,
      debugSignInWithProvider,
      debugSignInWithEmail,
      updateProfileImage,
    }),
    [
      user,
      openSignIn,
      closeSignIn,
      requireAuth,
      signOut,
      debugSignInWithProvider,
      debugSignInWithEmail,
      updateProfileImage,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SignInModal
        open={modalOpen}
        onClose={closeSignIn}
        onProvider={debugSignInWithProvider}
        onEmailLogin={debugSignInWithEmail}
      />
    </AuthContext.Provider>
  );
}
