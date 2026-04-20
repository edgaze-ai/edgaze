import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/how-edgaze-works");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "How Edgaze Works | Edgaze",
  description: page?.description ?? "Learn how Edgaze works.",
  path: "/how-edgaze-works",
});

export default function HowEdgazeWorksPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}
