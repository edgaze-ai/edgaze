import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt Studio",
  description:
    "Create, test, and publish AI prompts with dynamic placeholders. Turn prompts into reusable products on Edgaze.",
  openGraph: {
    title: "Prompt Studio | Edgaze",
    description:
      "Create, test, and publish AI prompts with dynamic placeholders. Turn prompts into reusable products on Edgaze.",
    url: "https://edgaze.ai/prompt-studio",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Studio | Edgaze",
    description:
      "Create, test, and publish AI prompts with dynamic placeholders. Turn prompts into reusable products on Edgaze.",
    images: ["/og.png"],
  },
};

export default function PromptStudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
