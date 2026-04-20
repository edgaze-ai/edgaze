"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AppShell from "./AppShell";
import VerifyEmailBanner from "../components/auth/VerifyEmailBanner";
import MaintenanceGate from "../components/maintenance/MaintenanceGate";
import ImpersonationBanner from "../components/impersonation/ImpersonationBanner";

export default function LayoutGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const isDocsRoute = pathname === "/docs" || pathname.startsWith("/docs/");
  const isInviteRoute = pathname.startsWith("/c/");
  const isClaimRoute = pathname === "/claim" || pathname.startsWith("/claim/");
  const isCreatorOnboardingRoute =
    pathname === "/creators/onboarding" || pathname.startsWith("/creators/onboarding/");
  const isBlogsRoute = pathname === "/blogs" || pathname.startsWith("/blogs/");
  const isSignInToBuy = pathname.startsWith("/auth/sign-in-to-buy");
  const isPublicContextRoute = [
    "/what-is-edgaze",
    "/how-edgaze-works",
    "/for-creators",
    "/for-buyers",
    "/ai-workflow-marketplace",
    "/workflow-studio",
    "/why-workflows-not-prompts",
    "/run-ai-workflows",
    "/monetize-ai-workflows",
    "/about/mission",
  ].includes(pathname);
  const useMinimalLayout =
    isDocsRoute ||
    isInviteRoute ||
    isClaimRoute ||
    isCreatorOnboardingRoute ||
    isBlogsRoute ||
    isSignInToBuy ||
    isPublicContextRoute;

  // Minimal layout (no sidebar, no topbar): always for these routes so we never flash AppShell.
  if (useMinimalLayout) {
    return (
      <>
        <ImpersonationBanner />
        {children}
      </>
    );
  }

  // Defer pathname-dependent layout for other routes until mounted (avoid hydration mismatch).
  if (!mounted) {
    return (
      <MaintenanceGate>
        <ImpersonationBanner />
        <VerifyEmailBanner />
        <AppShell>{children}</AppShell>
      </MaintenanceGate>
    );
  }

  return (
    <MaintenanceGate>
      <ImpersonationBanner />
      <VerifyEmailBanner />
      <AppShell>{children}</AppShell>
    </MaintenanceGate>
  );
}
