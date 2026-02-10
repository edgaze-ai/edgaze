import React from "react";
import Link from "next/link";
import AdminGate from "../../components/admin/AdminGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="min-h-screen bg-[#0b0b0b] text-white">
        {/* Top bar */}
        <header className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#0b0b0b]/80 backdrop-blur-xl">
          <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <Link href="/admin/moderation" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
                  <span className="text-cyan-400 font-semibold text-sm">A</span>
                </div>
                <span className="text-sm font-semibold tracking-tight text-white/95">Admin</span>
              </Link>
              <nav className="hidden sm:flex items-center gap-1">
                <Link
                  href="/admin/moderation"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  Moderation
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/marketplace"
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
              >
                Back to app
              </Link>
            </div>
          </div>
        </header>

        <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </AdminGate>
  );
}
