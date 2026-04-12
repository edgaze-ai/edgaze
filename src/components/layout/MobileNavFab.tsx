"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

/**
 * Replaces the tall mobile topbar: one compact control to open the nav drawer.
 */
export default function MobileNavFab() {
  const { toggleMobile } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleMobile}
      aria-label="Open navigation menu"
      className="fixed z-[85] flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[#0b0b0b]/95 text-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md transition hover:bg-white/[0.06] hover:text-white active:scale-[0.98] md:hidden"
      style={{
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        left: "max(0.75rem, env(safe-area-inset-left))",
      }}
    >
      <Menu className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}
