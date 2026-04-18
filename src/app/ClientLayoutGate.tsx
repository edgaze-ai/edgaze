"use client";

import LayoutGate from "./LayoutGate";

export default function ClientLayoutGate({ children }: { children: React.ReactNode }) {
  return <LayoutGate>{children}</LayoutGate>;
}
