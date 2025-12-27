import type { Metadata } from "next";
import "../styles/globals.css";

import { AppProviders } from "./providers";
import AppShell from "./AppShell";
import VerifyEmailBanner from "../components/auth/VerifyEmailBanner";

export const metadata: Metadata = {
  title: "Edgaze",
  description: "Creators build with AI",
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
          {/* Shows only for logged-in + unverified users */}
          <VerifyEmailBanner />
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
