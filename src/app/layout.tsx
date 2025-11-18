import "src/styles/globals.css";
import type { Metadata } from "next";
import React from "react";

import { SidebarProvider } from "../components/layout/SidebarContext";
import Sidebar from "../components/layout/Sidebar";

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
    <html lang="en" className="h-full">
      <body className="h-full bg-[#050505] text-white antialiased">
        <SidebarProvider>
          <div className="flex h-screen w-screen overflow-hidden">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content grows/shrinks automatically when sidebar collapses */}
            <main className="flex-1 min-w-0 h-full">{children}</main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
