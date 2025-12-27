"use client";

import React from "react";

function safeJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function DebugPanel({
  title,
  data,
}: {
  title: string;
  data: any;
}) {
  return (
    <div className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-semibold text-white/80">{title}</div>
      <pre className="mt-2 max-h-[340px] overflow-auto rounded-xl bg-black/40 p-3 text-[11px] leading-snug text-white/70">
        {safeJson(data)}
      </pre>
    </div>
  );
}
