import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/for-buyers");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "For Buyers | Edgaze",
  description: page?.description ?? "Edgaze for buyers.",
  path: "/for-buyers",
});

export default function ForBuyersPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}
