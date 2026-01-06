import type { Metadata } from "next";
import "../styles/globals.css";

import { AppProviders } from "./providers";
import LayoutGate from "./LayoutGate";

export const metadata: Metadata = {
  metadataBase: new URL("https://edgaze.ai"),

  title: {
    default: "Edgaze",
    template: "%s | Edgaze",
  },

  description: "Creators build with AI",

  applicationName: "Edgaze",
  referrer: "origin-when-cross-origin",

  openGraph: {
    type: "website",
    url: "https://edgaze.ai",
    siteName: "Edgaze",
    title: "Edgaze",
    description: "Creators build with AI",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Edgaze",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Edgaze",
    description: "Creators build with AI",
    images: ["/og.png"],
  },

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },

  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-full bg-[#0b0b0b] text-white antialiased">
        <AppProviders>
          <LayoutGate>{children}</LayoutGate>
        </AppProviders>
      </body>
    </html>
  );
}
