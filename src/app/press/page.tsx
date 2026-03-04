import Link from "next/link";

export const metadata = {
  title: "Press",
  description: "Media inquiries and press resources for Edgaze.",
};

export default function PressPage() {
  return (
    <div className="min-h-screen w-full">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#07080b]" />
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%)]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Press
        </h1>
        <p className="mt-3 text-base text-white/65">
          Media inquiries and press resources.
        </p>

        <div className="mt-12 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">Press contact</h2>
          <a
            href="mailto:press@edgaze.ai"
            className="mt-2 block text-lg font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
          >
            press@edgaze.ai
          </a>
          <p className="mt-2 text-sm text-white/60">
            For interviews, media kits, and press inquiries.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">About Edgaze</h2>
          <p className="mt-2 text-sm text-white/70 leading-relaxed">
            Edgaze is the infrastructure for AI creators to build, publish, and monetize workflows in one click. Built by Edge Platforms, Inc. Founded 2025. Website: <a href="https://edgaze.ai" className="text-cyan-300 hover:text-cyan-200">edgaze.ai</a>.
          </p>
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
