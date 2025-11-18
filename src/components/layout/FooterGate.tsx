"use client";

import { usePathname } from "next/navigation";

export default function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide footer on /builder and any nested routes like /builder/...
  if (pathname.startsWith("/builder")) return null;

  return <>{children}</>;
}
