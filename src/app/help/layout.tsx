import type { Metadata } from "next";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Help Center | Edgaze",
  description:
    "Get help with Edgaze, find support resources, browse documentation, and contact the team when you need help with creators, workflows, or marketplace activity.",
  path: "/help",
});

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
