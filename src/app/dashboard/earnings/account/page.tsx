"use client";

import { ConnectAccountManagement } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function AccountManagementPage() {
  return (
    <ConnectDashboardShell
      title="Account management"
      description="View and edit payment information like SSN and payout bank account"
    >
      <div className="p-4 sm:p-6 min-h-[400px]">
        <ConnectAccountManagement />
      </div>
    </ConnectDashboardShell>
  );
}
