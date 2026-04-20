import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "./default-social-image";
import { getSiteOrigin } from "./site-origin";

export const SITE_NAME = "Edgaze";
export const SITE_TAGLINE = "Turn your AI workflows into products people actually pay for.";
export const DEFAULT_TITLE = "Edgaze | Turn AI Workflows into Products People Pay For";
export const DEFAULT_DESCRIPTION =
  "Edgaze helps creators turn AI workflows into products people actually pay for. Build with Workflow Studio and Prompt Studio, publish with clear product pages, and sell through a marketplace built for prompts and workflows.";

export const DEFAULT_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const NOINDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    "max-image-preview": "none",
    "max-snippet": 0,
    "max-video-preview": 0,
  },
};

function normalizePath(path: string) {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  if (withLeadingSlash === "/") return withLeadingSlash;
  return withLeadingSlash.replace(/\/+$/, "");
}

export function buildCanonicalUrl(path = "/") {
  return `${getSiteOrigin()}${normalizePath(path)}`;
}

type BuildMetadataInput = {
  title: string;
  description: string;
  path?: string;
  robots?: Metadata["robots"];
  openGraphType?: "website" | "article";
  publishedTime?: string;
};

export function buildMetadata({
  title,
  description,
  path = "/",
  robots = DEFAULT_ROBOTS,
  openGraphType = "website",
  publishedTime,
}: BuildMetadataInput): Metadata {
  const canonical = buildCanonicalUrl(path);

  return {
    title: { absolute: title },
    description,
    robots,
    alternates: {
      canonical,
    },
    openGraph: {
      type: openGraphType,
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
  };
}

export function buildWebsiteJsonLd() {
  const url = buildCanonicalUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}#website`,
    name: SITE_NAME,
    url,
    description: DEFAULT_DESCRIPTION,
  };
}

export function buildOrganizationJsonLd() {
  const url = buildCanonicalUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}#organization`,
    name: SITE_NAME,
    url,
    logo: `${url}brand/edgaze-mark.png`,
    sameAs: [
      "https://x.com/edgaze_ai",
      "https://github.com/edgaze-ai",
      "https://www.linkedin.com/company/edgaze-ai/",
    ],
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(item.path),
    })),
  };
}

export function hasMeaningfulTextContent(text: string | null | undefined, minLength = 120) {
  if (!text) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length >= minLength;
}
