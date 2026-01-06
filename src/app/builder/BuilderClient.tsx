// src/app/builder/BuilderClientPage.tsx
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

// ✅ move ALL your current builder page imports + code here
// Example: if you had these in page.tsx before, keep them here:
// import ReactFlowCanvas from "../../components/builder/ReactFlowCanvas";
// import InspectorPanel from "../../components/builder/InspectorPanel";
// etc...

export default function BuilderClientPage() {
  const searchParams = useSearchParams();

  // ✅ move your old logic that used searchParams here
  // const workflowId = searchParams.get("id");

  // ✅ paste your old JSX return from page.tsx here
  return (
    <div className="min-h-screen">
      {/* paste the original builder UI here */}
    </div>
  );
}
