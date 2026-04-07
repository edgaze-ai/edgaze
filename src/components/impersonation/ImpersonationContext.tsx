"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";

export type ImpersonationState =
  | {
      active: true;
      sessionId: string;
      targetProfileId: string;
      startedAt: string;
      expiresAt: string;
      returnToAdminPath: string;
      handle: string;
      fullName: string | null;
      avatarUrl: string | null;
    }
  | { active: false };

type ImpersonationContextValue = {
  state: ImpersonationState;
  refresh: () => Promise<void>;
  endImpersonation: () => Promise<void>;
};

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { authReady, isAdmin, getAccessToken } = useAuth();
  const [state, setState] = useState<ImpersonationState>({ active: false });

  const refresh = useCallback(async () => {
    if (!authReady || !isAdmin) {
      setState({ active: false });
      return;
    }
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/impersonation/current", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setState({ active: false });
        return;
      }
      const data = await res.json();
      if (!data?.active || !data.profile) {
        setState({ active: false });
        return;
      }
      const p = data.profile;
      setState({
        active: true,
        sessionId: data.sessionId,
        targetProfileId: data.targetProfileId,
        startedAt: data.startedAt,
        expiresAt: data.expiresAt,
        returnToAdminPath: data.returnToAdminPath ?? "/admin/creators",
        handle: p.handle,
        fullName: p.full_name ?? null,
        avatarUrl: p.avatar_url ?? null,
      });
    } catch {
      setState({ active: false });
    }
  }, [authReady, isAdmin, getAccessToken]);

  useEffect(() => {
    if (!authReady) return;
    queueMicrotask(() => {
      void refresh();
    });
  }, [authReady, refresh]);

  const endImpersonation = useCallback(async () => {
    const token = await getAccessToken();
    const returnPath = state.active === true ? state.returnToAdminPath : "/admin/creators";
    await fetch("/api/admin/impersonation/end", {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setState({ active: false });
    if (typeof window !== "undefined") {
      window.location.href = returnPath;
    }
  }, [getAccessToken, state]);

  const value = useMemo(
    () => ({ state, refresh, endImpersonation }),
    [state, refresh, endImpersonation],
  );

  return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}

export function useImpersonation(): ImpersonationContextValue {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) {
    return {
      state: { active: false },
      refresh: async () => {},
      endImpersonation: async () => {},
    };
  }
  return ctx;
}
