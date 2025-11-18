import Link from "next/link";
import { Play } from "lucide-react";

const thumbs = [
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555255707-c07966088b7b?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600&auto=format&fit=crop",
];

const featured = new Array(8).fill(0).map((_, i) => ({
  id: `w${i}`,
  title: [
    "YouTube Title Exploder",
    "PDF Summarizer Pro",
    "Sales Email Autopilot",
    "Code Reviewer",
    "Resume Tailor",
    "Image-to-AltText",
    "Research Co-Pilot",
    "Podcast Clipper",
  ][i],
  image: thumbs[i % thumbs.length],
  creator: ["nova", "echo", "kit", "mia", "arjun", "val", "sam", "evan"][i % 8],
  runs: Math.floor(2000 + Math.random() * 9000),
}));
const continueUsing = featured.slice(0, 4);

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] px-2.5 py-1 rounded-full edge-glass edge-border">{children}</span>;
}
function GButton({ children, href }: { children: React.ReactNode; href?: string }) {
  const btn = (
    <span className="inline-flex rounded-full p-[1.5px] edge-grad">
      <button className="rounded-full px-5 py-2 text-sm font-medium edge-glass edge-border hover:shadow-glow transition">
        {children}
      </button>
    </span>
  );
  return href ? <Link href={href}>{btn}</Link> : btn;
}
function SubtleButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-xl px-3.5 py-2 text-sm edge-glass edge-border hover:shadow-glow transition">
      {children}
    </button>
  );
}
function WorkflowCard({ w }: { w: any }) {
  return (
    <div className="overflow-hidden rounded-2xl edge-glass edge-border hover:shadow-glow transition">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={w.image} className="w-full h-48 object-cover" alt="" />
      <div className="p-3.5">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold line-clamp-1">{w.title}</h4>
          <span className="text-xs text-white/70">{w.runs.toLocaleString()} runs</span>
        </div>
        <p className="text-xs text-white/70">by @{w.creator}</p>
        <div className="mt-3 flex gap-2">
          <GButton>
            <Play size={14} className="inline mr-1" />
            Use
          </GButton>
          <SubtleButton>Details</SubtleButton>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-6 space-y-10">
      <div className="relative h-72 w-full overflow-hidden rounded-3xl edge-glass edge-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1547082299-de196ea013d6?q=80&w=1920&auto=format&fit=crop"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          alt=""
        />
        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <Tag>Featured</Tag>
            <Tag>Trending</Tag>
          </div>
          <div>
            <h2 className="text-3xl font-bold drop-shadow">Discover, run, and remix AI workflows</h2>
            <p className="mt-2 max-w-2xl text-white/90">Launch instantly, paywall optional, remix encouraged.</p>
            <div className="mt-4 flex gap-3">
              <GButton href="/builder">New workflow</GButton>
              <SubtleButton>Browse marketplace</SubtleButton>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Top workflows this week</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((w) => (
            <WorkflowCard key={w.id} w={w} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Continue using</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {continueUsing.map((w) => (
            <WorkflowCard key={w.id} w={w} />
          ))}
        </div>
      </section>
    </div>
  );
}
