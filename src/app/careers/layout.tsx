import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers",
  description: "Join Edgaze. We're building the infrastructure for the AI creator economy.",
};

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
