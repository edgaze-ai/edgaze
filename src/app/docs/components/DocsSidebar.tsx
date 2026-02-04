"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import type { DocMeta } from "../utils/docs";

export default function DocsSidebar({ docs }: { docs: DocMeta[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const isBuilderActive = useMemo(() => {
    return pathname.startsWith("/docs/builder");
  }, [pathname]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter((d) =>
      `${d.title} ${d.description} ${d.slug}`.toLowerCase().includes(s)
    );
  }, [q, docs]);

  // Separate builder docs from other docs
  const builderDocs = useMemo(
    () => filtered.filter((d) => d.category === "builder"),
    [filtered]
  );
  const otherDocs = useMemo(
    () => filtered.filter((d) => d.category !== "builder"),
    [filtered]
  );

  return (
    <div className="w-full">
      <div className="rounded-xl bg-white/[0.04] ring-1 ring-white/10">
        <div className="p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-full rounded-lg bg-black/30 ring-1 ring-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 outline-none focus:ring-white/20"
          />
        </div>

        <div className="px-3 pb-3">
          {/* Builder section */}
          {builderDocs.length > 0 && (
            <>
              <div className="px-1 py-2 text-[11px] uppercase tracking-wider text-white/35">
                Builder
              </div>
              <nav className="flex flex-col gap-1 mb-4">
                {builderDocs.map((d) => {
                  const href = d.slug === "builder" ? "/docs/builder" : `/docs/builder/${d.slug.split("/")[1]}`;
                  const active = pathname === href || (d.slug === "builder" && pathname.startsWith("/docs/builder") && !pathname.includes("/builder/"));
                  const isSubItem = d.slug !== "builder";

                  return (
                    <Link
                      key={d.slug}
                      href={href}
                      className={[
                        "rounded-lg px-3 py-2 transition",
                        active
                          ? "bg-white/10 ring-1 ring-white/10"
                          : "hover:bg-white/5",
                        isSubItem ? "ml-4" : "",
                      ].join(" ")}
                    >
                      <div className="text-sm font-medium text-white/90">
                        {d.title}
                      </div>
                      {d.description ? (
                        <div className="mt-0.5 text-xs text-white/45 line-clamp-2">
                          {d.description}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </>
          )}

          {/* Other docs section */}
          {otherDocs.length > 0 && (
            <>
              <div className="px-1 py-2 text-[11px] uppercase tracking-wider text-white/35">
                Resources
              </div>
              <nav className="flex flex-col gap-1">
                {otherDocs.map((d) => {
                  const href = `/docs/${d.slug}`;
                  const active = pathname === href;

                  return (
                    <Link
                      key={d.slug}
                      href={href}
                      className={[
                        "rounded-lg px-3 py-2 transition",
                        active
                          ? "bg-white/10 ring-1 ring-white/10"
                          : "hover:bg-white/5",
                      ].join(" ")}
                    >
                      <div className="text-sm font-medium text-white/90">
                        {d.title}
                      </div>
                      {d.description ? (
                        <div className="mt-0.5 text-xs text-white/45 line-clamp-2">
                          {d.description}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </>
          )}

          {filtered.length === 0 && (
            <div className="px-2 py-3 text-sm text-white/45">No results.</div>
          )}
        </div>
      </div>
    </div>
  );
}
