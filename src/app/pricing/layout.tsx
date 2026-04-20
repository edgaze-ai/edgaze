import type { Metadata } from "next";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Pricing | Edgaze",
  description:
    "Review Edgaze pricing for creators building, publishing, and monetizing AI workflows. Compare plans, hosted run limits, and marketplace fee details.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
