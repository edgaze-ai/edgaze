// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "../styles/globals.css";

import { AppProviders } from "./providers";
import LayoutGate from "./LayoutGate";
import LazyAnalyticsWrapper from "../components/layout/LazyAnalytics";

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
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/icons/icon-48x48.png", type: "image/png", sizes: "48x48" },
      { url: "/brand/icons/icon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const siteNavigationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://edgaze.ai/#organization",
      "name": "Edgaze",
      "url": "https://edgaze.ai",
      "logo": {
        "@type": "ImageObject",
        "url": "https://edgaze.ai/brand/edgaze-mark.png"
      },
      "sameAs": []
    },
    {
      "@type": "WebSite",
      "@id": "https://edgaze.ai/#website",
      "url": "https://edgaze.ai",
      "name": "Edgaze",
      "description": "Create, sell, and distribute AI products.",
      "publisher": {
        "@id": "https://edgaze.ai/#organization"
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://edgaze.ai/marketplace?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-full bg-[#0b0b0b] text-white antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavigationJsonLd) }}
        />
        <AppProviders>
          <Suspense fallback={null}>
            <LazyAnalyticsWrapper />
          </Suspense>
          <LayoutGate>{children}</LayoutGate>
        </AppProviders>
      </body>
    </html>
  );
}
