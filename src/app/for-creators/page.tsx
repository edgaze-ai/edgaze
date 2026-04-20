import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/for-creators");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "For Creators | Edgaze",
  description: page?.description ?? "Edgaze for creators.",
  path: "/for-creators",
});

export default function ForCreatorsPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}
