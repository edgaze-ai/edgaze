import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Edgaze is a platform where creators build, publish, and distribute AI workflows and prompts. Infrastructure for the AI creator economy.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
