import Link from "next/link";

export const metadata = {
  title: "Contact",
  description: "Get in touch with the Edgaze team.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen w-full">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#07080b]" />
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%)]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Contact</h1>
        <p className="mt-3 text-base text-white/65">
          Get in touch. We typically respond within 24–48 hours.
        </p>

        <div className="mt-12 space-y-8">
          <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-6 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">
              General inquiries
            </h2>
            <a
              href="mailto:support@edgaze.ai"
              className="mt-2 block text-lg font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              support@edgaze.ai
            </a>
            <p className="mt-2 text-sm text-white/60">
              For support, feedback, and general questions.
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-6 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">
              Creator & seller support
            </h2>
            <a
              href="mailto:sellers@edgaze.ai"
              className="mt-2 block text-lg font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              sellers@edgaze.ai
            </a>
            <p className="mt-2 text-sm text-white/60">
              For creator program, payouts, and Stripe Connect questions.
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-6 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">
              Press & partnerships
            </h2>
            <a
              href="mailto:press@edgaze.ai"
              className="mt-2 block text-lg font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              press@edgaze.ai
            </a>
            <p className="mt-2 text-sm text-white/60">
              For media, partnerships, and business inquiries.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <Link href="/help" className="text-sm text-white/60 hover:text-white transition-colors">
            ← Help & resources
          </Link>
        </div>
      </div>
    </div>
  );
}
