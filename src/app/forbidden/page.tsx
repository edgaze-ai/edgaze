// src/app/forbidden/page.tsx
import { Suspense } from "react";
import ForbiddenClient from "./ForbiddenClient";

export default function ForbiddenPage() {
  return (
    <Suspense fallback={null}>
      <ForbiddenClient />
    </Suspense>
  );
}
