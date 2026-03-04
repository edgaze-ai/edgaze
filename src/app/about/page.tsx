import Link from "next/link";

export const metadata = {
  title: "About",
  description: "Edgaze is the infrastructure for AI creators to build, publish, and monetize workflows in one click.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen w-full">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#07080b]" />
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%)]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          About Edgaze
        </h1>
        <p className="mt-3 text-base text-white/65">
          The infrastructure for AI creators to build, publish, and monetize workflows in one click.
        </p>

        <div className="mt-12 space-y-8 text-white/75 leading-relaxed">
          <p>
            Powerful prompts and AI workflows are shared through screenshots, scattered docs, and long threads. They’re hard to discover, impossible to run instantly, and even harder to monetize.
          </p>
          <p>
            Edgaze changes that. We provide a visual, no-code workflow builder where AI creators can build tools, publish them instantly, and share them with a link. Users can run workflows in one click, fork and remix them, and pay only when creators choose to monetize.
          </p>
          <p>
            Edgaze is built by Edge Platforms, Inc. and serves as the creator infrastructure layer for the AI-native internet. We’re not another chatbot—we’re building the distribution and monetization layer for the AI creator economy.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-2xl bg-white text-black px-5 py-2.5 text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Explore workflows
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 ring-1 ring-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition-colors"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
