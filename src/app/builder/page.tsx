// src/app/builder/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import BuilderClientPage from "./BuilderClientPage";

export const metadata: Metadata = {
  title: "Workflow Builder | Edgaze",
  description:
    "Build, test, and publish AI workflows in a visual studio. Turn prompts into tools and ship production-grade automation on Edgaze.",
  openGraph: {
    title: "Workflow Builder | Edgaze",
    description:
      "Build, test, and publish AI workflows in a visual studio. Turn prompts into tools and ship production-grade automation on Edgaze.",
    url: "https://edgaze.ai/builder",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workflow Builder | Edgaze",
    description:
      "Build, test, and publish AI workflows in a visual studio. Turn prompts into tools and ship production-grade automation on Edgaze.",
    images: ["/og.png"],
  },
};
export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70 text-sm">Loading builder…</div>}>
      <BuilderClientPage />
    </Suspense>
  );
}
