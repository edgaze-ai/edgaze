'use client';

import { ConnectPayments } from '@stripe/react-connect-js';
import { ConnectDashboardShell } from '../components/ConnectDashboardShell';

export default function PaymentsPage() {
  return (
    <ConnectDashboardShell
      title="Payments"
      description="View payments, resolve disputes, and issue refunds"
    >
      <div className="p-4 sm:p-6 min-h-[400px]">
        <ConnectPayments />
      </div>
    </ConnectDashboardShell>
  );
}
