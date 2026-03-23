import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beta",
  description: "Join the Edgaze beta.",
  openGraph: {
    title: "Beta | Edgaze",
    description: "Join the Edgaze beta.",
    url: "https://edgaze.ai/apply",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Beta | Edgaze",
    description: "Join the Edgaze beta.",
    images: ["/og.png"],
  },
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
