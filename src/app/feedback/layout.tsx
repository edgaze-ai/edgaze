import type { Metadata } from "next";
import { buildMetadata, NOINDEX_ROBOTS } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Feedback | Edgaze",
  description: "Share product feedback with the Edgaze team.",
  path: "/feedback",
  robots: NOINDEX_ROBOTS,
});

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
