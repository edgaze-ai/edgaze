"use client";

import { ConnectBalances } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function BalancesPage() {
  return (
    <ConnectDashboardShell
      title="Balances"
      description="View payout schedule, pending payouts, and top up negative balances"
    >
      <ConnectBalances />
    </ConnectDashboardShell>
  );
}
