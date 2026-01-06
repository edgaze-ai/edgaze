// src/app/auth/callback/page.tsx
import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackClient />
    </Suspense>
  );
}
