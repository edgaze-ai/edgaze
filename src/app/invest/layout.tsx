import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invest",
  description:
    "Edgaze is the distribution layer for AI workflows: a marketplace and execution layer where AI workflows become products.",
  openGraph: {
    title: "Invest | Edgaze",
    description:
      "Edgaze is the distribution layer for AI workflows: a marketplace and execution layer where AI workflows become products.",
    url: "https://edgaze.ai/invest",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Invest | Edgaze",
    description:
      "Edgaze is the distribution layer for AI workflows: a marketplace and execution layer where AI workflows become products.",
    images: ["/og.png"],
  },
};

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        href="https://assets.calendly.com/assets/external/widget.css"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
