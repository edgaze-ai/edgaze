"use client";

import { ConnectAccountManagement } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function AccountManagementPage() {
  return (
    <ConnectDashboardShell
      title="Account management"
      description="View and edit payment information like SSN and payout bank account"
    >
      <ConnectAccountManagement />
    </ConnectDashboardShell>
  );
}
