"use client";

import Link from "next/link";
import { FaGithub, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import { SITE_META_DESCRIPTION } from "@lib/constants";

const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { label: "Marketplace", href: "/marketplace" },
      { label: "Workflow Studio", href: "/builder" },
      { label: "Prompt Studio", href: "/prompt-studio" },
      { label: "Creator Program", href: "/creators" },
      { label: "Library", href: "/library" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Blog", href: "/blogs" },
      { label: "Changelog", href: "/docs/changelog" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/docs/terms-of-service" },
      { label: "Privacy Policy", href: "/docs/privacy-policy" },
      { label: "Creator Terms", href: "/docs/creator-terms" },
      { label: "Payment Policies", href: "/docs/payments-overview" },
      { label: "Acceptable Use Policy", href: "/docs/acceptable-use-policy" },
      { label: "DMCA", href: "/docs/dmca" },
    ],
  },
];

const SOCIAL_LINKS: Array<{
  label: string;
  href: string;
  external: true;
  kind: "edgaze" | "x" | "github" | "linkedin";
}> = [
  {
    label: "Edgaze",
    href: "https://www.edgaze.ai/profile/@edgaze",
    external: true,
    kind: "edgaze",
  },
  { label: "X", href: "https://x.com/edgaze_ai", external: true, kind: "x" },
  { label: "GitHub", href: "https://github.com/edgaze-ai", external: true, kind: "github" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/edgaze-ai/",
    external: true,
    kind: "linkedin",
  },
];

export default function Footer() {
  return (
    <footer className="w-full" aria-label="Site footer">
      <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.08] p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-8 sm:gap-10 lg:gap-12">
          {/* Top: Brand + grid */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 sm:gap-10">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                className="h-10 w-10 sm:h-11 sm:w-11 shrink-0"
              />
              <div>
                <div className="text-sm font-semibold text-white">Edgaze</div>
                <div className="mt-0.5 text-xs sm:text-sm text-white/55 sm:text-white/60 max-w-md">
                  {SITE_META_DESCRIPTION}
                </div>
              </div>
            </div>

            <nav
              aria-label="Footer navigation"
              className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6 sm:gap-8 lg:gap-12"
            >
              {FOOTER_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white/40 mb-2.5 sm:mb-3">
                    {section.title}
                  </h3>
                  <ul className="flex flex-col gap-2 sm:gap-2.5">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        {"external" in link && link.external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-white/70 hover:text-white transition-colors"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            href={link.href}
                            className="text-sm text-white/70 hover:text-white transition-colors"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          {/* Social + Copyright */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pt-5 sm:pt-4 border-t border-white/[0.05]">
            <div className="flex items-center gap-5 sm:gap-6">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  title={link.label}
                  className="group inline-flex h-6 w-6 shrink-0 items-center justify-center text-white/55 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080c] rounded-sm"
                >
                  {link.kind === "edgaze" ? (
                    <img
                      src="/brand/edgaze-mark.png"
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 object-contain [filter:brightness(0)_invert(1)] opacity-[0.55] transition-[opacity,transform] duration-200 ease-out group-hover:opacity-100 group-hover:scale-[1.06]"
                    />
                  ) : link.kind === "x" ? (
                    <FaXTwitter
                      className="h-6 w-6 transition-transform duration-200 ease-out group-hover:scale-[1.06]"
                      aria-hidden
                    />
                  ) : link.kind === "github" ? (
                    <FaGithub
                      className="h-6 w-6 transition-transform duration-200 ease-out group-hover:scale-[1.06]"
                      aria-hidden
                    />
                  ) : (
                    <FaLinkedinIn
                      className="h-6 w-6 transition-transform duration-200 ease-out group-hover:scale-[1.06]"
                      aria-hidden
                    />
                  )}
                </a>
              ))}
            </div>
            <div className="text-[11px] sm:text-xs text-white/45 sm:text-white/50">
              © 2026 Edge Platforms, Inc. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
