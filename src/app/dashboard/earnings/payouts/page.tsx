"use client";

import { ConnectPayouts } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function PayoutsPage() {
  return (
    <ConnectDashboardShell title="Payouts" description="History of your payouts">
      <ConnectPayouts />
    </ConnectDashboardShell>
  );
}
