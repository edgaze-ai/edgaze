import type { Metadata } from "next";
import "../styles/globals.css";

import Sidebar from "../components/layout/Sidebar";
import { AppProviders } from "./providers";

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
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
