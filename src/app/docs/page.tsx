import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getAllDocs } from "./utils/docs";

export const metadata = {
  title: "Documentation",
  description: "Explore all Edgaze documentation, from builder guides to policies and changelogs.",
};

const PLATFORM_SLUGS = ["changelog", "platform-status-beta-disclaimer", "content-disclaimer"];
const LEGAL_SLUGS = [
  "privacy-policy",
  "terms-of-service",
  "creator-terms",
  "acceptable-use-policy",
  "dmca",
];
const PAYMENTS_SLUGS = [
  "payments-overview",
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
      {/* Hero — with colour */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-indigo-500/10 px-6 py-10 sm:px-12 sm:py-14 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_-24px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.12),transparent_70%),radial-gradient(ellipse_60%_50%_at_80%_50%,rgba(129,140,248,0.08),transparent)]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">
              Documentation
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.15]">
              Everything you need to ship with Edgaze
            </h1>
            <p className="mt-5 text-[15px] leading-[1.65] text-white/70 sm:text-base">
              Learn how to build with Workflow Studio and Prompt Studio, understand our policies,
              and track product changes—all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/docs/builder"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2.5 text-sm font-medium shadow-lg shadow-cyan-500/20 hover:bg-white/95 transition"
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
                  className="group flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white/95">Workflow Studio</p>
                    <p className="mt-0.5 text-[11px] text-white/60">
                      Build multi-step AI workflows.
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/60 group-hover:text-cyan-300" />
                </Link>
                <Link
                  href="/docs/builder/prompt-studio"
                  className="group flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 hover:border-violet-400/60 hover:bg-violet-500/10 transition"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white/95">Prompt Studio</p>
                    <p className="mt-0.5 text-[11px] text-white/60">
                      Create reusable prompt templates.
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/60 group-hover:text-violet-300" />
                </Link>
                <Link
                  href="/docs/changelog"
                  className="group flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 hover:border-emerald-400/60 hover:bg-emerald-500/10 transition"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white/95">Changelog</p>
                    <p className="mt-0.5 text-[11px] text-white/60">
                      See what&apos;s new in Edgaze.
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/60 group-hover:text-emerald-300" />
                </Link>
              </div>
            </div>
          </div>
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
            const href = doc.slug === "builder" ? "/docs/builder" : `/docs/${doc.slug}`;
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
                  href={`/docs/${doc.slug}`}
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
                  href={`/docs/${doc.slug}`}
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
                  href={`/docs/${doc.slug}`}
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
                  href={`/docs/${doc.slug}`}
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
