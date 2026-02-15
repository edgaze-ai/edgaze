import React from "react";
import Link from "next/link";
import AdminGate from "../../components/admin/AdminGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="min-h-screen bg-[#070708] text-white antialiased">
        {/* Subtle gradient + noise for depth */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#0c0c0e] via-[#080809] to-[#060607]" />
        <div
          className="fixed inset-0 -z-10 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#070708]/90 backdrop-blur-2xl backdrop-saturate-150">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-8">
              <Link
                href="/admin/moderation"
                className="flex items-center gap-3 transition-opacity hover:opacity-90"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  <span className="text-cyan-400 font-semibold text-sm tracking-tight">A</span>
                </div>
                <div>
                  <span className="block text-[15px] font-semibold tracking-tight text-white">
                    Admin
                  </span>
                  <span className="block text-[11px] font-medium uppercase tracking-widest text-white/40">
                    Control center
                  </span>
                </div>
              </Link>
              <nav className="hidden sm:flex items-center gap-0.5">
                <Link
                  href="/admin/moderation"
                  className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-white/90 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  Moderation
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/marketplace"
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-white/70 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/90 transition-all"
              >
                Back to app
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </AdminGate>
  );
}
