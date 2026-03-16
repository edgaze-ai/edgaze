import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback",
  description:
    "Share feedback on Edgaze. Help us improve the AI prompts and workflows marketplace.",
  openGraph: {
    title: "Feedback | Edgaze",
    description:
      "Share feedback on Edgaze. Help us improve the AI prompts and workflows marketplace.",
    url: "https://edgaze.ai/feedback",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Feedback | Edgaze",
    description:
      "Share feedback on Edgaze. Help us improve the AI prompts and workflows marketplace.",
    images: ["/og.png"],
  },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
