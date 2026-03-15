import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Program",
  description:
    "Join the Edgaze Creator Program. Build AI workflows, publish them, and monetize. Turn your AI creations into real products with distribution and creator infrastructure built in.",
  openGraph: {
    title: "Creator Program | Edgaze",
    description:
      "Join the Edgaze Creator Program. Build AI workflows, publish them, and monetize. Distribution and creator infrastructure built in.",
    url: "https://edgaze.ai/creators",
  },
};

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
