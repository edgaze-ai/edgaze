import React from "react";
import Image from "next/image";
import Link from "next/link";
import AdminGate from "../../components/admin/AdminGate";
import AdminHeaderNav from "../../components/admin/AdminHeaderNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="min-h-screen min-w-0 bg-[#070708] text-white antialiased overflow-x-hidden">
        {/* Subtle gradient + noise for depth */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#0c0c0e] via-[#080809] to-[#060607]" />
        <div
          className="fixed inset-0 -z-10 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Desktop / large viewports: full chrome. Below xl, mobile AppShell topbar + admin drawer handle navigation. */}
        <header className="hidden xl:block sticky top-0 z-10 border-b border-white/[0.06] bg-[#070708]/90 backdrop-blur-2xl backdrop-saturate-150">
          <div className="mx-auto flex min-h-[4.5rem] max-w-[1600px] items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center gap-8">
              <Link
                href="/admin/moderation"
                className="group flex items-center gap-3.5 transition-opacity hover:opacity-90"
                aria-label="Edgaze Admin home"
              >
                <Image
                  src="/brand/edgaze-mark.png"
                  alt="Edgaze"
                  width={40}
                  height={40}
                  priority
                  className="shrink-0 translate-y-[2px]"
                />
                <span className="text-[1.35rem] font-semibold tracking-[-0.02em] text-white/90 sm:text-[1.65rem] sm:tracking-[-0.03em] -translate-x-[3px]">
                  Edgaze <span className="font-semibold text-emerald-400">Admin</span>
                </span>
              </Link>
              <AdminHeaderNav />
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

        <main className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-6 sm:px-6 sm:py-8 lg:px-8 xl:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </AdminGate>
  );
}
