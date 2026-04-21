// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../styles/globals.css";

import { AppProviders } from "./providers";
import ClientLayoutGate from "./ClientLayoutGate";
import LazyAnalyticsWrapper from "../components/layout/LazyAnalytics";
import { WebVitals } from "./web-vitals";
import { getSiteOrigin } from "../lib/site-origin";
import { DEFAULT_DESCRIPTION, DEFAULT_ROBOTS, DEFAULT_TITLE, SITE_NAME } from "../lib/seo";

const SITE_ORIGIN = getSiteOrigin();

/** Meta Sharing Debugger / OG: numeric App ID (same as Facebook Login app id). */
const fbAppId = process.env.FACEBOOK_APP_ID?.trim() || process.env.FACEBOOK_CLIENT_ID?.trim() || "";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | Marketplace",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  referrer: "origin-when-cross-origin",
  robots: DEFAULT_ROBOTS,
  openGraph: {
    type: "website",
    url: SITE_ORIGIN,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="h-full bg-[#0a0a0a] text-white antialiased font-dm-sans"
        style={{ backgroundColor: "#0a0a0a", color: "#ffffff", margin: 0 }}
      >
        <AppProviders>
          <WebVitals />
          <SpeedInsights />
          <Suspense fallback={null}>
            <LazyAnalyticsWrapper />
          </Suspense>
          <Suspense fallback={null}>
            <ClientLayoutGate>{children}</ClientLayoutGate>
          </Suspense>
        </AppProviders>
      </body>
    </html>
  );
}
