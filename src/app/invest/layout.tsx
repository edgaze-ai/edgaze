import type { Metadata } from "next";
import { buildMetadata } from "@lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Invest",
  description:
    "Edgaze is the distribution layer for AI workflows: a marketplace and execution layer where AI workflows become products.",
  path: "/invest",
});

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet" />
      {children}
    </>
  );
}
