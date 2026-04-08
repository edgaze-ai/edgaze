import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export const metadata: Metadata = {
  title: "Invest",
  description:
    "Edgaze is the distribution layer for AI workflows: a marketplace and execution layer where AI workflows become products.",
  openGraph: {
    title: "Invest | Edgaze",
    description:
      "Edgaze is the distribution layer for AI workflows: a marketplace and execution layer where AI workflows become products.",
    url: "https://edgaze.ai/invest",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Invest | Edgaze",
    description:
      "Edgaze is the distribution layer for AI workflows: a marketplace and execution layer where AI workflows become products.",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet" />
      {children}
    </>
  );
}
