import type { Metadata } from "next";
import { buildMetadata, NOINDEX_ROBOTS } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Apply to Edgaze Beta",
  description: "Apply for Edgaze beta access.",
  path: "/apply",
  robots: NOINDEX_ROBOTS,
});

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
