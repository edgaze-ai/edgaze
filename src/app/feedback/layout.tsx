import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export const metadata: Metadata = {
  title: "Feedback",
  description:
    "Share feedback on Edgaze. Help us improve the AI prompts and workflows marketplace.",
  openGraph: {
    title: "Feedback | Edgaze",
    description:
      "Share feedback on Edgaze. Help us improve the AI prompts and workflows marketplace.",
    url: "https://edgaze.ai/feedback",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Feedback | Edgaze",
    description:
      "Share feedback on Edgaze. Help us improve the AI prompts and workflows marketplace.",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
