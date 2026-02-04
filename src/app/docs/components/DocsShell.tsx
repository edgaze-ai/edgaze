"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import DocsSidebar from "./DocsSidebar";
import type { DocMeta } from "../utils/docs";

export default function DocsShell({
  docs,
  children,
}: {
  docs: DocMeta[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/25 backdrop-blur">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden inline-flex items-center justify-center rounded-lg px-2.5 py-2 text-white/80 hover:bg-white/5 ring-1 ring-white/10"
              onClick={() => setMobileOpen(true)}
              aria-label="Open docs menu"
            >
              ☰
            </button>

            <Link href="/docs/changelog" className="flex items-center gap-2">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={22}
                height={22}
                priority
              />
              <span className="text-sm font-semibold tracking-tight text-white/90">
                Docs
              </span>
            </Link>
          </div>

          <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </div>
      </div>

      {/* Main layout: left sidebar pinned, content fills rest */}
      <div className="min-h-[calc(100vh-56px)] grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left sidebar (desktop) */}
        <aside className="hidden lg:block border-r border-white/10 bg-black/10">
          <div className="h-[calc(100vh-56px)] sticky top-14 overflow-auto">
            <div className="p-4">
              <DocsSidebar docs={docs} />
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] bg-[#0b0b0f] border-r border-white/10">
              <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Image
                    src="/brand/edgaze-mark.png"
                    alt="Edgaze"
                    width={22}
                    height={22}
                    priority
                  />
                  <span className="text-sm font-semibold text-white/90">
                    Docs
                  </span>
                </div>
                <button
                  className="rounded-lg px-2.5 py-2 hover:bg-white/5 ring-1 ring-white/10"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close docs menu"
                >
                  ✕
                </button>
              </div>

              <div
                className="h-[calc(100%-56px)] overflow-auto p-4"
                onClick={() => setMobileOpen(false)}
              >
                <DocsSidebar docs={docs} />
              </div>
            </div>
          </div>
        ) : null}

        {/* Content container: wide like OpenAI */}
        <div className="w-full">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-8">
            {children}
            <div className="mt-10 text-xs text-white/35">
              © {new Date().getFullYear()} Edgaze
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
