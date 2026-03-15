"use client";

import { ConnectNotificationBanner } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function NotificationBannerPage() {
  return (
    <ConnectDashboardShell
      title="Notification banner"
      description="Outstanding risk and compliance requirements"
    >
      <div className="p-4 sm:p-6 min-h-[200px]">
        <ConnectNotificationBanner />
      </div>
    </ConnectDashboardShell>
  );
}
