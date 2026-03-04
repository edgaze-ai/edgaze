import Link from "next/link";

export const metadata = {
  title: "Pricing",
  description: "Creator-first pricing. 80/20 revenue share. Simple, transparent.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen w-full">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#07080b]" />
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%)]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Pricing
        </h1>
        <p className="mt-3 text-base text-white/65">
          Simple, creator-first pricing. You keep the majority.
        </p>

        <div className="mt-12 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-8 sm:p-10">
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-lg font-semibold text-white">Creator revenue share</h2>
              <p className="mt-2 text-15 text-white/70 leading-relaxed">
                Edgaze operates on an <strong className="text-white/90">80/20</strong> split: creators keep 80% of each sale; the platform retains 20% to cover hosting, payments, and operations. Stripe processing fees (2.9% + $0.30) are deducted before the split.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Beta period</h2>
              <p className="mt-2 text-15 text-white/70 leading-relaxed">
                During our closed beta, all marketplace content is <strong className="text-white/90">free to access</strong>. Monetization is rolling out as we move toward general availability. <Link href="/apply" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">Apply to the Creator Program</Link> to get early access.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Payouts</h2>
              <p className="mt-2 text-15 text-white/70 leading-relaxed">
                Automatic weekly payouts every Monday. Minimum threshold: $10. Payouts typically arrive in 2–3 business days.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/apply"
            className="inline-flex items-center gap-2 rounded-2xl bg-white text-black px-5 py-2.5 text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Join Creator Program
          </Link>
          <Link
            href="/docs/creator-terms"
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 ring-1 ring-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition-colors"
          >
            Creator Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
