import type { Metadata } from "next";
import { buildMetadata, NOINDEX_ROBOTS } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Bug Reports | Edgaze",
  description: "Report product bugs to the Edgaze team.",
  path: "/bugs",
  robots: NOINDEX_ROBOTS,
});

export default function BugsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
