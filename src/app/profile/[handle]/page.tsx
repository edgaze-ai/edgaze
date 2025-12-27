import React from "react";
import Link from "next/link";
import PublicProfileView from "../../../components/profile/PublicProfileView";

function normalizeHandle(raw: string) {
  const decoded = decodeURIComponent(raw || "").trim();
  const stripped = decoded.startsWith("@") ? decoded.slice(1).trim() : decoded;
  return stripped;
}

function isDebugOn(searchParams: any) {
  const v = searchParams?.debug;
  if (v === "1") return true;
  if (Array.isArray(v) && v.includes("1")) return true;
  return false;
}

export default async function ProfileByHandlePage(props: any) {
  // Next can treat these as async depending on version/flags; read defensively.
  const params = await props.params;
  const searchParams = await props.searchParams;

  const raw = (params?.handle ?? "") as string;
  const handle = normalizeHandle(raw);

  const debug = isDebugOn(searchParams);

  if (!handle) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white/90">Invalid profile link</div>
          <div className="mt-2 text-xs text-white/55">
            This URL doesn’t include a valid handle.
          </div>

          {debug && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/70">
              <div>raw params.handle: {String(params?.handle)}</div>
              <div>normalized handle: {handle || "(empty)"}</div>
            </div>
          )}

          <Link
            href="/profile"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Go to my profile
          </Link>
        </div>
      </div>
    );
  }

  // This is client component; passing debug down enables the debug panels inside it.
  return <PublicProfileView handle={handle} debug={debug} />;
}
