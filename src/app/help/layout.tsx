import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help",
  description:
    "Get help with Edgaze. Contact support, find answers, and get the most out of the AI prompts and workflows marketplace.",
  openGraph: {
    title: "Help | Edgaze",
    description:
      "Get help with Edgaze. Contact support, find answers, and get the most out of the AI prompts and workflows marketplace.",
    url: "https://edgaze.ai/help",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Help | Edgaze",
    description:
      "Get help with Edgaze. Contact support, find answers, and get the most out of the AI prompts and workflows marketplace.",
    images: ["/og.png"],
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
