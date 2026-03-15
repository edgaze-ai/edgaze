"use client";

import { usePathname } from "next/navigation";
import GlobalLoadingScreen from "./GlobalLoadingScreen";
import { MinimalLoadingFallback } from "./GlobalLoadingScreen";

/**
 * Shows branded loading only for landing (/) and product pages (/:a/:b and /p/:a/:b).
 * All other routes get a minimal spinner.
 */
export default function RouteAwareLoading() {
  const pathname = usePathname() ?? "/";

  // Landing page
  if (pathname === "/") return <GlobalLoadingScreen />;

  // Product pages: /owner/code or /p/owner/code
  const segments = pathname.split("/").filter(Boolean);
  const isProductPage = segments.length === 2 || (segments.length === 3 && segments[0] === "p");

  return isProductPage ? <GlobalLoadingScreen /> : <MinimalLoadingFallback />;
}
