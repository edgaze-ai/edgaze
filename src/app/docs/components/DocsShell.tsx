"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
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
  const [canGoBack, setCanGoBack] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      queueMicrotask(() => setCanGoBack(window.history.length > 1));
    }
  }, []);

  const handleBackClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      {/* Top bar - original structure, logo design only */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/25 backdrop-blur">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden inline-flex items-center justify-center text-white/90 hover:text-white transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open docs menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <Link href="/docs" className="flex items-center gap-3">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={28}
                height={28}
                priority
                className="shrink-0 translate-y-[2px]"
              />
              <span className="text-[15px] font-medium tracking-tight text-white/90 -translate-x-[5px]">
                Edgaze <span className="text-white/50 font-normal">Docs</span>
              </span>
            </Link>
          </div>

          <button
            onClick={handleBackClick}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
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
                <div className="flex items-center gap-3">
                  <Image
                    src="/brand/edgaze-mark.png"
                    alt="Edgaze"
                    width={28}
                    height={28}
                    priority
                    className="shrink-0 translate-y-[2px]"
                  />
                  <span className="text-[15px] font-medium tracking-tight text-white/90 -translate-x-[5px]">
                    Edgaze <span className="text-white/50 font-normal">Docs</span>
                  </span>
                </div>
                <button
                  className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-xl transition-all duration-200 hover:bg-white/10 hover:ring-white/20 active:scale-95 active:bg-white/[0.08]"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close docs menu"
                >
                  <X className="h-[18px] w-[18px] text-white/80 transition-colors group-hover:text-white" strokeWidth={2.25} />
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

        {/* Content container */}
        <div className="w-full [scroll-behavior:smooth]">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-8">
            {children}
            <div className="mt-10 text-[11px] text-white/35">
              © 2026 Edge Platforms, Inc. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
