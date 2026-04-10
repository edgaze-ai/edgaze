// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import "../styles/globals.css";

import { AppProviders } from "./providers";
import ClientLayoutGate from "./ClientLayoutGate";
import LazyAnalyticsWrapper from "../components/layout/LazyAnalytics";
import { MinimalLoadingFallback } from "../components/loading/GlobalLoadingScreen";
import { WebVitals } from "./web-vitals";
import { getSiteOrigin } from "@lib/site-origin";
import { SITE_META_DESCRIPTION } from "@lib/constants";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";
import { buildPrimarySitelinksItemList, ORGANIZATION_SAME_AS } from "@lib/primary-sitelinks";

const SITE_ORIGIN = getSiteOrigin();

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/** Meta Sharing Debugger / OG: numeric App ID (same as Facebook Login app id). */
const fbAppId = process.env.FACEBOOK_APP_ID?.trim() || process.env.FACEBOOK_CLIENT_ID?.trim() || "";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Edgaze",
  description: SITE_META_DESCRIPTION,
  applicationName: "Edgaze",
  referrer: "origin-when-cross-origin",
  openGraph: {
    type: "website",
    url: SITE_ORIGIN,
    siteName: "Edgaze",
    title: "Edgaze",
    description: SITE_META_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Edgaze",
    description: SITE_META_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  ...(fbAppId ? { other: { "fb:app_id": fbAppId } } : {}),
  // Tab + PWA icons are optimized rasters from /brand/edgaze-mark.png — run `npm run favicon:generate` after updating the mark.
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
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
      "@id": `${SITE_ORIGIN}/#organization`,
      name: "Edgaze",
      url: SITE_ORIGIN,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_ORIGIN}/brand/edgaze-mark.png`,
      },
      sameAs: [...ORGANIZATION_SAME_AS],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: "Edgaze",
      description: SITE_META_DESCRIPTION,
      publisher: {
        "@id": `${SITE_ORIGIN}/#organization`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_ORIGIN}/marketplace?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    buildPrimarySitelinksItemList(SITE_ORIGIN),
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="h-full bg-[#0a0a0a] text-white antialiased font-dm-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavigationJsonLd) }}
        />
        <AppProviders>
          <WebVitals />
          <Suspense fallback={<MinimalLoadingFallback />}>
            <LazyAnalyticsWrapper />
          </Suspense>
          <Suspense fallback={<MinimalLoadingFallback />}>
            <ClientLayoutGate>{children}</ClientLayoutGate>
          </Suspense>
        </AppProviders>
      </body>
    </html>
  );
}
