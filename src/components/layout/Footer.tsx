"use client";

import Link from "next/link";

const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { label: "Builder", href: "/builder" },
      { label: "Explore Workflows", href: "/marketplace" },
      { label: "Pricing", href: "/pricing" },
      { label: "Creator Program", href: "/apply" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Blog", href: "/docs/changelog" },
      { label: "Changelog", href: "/docs/changelog" },
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
      { label: "Acceptable Use Policy", href: "/docs/acceptable-use-policy" },
      { label: "DMCA", href: "/docs/dmca" },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "X", href: "https://x.com/edgaze_ai", external: true },
  { label: "GitHub", href: "https://github.com/edgaze-ai", external: true },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/edgaze-ai/", external: true },
];

export default function Footer() {
  return (
    <footer className="w-full" aria-label="Site footer">
      <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.08] p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-8 sm:gap-10 lg:gap-12">
          {/* Top: Brand + grid */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 sm:gap-10">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-10 w-10 sm:h-11 sm:w-11 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">Edgaze</div>
                <div className="mt-0.5 text-xs sm:text-sm text-white/55 sm:text-white/60">
                  Create, sell, and distribute AI products.
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
                  className="text-sm text-white/55 hover:text-white transition-colors py-0.5 -my-0.5"
                >
                  {link.label}
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
