import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export const metadata: Metadata = {
  title: "Prompt Studio",
  description:
    "Create, test, and publish AI prompts with dynamic placeholders. Turn prompts into reusable products on Edgaze.",
  openGraph: {
    title: "Prompt Studio",
    description:
      "Create, test, and publish AI prompts with dynamic placeholders. Turn prompts into reusable products on Edgaze.",
    url: "https://edgaze.ai/prompt-studio",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Studio",
    description:
      "Create, test, and publish AI prompts with dynamic placeholders. Turn prompts into reusable products on Edgaze.",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default function PromptStudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
