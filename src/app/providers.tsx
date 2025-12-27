"use client";

import React from "react";
import SidebarProvider from "../components/layout/SidebarContext";
import { AuthProvider } from "../components/auth/AuthContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AuthProvider>{children}</AuthProvider>
    </SidebarProvider>
  );
}
