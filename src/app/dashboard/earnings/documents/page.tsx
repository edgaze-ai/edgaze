"use client";

import { ConnectDocuments } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function DocumentsPage() {
  return (
    <ConnectDashboardShell title="Documents" description="Tax and verification documents">
      <div className="p-4 sm:p-6 min-h-[400px]">
        <ConnectDocuments />
      </div>
    </ConnectDashboardShell>
  );
}
