"use client";

import { usePathname } from "next/navigation";
import AppShell from "./AppShell";
import VerifyEmailBanner from "../components/auth/VerifyEmailBanner";
import MaintenanceGate from "../components/maintenance/MaintenanceGate";

export default function LayoutGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const isDocsRoute = pathname === "/docs" || pathname.startsWith("/docs/");

  if (isDocsRoute) {
    // Docs should not inherit the app sidebar shell or auth banners.
    return <>{children}</>;
  }

  return (
    <MaintenanceGate>
      {/* Shows only for logged-in + unverified users */}
      <VerifyEmailBanner />
      <AppShell>{children}</AppShell>
    </MaintenanceGate>
  );
}
