"use client";

import dynamic from "next/dynamic";
import { MinimalLoadingFallback } from "../components/loading/GlobalLoadingScreen";

const LayoutGate = dynamic(() => import("./LayoutGate"), {
  ssr: false,
  loading: () => <MinimalLoadingFallback />,
});

export default function ClientLayoutGate({ children }: { children: React.ReactNode }) {
  return <LayoutGate>{children}</LayoutGate>;
}
