import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, Sparkles, Zap } from "lucide-react";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { buildMetadata, buildCanonicalUrl } from "@lib/seo";
import DiplomemeStorefrontTracker from "./DiplomemeStorefrontTracker";

export const dynamic = "force-dynamic";

const HANDLE = "diplomeme";
const CTA_URL =
  "/templates?affiliate=diplomeme&utm_source=affiliate&utm_medium=storefront&utm_campaign=diplomeme";

const baseMetadata = buildMetadata({
  title: "Murphy AI Storefront | Edgaze",
  description:
    "A curated Murphy AI collection on Edgaze with ready-to-run AI products and workflows.",
  path: "/diplomeme",
});

export const metadata: Metadata = {
  ...baseMetadata,
  openGraph: {
    ...baseMetadata.openGraph,
    description: "Browse Murphy AI products and workflow templates on Edgaze.",
    url: buildCanonicalUrl("/diplomeme"),
  },
};

type ProfileRow = {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  is_verified_creator?: boolean | null;
};

type StorefrontListing = {
  id: string;
  type: "workflow";
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  edgaze_code: string | null;
  owner_handle: string | null;
  views_count: number;
  likes_count: number;
  runs_count: number;
  price_usd: number | null;
  is_paid: boolean | null;
  monetisation_mode: string | null;
  featured_on_profile: boolean | null;
  featured_on_profile_rank: number | null;
  created_at: string | null;
};

const MURPHY_DISPLAY_NAME = "Murphy AI";

