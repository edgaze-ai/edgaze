// src/app/builder/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";
import BuilderClientPage from "./BuilderClientPage";

export const metadata: Metadata = {
  title: "Workflow Builder",
  description:
    "Build, test, and publish AI workflows in a visual studio. Turn prompts into tools and ship production-grade automation on Edgaze.",
  openGraph: {
    title: "Workflow Builder",
    description:
      "Build, test, and publish AI workflows in a visual studio. Turn prompts into tools and ship production-grade automation on Edgaze.",
    url: "https://edgaze.ai/builder",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workflow Builder",
    description:
      "Build, test, and publish AI workflows in a visual studio. Turn prompts into tools and ship production-grade automation on Edgaze.",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};
export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70 text-sm">Loading builder…</div>}>
      <BuilderClientPage />
    </Suspense>
  );
}
