import type { Metadata } from "next";
import { buildMetadata, NOINDEX_ROBOTS } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Your Library | Edgaze",
  description: "Manage your created and purchased workflows inside your Edgaze library.",
  path: "/library",
  robots: NOINDEX_ROBOTS,
});

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
