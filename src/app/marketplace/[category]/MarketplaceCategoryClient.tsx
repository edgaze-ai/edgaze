"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function MarketplaceCategoryClient() {
  const params = useParams<{ category: string }>();
  const router = useRouter();
  const category = params?.category;

  useEffect(() => {
    if (!category) return;
    router.replace(`/marketplace?topic=${encodeURIComponent(category)}`);
  }, [category, router]);

  const label = category ? category.replace(/-/g, " ") : "marketplace";
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-white/80 text-lg">
        Browse {label} workflows and prompts on the Edgaze marketplace.
      </p>
      <Link
        href={`/marketplace?topic=${encodeURIComponent(category ?? "")}`}
        className="text-cyan-400 hover:text-cyan-300 font-medium underline"
      >
        Open marketplace →
      </Link>
    </div>
  );
}
