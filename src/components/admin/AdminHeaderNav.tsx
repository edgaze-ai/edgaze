"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "./adminNav";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function AdminHeaderNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="flex max-w-[72vw] items-center gap-0.5 overflow-x-auto pb-0.5 lg:max-w-none [-webkit-overflow-scrolling:touch]">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap",
              active
                ? "bg-white/[0.1] text-white border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                : "text-white/90 hover:bg-white/[0.06] hover:text-white border border-transparent",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
