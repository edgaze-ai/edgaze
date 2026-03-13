import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Press",
  description: "Media inquiries and press resources for Edgaze. Contact Arjun Kuttikkat, Founder & CEO.",
};

export default function PressLayout({ children }: { children: React.ReactNode }) {
  return children;
}
