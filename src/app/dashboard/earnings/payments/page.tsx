"use client";

import Link from "next/link";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

/**
 * Creators use transfers-only Express accounts — they do not accept buyer cards on the connected
 * account, so Stripe's Connect "Payments" UI is not enabled. Sales are processed on Edgaze
 * checkout; earnings appear under Balances / Payouts.
 */
export default function PaymentsPage() {
  return (
    <ConnectDashboardShell
      title="Sales & checkout"
      description="How buyer payments relate to your Stripe account"
    >
      <div className="min-h-[280px] text-sm text-white/[0.62] leading-relaxed space-y-4 max-w-prose">
        <p>
          Edgaze collects payment from buyers at checkout on the platform. Your creator share is
          transferred to your connected account and is visible under{" "}
          <Link href="/dashboard/earnings" className="text-cyan-400 hover:underline">
            Balances
          </Link>{" "}
          and{" "}
          <Link href="/dashboard/earnings/payouts" className="text-cyan-400 hover:underline">
            Payouts
          </Link>
          .
        </p>
        <p className="text-white/45 text-xs">
          The Stripe Connect &quot;Payments&quot; component is for accounts that process card
          charges directly; marketplace payout recipients use transfers only.
        </p>
      </div>
    </ConnectDashboardShell>
  );
}
