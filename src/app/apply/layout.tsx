import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply",
  description:
    "Join the Edgaze marketplace. Create and sell AI prompts and workflows. One link to share, one tap to run.",
  openGraph: {
    title: "Apply | Edgaze",
    description:
      "Join the Edgaze marketplace. Create and sell AI prompts and workflows. One link to share, one tap to run.",
    url: "https://edgaze.ai/apply",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apply | Edgaze",
    description:
      "Join the Edgaze marketplace. Create and sell AI prompts and workflows. One link to share, one tap to run.",
    images: ["/og.png"],
  },
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
