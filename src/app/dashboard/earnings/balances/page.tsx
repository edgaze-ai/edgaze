"use client";

import { ConnectBalances } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function BalancesPage() {
  return (
    <ConnectDashboardShell
      title="Balances"
      description="View payout schedule, pending payouts, and top up negative balances"
    >
      <div className="p-4 sm:p-6 min-h-[400px]">
        <ConnectBalances />
      </div>
    </ConnectDashboardShell>
  );
}
