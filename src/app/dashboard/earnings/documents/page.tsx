"use client";

import { ConnectDocuments } from "@stripe/react-connect-js";
import { ConnectDashboardShell } from "../components/ConnectDashboardShell";

export default function DocumentsPage() {
  return (
    <ConnectDashboardShell title="Documents" description="Tax and verification documents">
      <ConnectDocuments />
    </ConnectDashboardShell>
  );
}
