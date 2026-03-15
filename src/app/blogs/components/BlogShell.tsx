"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { BlogMeta } from "../utils/blogs";

function BlogSidebar({ blogs, onItemClick }: { blogs: BlogMeta[]; onItemClick?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {blogs.map((b) => {
        const href = `/blogs/${b.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={b.slug}
            href={href}
            onClick={onItemClick}
            className={`block rounded-xl px-5 py-3.5 text-[15px] font-medium transition-all duration-200 ${
              active
                ? "bg-white/[0.08] text-white pl-6 border-l-2 border-cyan-400/70"
                : "text-white/65 hover:text-white/90 hover:bg-white/[0.05]"
            }`}
          >
            {b.title}
          </Link>
        );
      })}
    </nav>
  );
}

export default function BlogShell({
  blogs,
  children,
}: {
  blogs: BlogMeta[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#050505] text-white">
      {/* Ambient gradient orbs - behind everything */}
      <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.12] blur-[120px] [background:radial-gradient(circle,rgba(34,211,238,0.4),transparent_70%)]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.1] blur-[100px] [background:radial-gradient(circle,rgba(236,72,153,0.35),transparent_70%)]" />
        <div className="absolute bottom-0 left-1/2 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[80px] [background:radial-gradient(circle,rgba(34,211,238,0.3),transparent_70%)]" />
      </div>
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:64px_64px]"
        aria-hidden
      />

      {/* Fixed header - thinner, premium */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center border-b border-white/[0.05] bg-[#050505]/95 backdrop-blur-2xl">
        <div className="flex items-center justify-between w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-white/80 hover:text-white hover:bg-white/[0.05] transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open blog menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.75} />
            </button>

            <Link href="/blogs" className="flex items-center gap-3 group">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={28}
                height={28}
                priority
                className="shrink-0 translate-y-[2px]"
              />
              <span className="text-[15px] font-medium tracking-tight text-white/90 -translate-x-[5px]">
                Edgaze <span className="text-white/50 font-normal">Blogs</span>
              </span>
            </Link>
          </div>

          <Link
            href="/"
            className="text-[13px] font-medium text-white/50 hover:text-white/85 transition-colors"
          >
            ← Edgaze
          </Link>
        </div>
      </header>

      {/* Fixed sidebar - desktop only */}
      <aside className="hidden lg:block fixed left-0 top-14 bottom-0 w-[300px] border-r border-white/[0.06] bg-[#050505]/60 backdrop-blur-sm overflow-y-auto">
        <div className="py-10 pl-10 pr-6">
          <p className="text-xs font-medium uppercase tracking-widest text-white/40 mb-5">Posts</p>
          <BlogSidebar blogs={blogs} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-[380px] bg-[#0a0a0a] border-r border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between h-14 px-5 border-b border-white/[0.06]">
              <span className="text-[15px] font-medium text-white/90">Blogs</span>
              <button
                className="flex items-center justify-center w-12 h-12 rounded-xl text-white/80 hover:text-white hover:bg-white/[0.08] transition"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="w-6 h-6" strokeWidth={2} />
              </button>
            </div>
            <div className="p-5 overflow-auto max-h-[calc(100%-56px)]">
              <BlogSidebar blogs={blogs} onItemClick={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content area - only this scrolls */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pl-[300px]">
        <div className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 lg:px-14 xl:px-20 py-12 sm:py-16 lg:py-20">
          {children}
          <footer className="mt-20 pt-10 border-t border-white/[0.06] text-xs text-white/35">
            © {new Date().getFullYear()} Edge Platforms, Inc.
          </footer>
        </div>
      </main>
    </div>
  );
}
