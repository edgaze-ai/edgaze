import type { Metadata } from "next";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Careers | Edgaze",
  description:
    "Explore career opportunities at Edgaze and learn how we are building the platform infrastructure behind creator-owned AI workflows.",
  path: "/careers",
});

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
