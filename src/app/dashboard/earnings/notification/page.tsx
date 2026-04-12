"use client";

import { ConnectNotificationBanner } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function NotificationBannerPage() {
  return (
    <ConnectDashboardShell
      title="Notification banner"
      description="Outstanding risk and compliance requirements"
    >
      <ConnectNotificationBanner />
    </ConnectDashboardShell>
  );
}
