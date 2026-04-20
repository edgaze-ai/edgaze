import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/what-is-edgaze");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "What Is Edgaze? | Edgaze",
  description: page?.description ?? "Learn what Edgaze is.",
  path: "/what-is-edgaze",
});

export default function WhatIsEdgazePage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}
