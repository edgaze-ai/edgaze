"use client";

import { ConnectPayouts } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function PayoutsPage() {
  return (
    <ConnectDashboardShell title="Payouts" description="History of your payouts">
      <div className="p-4 sm:p-6 min-h-[400px]">
        <ConnectPayouts />
      </div>
    </ConnectDashboardShell>
  );
}
