"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import SidebarProvider from "../components/layout/SidebarContext";
import { AuthProvider } from "../components/auth/AuthContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <AuthProvider>{children}</AuthProvider>
      </SidebarProvider>
    </SessionProvider>
  );
}
