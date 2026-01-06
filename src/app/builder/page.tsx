// src/app/builder/page.tsx
import { Suspense } from "react";
import BuilderClientPage from "./BuilderClientPage";
export const metadata = {
  title: "Workflow Builder",
  description: "The place to build your workflows.",
};
export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70 text-sm">Loading builder…</div>}>
      <BuilderClientPage />
    </Suspense>
  );
}
