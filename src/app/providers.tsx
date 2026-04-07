"use client";

import React from "react";
import SidebarProvider from "../components/layout/SidebarContext";
import { AuthProvider } from "../components/auth/AuthContext";
import { ImpersonationProvider } from "../components/impersonation/ImpersonationContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AuthProvider>
        <ImpersonationProvider>{children}</ImpersonationProvider>
      </AuthProvider>
    </SidebarProvider>
  );
}
