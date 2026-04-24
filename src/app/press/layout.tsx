import type { Metadata } from "next";
import { buildMetadata } from "@lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Press",
  description: "Media inquiries and press resources for Edgaze. Contact press@edgaze.ai.",
  path: "/press",
});

export default function PressLayout({ children }: { children: React.ReactNode }) {
  return children;
}