function listingHref(listing: StorefrontListing): string {
  const handle = (listing.owner_handle || HANDLE).replace(/^@/, "");
  const code = listing.edgaze_code || listing.id;
  return `/${handle}/${code}`;
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const pageSize = 120;
  const rows: T[] = [];

  for (let from = 0; from < 1000; from += pageSize) {
    const to = from + pageSize - 1;
    const res = await fetchPage(from, to);
    if (res.error) throw res.error;
    const batch = res.data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

async function fetchProfileAndListings() {
  const supabase = createSupabaseAdminClient();
  const { data: profileData } = await supabase.rpc("get_profile_by_handle_insensitive", {
    handle_input: HANDLE,
  });
  const profileMin = (
    Array.isArray(profileData) ? profileData[0] : profileData
  ) as ProfileRow | null;
  if (!profileMin?.id) return { profile: null, listings: [] as StorefrontListing[] };

  const { data: profileFull } = await supabase
    .from("profiles")
    .select("id, handle, full_name, avatar_url, bio, banner_url, is_verified_creator")
    .eq("id", profileMin.id)
    .maybeSingle();
  const profile = ((profileFull as ProfileRow | null) ?? profileMin) as ProfileRow;

  const workflowSelect = [
    "id",
    "title",
    "description",
    "thumbnail_url",
    "edgaze_code",
    "owner_handle",
    "views_count",
    "likes_count",
    "runs_count",
    "price_usd",
    "is_paid",
    "monetisation_mode",
    "featured_on_profile",
    "featured_on_profile_rank",
    "published_at",
    "created_at",
  ].join(",");

  const fetchWorkflowRows = async (mode: "visibility" | "is_public") =>
    fetchAllPages<any>((from, to) => {
      let builder = supabase
        .from("workflows")
        .select(workflowSelect)
        .eq("owner_id", profile.id)
        .eq("is_published", true)
        .is("removed_at", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (mode === "visibility") {
        builder = builder.in("visibility", ["public", "unlisted"]);
      } else {
        builder = builder.eq("is_public", true);
      }

      return builder;
    });

  let workflowRows: any[] = [];
  try {
    workflowRows = await fetchWorkflowRows("visibility");
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? "").toLowerCase();
    if (message.includes("visibility") && message.includes("does not exist")) {
      workflowRows = await fetchWorkflowRows("is_public");
    } else {
      console.error("[diplomeme] workflows", error);
    }
  }

  const workflows: StorefrontListing[] = workflowRows.map((row: any) => ({
    id: String(row.id),
    type: "workflow",
    title: row.title ?? null,
    description: row.description ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    edgaze_code: row.edgaze_code ?? null,
    owner_handle: row.owner_handle ?? profile.handle ?? HANDLE,
    views_count: Number(row.views_count ?? 0),
    likes_count: Number(row.likes_count ?? 0),
    runs_count: Number(row.runs_count ?? 0),
    price_usd: row.price_usd != null ? Number(row.price_usd) : null,
    is_paid: row.is_paid ?? null,
    monetisation_mode: row.monetisation_mode ?? null,
    featured_on_profile: row.featured_on_profile ?? null,
    featured_on_profile_rank:
      row.featured_on_profile_rank != null ? Number(row.featured_on_profile_rank) : null,
    created_at: row.published_at ?? row.created_at ?? null,
  }));

  const listings = workflows.sort(
    (a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""),
  );

  return { profile, listings };
}

function ListingCard({ listing }: { listing: StorefrontListing }) {
  const href = listingHref(listing);
  const price =
    listing.is_paid || (listing.price_usd != null && listing.price_usd > 0)
      ? `$${Number(listing.price_usd ?? 0).toFixed(0)}`
      : "Free";

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-white/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.07]"
    >
      <div className="relative aspect-[1.35/1] overflow-hidden bg-[#101318]">
        {listing.thumbnail_url ? (
          <Image
            src={listing.thumbnail_url}
            alt={listing.title || "Diplomeme listing"}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.22),transparent_35%),linear-gradient(135deg,#121720,#07080b)]">
            <Sparkles className="h-10 w-10 text-cyan-200/45" />
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur">
          {listing.type}
        </div>
        <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-black">
          {price}
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
            {listing.title || "Untitled drop"}
          </h3>
          <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-white/35 transition group-hover:text-cyan-200" />
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/55">
          {listing.description || "A ready-to-use AI product from the Diplomeme collection."}
        </p>
        <div className="mt-5 inline-flex items-center text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/65">
          Open product
          <ArrowRight className="ml-2 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export default async function DiplomemeStorefrontPage() {
  const { profile, listings } = await fetchProfileAndListings();
  const displayName = MURPHY_DISPLAY_NAME;
  const featured = [...listings]
    .sort((a, b) => {
      const runsDiff = b.runs_count - a.runs_count;
      if (runsDiff !== 0) return runsDiff;
      const likesDiff = b.likes_count - a.likes_count;
      if (likesDiff !== 0) return likesDiff;
      const viewsDiff = b.views_count - a.views_count;
      if (viewsDiff !== 0) return viewsDiff;
      return Date.parse(b.created_at || "") - Date.parse(a.created_at || "");
    })
    .slice(0, 4);

  return (
    <main className="min-h-screen w-full bg-black text-white font-dm-sans">
      <DiplomemeStorefrontTracker ctaUrl={CTA_URL} />
      <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-hidden px-5 pt-20 pb-16 sm:px-8 md:pt-28 lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_88%_20%,rgba(236,72,153,0.1),transparent_32%),linear-gradient(180deg,#07080b_0%,#050506_62%,#000_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black to-transparent" />
        <div className="relative mx-auto grid min-h-[min(760px,86dvh)] max-w-[1320px] items-center gap-12 md:grid-cols-[0.95fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[0.06] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100/70 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              Murphy AI collection
            </div>
            <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Murphy AI tools, ready to run.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/62 sm:text-lg">
              The Murphy AI storefront brings together every public product from @
              {profile?.handle || HANDLE}: sharp prompts, useful workflows, and ready-to-run tools
              built for modern creative work.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#featured"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-[0_18px_55px_rgba(255,255,255,0.12)] transition hover:-translate-y-0.5"
              >
                Browse the collection
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href={`/profile/@${HANDLE}`}
                className="inline-flex items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-bold text-white/85 backdrop-blur transition hover:bg-white/[0.08] hover:text-white"
              >
                View profile
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-8 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative mx-auto max-w-[520px]">
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.1] bg-[#090b10] p-5 shadow-[0_45px_140px_rgba(0,0,0,0.52)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_56%_18%,rgba(34,211,238,0.18),transparent_28%),linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))]" />
                <div className="relative rounded-[2rem] border border-white/[0.08] bg-black/35 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100/55">
                        Creator shelf
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">
                        {displayName}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-white/42">
                        @{profile?.handle || HANDLE}
                      </p>
                    </div>
                    {profile?.is_verified_creator ? (
                      <CheckCircle2 className="mt-1 h-5 w-5 text-cyan-200" />
                    ) : null}
                  </div>

                  <div className="relative mx-auto my-8 h-64 w-full max-w-[360px] overflow-hidden rounded-[2rem] border border-white/[0.12] bg-white/[0.06] p-2 shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:h-80">
                    <div className="relative h-full w-full overflow-hidden rounded-[1.55rem] bg-black">
                      {profile?.avatar_url ? (
                        <Image
                          src={profile.avatar_url}
                          alt={displayName}
                          fill
                          priority
                          sizes="288px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-7xl font-black text-white/70">
                          D
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-white/58">
                    {profile?.bio ||
                      "A curated shelf of AI products, creative utilities, and ready-to-run workflows."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="featured" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/50">
              Featured selection
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
              Featured workflows
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/48">
            A curated set of Murphy AI workflows surfaced automatically from the strongest recent
            performance on Edgaze.
          </p>
        </div>

        {listings.length === 0 ? (
          <div className="mt-10 rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-8 text-white/55">
            Murphy AI workflows are not available yet. Check back soon.
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featured.map((listing) => (
              <ListingCard key={`${listing.type}:${listing.id}`} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section id="archive" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-4 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/50">
              Full archive
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
              All published workflows
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/48">
            Every Murphy AI workflow published on Edgaze, ordered from newest to oldest.
          </p>
        </div>

        {listings.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={`archive-${listing.type}:${listing.id}`} listing={listing} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-10">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["Choose a product", "Open a curated AI product built for a specific outcome."],
            ["Run the workflow", "Use the published tool directly from Edgaze."],
            ["Keep momentum", "Move from discovery to execution without extra setup."],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-6"
            >
              <Zap className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-5 text-lg font-black tracking-[-0.03em] text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 overflow-hidden rounded-[2.5rem] border border-white/[0.08] bg-white/[0.06] p-8 text-white shadow-[0_35px_110px_rgba(0,0,0,0.35)] sm:p-12">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/65">
                Start from a template
              </p>
              <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                Start building with Edgaze templates.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">
                Choose a template, customize the workflow, and publish a useful AI product faster.
              </p>
            </div>
            <Link
              href={CTA_URL}
              data-affiliate-cta
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-4 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-cyan-100"
            >
              Browse templates
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
