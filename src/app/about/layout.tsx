import type { Metadata } from "next";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About Edgaze | AI Workflow Platform for Creators",
  description:
    "Learn what Edgaze is building: a platform where creators build, publish, and monetize AI workflows people can run instantly.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
