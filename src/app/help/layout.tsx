import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export const metadata: Metadata = {
  title: "Help",
  description:
    "Get help with Edgaze. Contact support, find answers, and get the most out of the AI prompts and workflows marketplace.",
  openGraph: {
    title: "Help | Edgaze",
    description:
      "Get help with Edgaze. Contact support, find answers, and get the most out of the AI prompts and workflows marketplace.",
    url: "https://edgaze.ai/help",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Help | Edgaze",
    description:
      "Get help with Edgaze. Contact support, find answers, and get the most out of the AI prompts and workflows marketplace.",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
