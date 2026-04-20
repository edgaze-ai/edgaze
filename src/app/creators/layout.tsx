import type { Metadata } from "next";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Creator Program | Monetize AI Workflows on Edgaze",
  description:
    "Join the Edgaze Creator Program to build, publish, and monetize AI workflows with creator tools, payouts, marketplace distribution, and onboarding support.",
  path: "/creators",
});

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
