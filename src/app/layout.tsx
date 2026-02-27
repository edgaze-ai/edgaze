// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "../styles/globals.css";

import { AppProviders } from "./providers";
import LayoutGate from "./LayoutGate";
import LazyAnalyticsWrapper from "../components/layout/LazyAnalytics";
import GlobalLoadingScreen from "../components/loading/GlobalLoadingScreen";
import { WebVitals } from "./web-vitals";

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
  themeColor: "#07080b",
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
      <head>
        {/* DNS prefetch for external services */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        
        {/* Preconnect to critical origins with crossorigin for CORS */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL || ""} crossOrigin="anonymous" />
        
        {/* Preload critical assets for faster initial render */}
        <link rel="preload" href="/brand/edgaze-mark.png" as="image" type="image/png" fetchPriority="high" />
        <link rel="preload" href="/favicon.ico" as="image" type="image/x-icon" />
        
        {/* Prefetch likely navigation targets */}
        <link rel="prefetch" href="/marketplace" />
        <link rel="prefetch" href="/builder" />
        
        {/* Inline critical CSS to prevent FOUC (Flash of Unstyled Content) */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { 
            margin: 0;
            padding: 0;
            background: #07080b; 
            color: #ffffff;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          body { 
            overflow-x: hidden;
          }
          .loading-screen { 
            position: fixed; 
            inset: 0; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            background: #07080b;
            z-index: 9999;
          }
          @keyframes pulse { 
            0%, 100% { opacity: 1; } 
            50% { opacity: 0.5; } 
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          body { animation: fadeIn 0.15s ease-in; }
          * { box-sizing: border-box; }
        `}} />
      </head>
      <body className="h-full bg-[#07080b] text-white antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavigationJsonLd) }}
        />
        <AppProviders>
          <WebVitals />
          <Suspense fallback={<GlobalLoadingScreen />}>
            <LazyAnalyticsWrapper />
          </Suspense>
          <Suspense fallback={<GlobalLoadingScreen />}>
            <LayoutGate>{children}</LayoutGate>
          </Suspense>
        </AppProviders>
      </body>
    </html>
  );
}
