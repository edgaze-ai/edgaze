import type { Metadata } from "next";
import "../styles/globals.css";

import { AppProviders } from "./providers";
import LayoutGate from "./LayoutGate";

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
          <LayoutGate>{children}</LayoutGate>
        </AppProviders>
      </body>
    </html>
  );
}
