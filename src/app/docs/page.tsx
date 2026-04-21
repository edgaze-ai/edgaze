import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getAllDocs } from "./utils/docs";
import { buildMetadata } from "../../lib/seo";
import { sanitizeDocPath } from "../../lib/security/url-policy";

export const metadata: Metadata = buildMetadata({
  title: "Documentation | Edgaze",
  description:
    "Browse Edgaze documentation for builder guides, templates, payouts, creator policies, and platform reference material.",
  path: "/docs",
});

const PLATFORM_SLUGS = [
  "changelog",
  "edgaze-code",
  "platform-status-beta-disclaimer",
  "content-disclaimer",
];
const LEGAL_SLUGS = [
  "privacy-policy",
  "terms-of-service",
  "creator-terms",
  "acceptable-use-policy",
  "dmca",
];
const PAYMENTS_SLUGS = [
  "payments-overview",
  "payout-system",
  "marketplace-fees",
  "creator-earnings",
  "workflow-run-policy",
  "infrastructure-cost-estimation",
  "refund-policy",
  "chargeback-policy",
  "creator-subscription-policy",
  "pricing-limits",
  "fraud-abuse-policy",
];

export default function DocsIndex() {
  const docs = getAllDocs();
  const docHref = (slug: string) => {
    const encodedSlug = slug
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    if (!encodedSlug) return "/docs";
    return sanitizeDocPath(encodedSlug === "builder" ? "/docs/builder" : `/docs/${encodedSlug}`);
  };

  const builderDocs = docs.filter((d) => d.slug.startsWith("builder"));
  const platformDocs = docs.filter((d) => PLATFORM_SLUGS.includes(d.slug));
  const legalDocs = docs.filter((d) => LEGAL_SLUGS.includes(d.slug));
  const paymentsDocs = docs.filter((d) => PAYMENTS_SLUGS.includes(d.slug));
  const shownSlugs = new Set([
    ...builderDocs.map((d) => d.slug),
    ...platformDocs.map((d) => d.slug),
    ...legalDocs.map((d) => d.slug),
    ...paymentsDocs.map((d) => d.slug),
  ]);
  const restDocs = docs.filter((d) => !shownSlugs.has(d.slug));

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-6 py-10 sm:px-12 sm:py-14 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_-24px_rgba(0,0,0,0.7)]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_70%_at_0%_0%,rgba(53,156,255,0.08),transparent_55%),radial-gradient(ellipse_70%_65%_at_100%_100%,rgba(236,72,153,0.06),transparent_50%)]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
              Documentation
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.15]">
              Learn Edgaze like you are starting from zero
            </h1>
            <p className="mt-5 text-[15px] leading-[1.65] text-white/70 sm:text-base">
              Builder guides, templates, API Vault, payouts, creator terms, and platform policies,
              all written to be understandable for first-time users without losing professional
              depth.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/docs/builder"
                className="inline-flex items-center gap-2 rounded-xl bg-white/92 text-black px-4 py-2.5 text-sm font-medium hover:bg-white transition"
              >
                Get started with Builder
                <ArrowUpRight className="h-4 w-4 opacity-70" />
              </Link>
              <Link
                href="/docs/changelog"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition"
              >
                View changelog
              </Link>
            </div>
          </div>

          <div className="relative hidden w-full max-w-[340px] self-stretch lg:block lg:self-auto">
            <div className="absolute inset-0 rounded-2xl bg-black/40 ring-1 ring-white/15 backdrop-blur-sm" />
            <div className="relative h-full min-h-[200px] rounded-2xl p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
                Quick links
              </p>
              <p className="mt-1.5 text-sm font-medium text-white/90">
                Jump into the most used docs.
              </p>
              <div className="mt-5 space-y-2.5">
                <Link
                  href="/docs/builder/workflow-studio"
                  className="group flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 hover:border-white/20 hover:bg-white/[0.08] transition"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white/95">Workflow Studio</p>
                    <p className="mt-0.5 text-[11px] text-white/60">
                      Build multi-step AI workflows.
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/60 group-hover:text-white/90" />
                </Link>
                <Link
                  href="/docs/builder/templates"
                  className="group flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 hover:border-white/20 hover:bg-white/[0.08] transition"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white/95">Templates</p>
                    <p className="mt-0.5 text-[11px] text-white/60">Start from guided outcomes.</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/60 group-hover:text-white/90" />
                </Link>
                <Link
                  href="/docs/builder/api-vault"
                  className="group flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 hover:border-white/20 hover:bg-white/[0.08] transition"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white/95">API Vault</p>
                    <p className="mt-0.5 text-[11px] text-white/60">
                      Connect provider keys securely.
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/60 group-hover:text-white/90" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white/95">
            Platform fundamentals
          </h2>
          <p className="mt-1.5 text-[13px] text-white/50 max-w-2xl">
            These public guides explain what Edgaze is, how the marketplace works, and why the
            platform focuses on runnable workflows instead of isolated prompt fragments.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            {
              href: "/what-is-edgaze",
              title: "What is Edgaze?",
              description: "Start with the platform definition and authority overview.",
            },
            {
              href: "/how-edgaze-works",
              title: "How Edgaze works",
              description: "Understand the path from building to publishing and monetization.",
            },
            {
              href: "/docs/edgaze-code",
              title: "Edgaze Code",
              description:
                "Understand the link-free retrieval keyword creators can share anywhere.",
            },
            {
              href: "/why-workflows-not-prompts",
              title: "Why workflows, not prompts?",
              description: "See why Edgaze treats runnable systems as the unit of value.",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-5 hover:border-white/10 hover:bg-white/[0.04] transition"
            >
              <p className="text-[15px] font-medium text-white/95">{item.title}</p>
              <p className="mt-2 text-[13px] text-white/55 leading-relaxed">{item.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] text-white/40 group-hover:text-white/60 transition">
                Read page
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Builder guides — no tags */}
      <section className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white/95">Builder guides</h2>
          <p className="mt-1.5 text-[13px] text-white/50 max-w-md">
            Step-by-step guides for Workflow Studio and Prompt Studio.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {builderDocs.map((doc) => {
            const href = docHref(doc.slug);
            return (
              <Link
                key={doc.slug}
                href={href}
                className="group flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-5 hover:border-white/10 hover:bg-white/[0.04] transition shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
              >
                <p className="text-[15px] font-medium text-white/95">{doc.title}</p>
                {doc.description ? (
                  <p className="mt-2 text-[13px] text-white/55 leading-relaxed line-clamp-3">
                    {doc.description}
                  </p>
                ) : null}
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] text-white/40 group-hover:text-white/60 transition">
                  Read guide
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Platform */}
      {platformDocs.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white/95">Platform</h2>
            <p className="mt-1.5 text-[13px] text-white/50">
              Product updates and platform reference.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="flex flex-col gap-2">
              {platformDocs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={docHref(doc.slug)}
                  className="group flex items-start justify-between gap-4 rounded-xl px-4 py-3 hover:bg-white/[0.04] transition"
                >
                  <div>
                    <p className="text-[14px] font-medium text-white/90">{doc.title}</p>
                    {doc.description ? (
                      <p className="mt-0.5 text-[12px] text-white/50 line-clamp-2">
                        {doc.description}
                      </p>
                    ) : null}
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/35 group-hover:text-white/65" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Payments & Monetization */}
      {paymentsDocs.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white/95">
              Payments & Monetization
            </h2>
            <p className="mt-1.5 text-[13px] text-white/50">
              Marketplace fees, creator earnings, runs, and payment policies.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="flex flex-col gap-2">
              {paymentsDocs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={docHref(doc.slug)}
                  className="group flex items-start justify-between gap-4 rounded-xl px-4 py-3 hover:bg-white/[0.04] transition"
                >
                  <div>
                    <p className="text-[14px] font-medium text-white/90">{doc.title}</p>
                    {doc.description ? (
                      <p className="mt-0.5 text-[12px] text-white/50 line-clamp-2">
                        {doc.description}
                      </p>
                    ) : null}
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/35 group-hover:text-white/65" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Legal */}
      {legalDocs.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white/95">Legal</h2>
            <p className="mt-1.5 text-[13px] text-white/50">Policies, terms, and compliance.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="flex flex-col gap-2">
              {legalDocs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={docHref(doc.slug)}
                  className="group flex items-start justify-between gap-4 rounded-xl px-4 py-3 hover:bg-white/[0.04] transition"
                >
                  <div>
                    <p className="text-[14px] font-medium text-white/90">{doc.title}</p>
                    {doc.description ? (
                      <p className="mt-0.5 text-[12px] text-white/50 line-clamp-2">
                        {doc.description}
                      </p>
                    ) : null}
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/35 group-hover:text-white/65" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Everything else from the docs site */}
      {restDocs.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white/95">More</h2>
            <p className="mt-1.5 text-[13px] text-white/50">
              Guidelines, security, and other documentation.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="flex flex-col gap-2">
              {restDocs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={docHref(doc.slug)}
                  className="group flex items-start justify-between gap-4 rounded-xl px-4 py-3 hover:bg-white/[0.04] transition"
                >
                  <div>
                    <p className="text-[14px] font-medium text-white/90">{doc.title}</p>
                    {doc.description ? (
                      <p className="mt-0.5 text-[12px] text-white/50 line-clamp-2">
                        {doc.description}
                      </p>
                    ) : null}
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/35 group-hover:text-white/65" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
