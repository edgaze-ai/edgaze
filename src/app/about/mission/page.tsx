import type { Metadata } from "next";
import PublicContentPage from "../../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../../lib/public-site-pages";
import { buildMetadata } from "../../../lib/seo";

const page = getPublicContextPage("/about/mission");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "Edgaze Mission | Edgaze",
  description: page?.description ?? "The mission behind Edgaze.",
  path: "/about/mission",
});

export default function AboutMissionPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}
