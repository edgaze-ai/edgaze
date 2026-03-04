import Link from "next/link";

export const metadata = {
  title: "Careers",
  description: "Join Edge Platforms. We're building the infrastructure for the AI creator economy.",
};

export default function CareersPage() {
  return (
    <div className="min-h-screen w-full">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#07080b]" />
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%)]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Careers
        </h1>
        <p className="mt-3 text-base text-white/65">
          We’re building. Check back soon.
        </p>

        <div className="mt-12 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-8 sm:p-10">
          <p className="text-white/70 leading-relaxed">
            Edge Platforms is early-stage and growing. We’re building foundational infrastructure for the AI creator economy. If that sounds like the kind of thing you want to work on, we’d love to hear from you.
          </p>
          <a
            href="mailto:support@edgaze.ai?subject=Careers%20inquiry"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/10 ring-1 ring-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition-colors"
          >
            Get in touch
          </a>
        </div>

        <div className="mt-8">
          <Link
            href="/about"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            ← About Edgaze
          </Link>
        </div>
      </div>
    </div>
  );
}
