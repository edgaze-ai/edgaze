import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export const metadata: Metadata = {
  title: "Beta",
  description: "Join the Edgaze beta.",
  openGraph: {
    title: "Beta",
    description: "Join the Edgaze beta.",
    url: "https://edgaze.ai/apply",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Beta",
    description: "Join the Edgaze beta.",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
