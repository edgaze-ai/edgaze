import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import PublicProfileView from "../../../components/profile/PublicProfileView";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import {
  getProfileRedirectHandle,
  getProfileRedirectByOwnerHandle,
} from "../../../lib/supabase/handle-redirect";

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

  const supabase = createSupabaseAdminClient();
  // Case-insensitive lookup so /profile/MyHandle works when DB has "myhandle"
  const { data: profileData } = await supabase.rpc("get_profile_by_handle_insensitive", {
    handle_input: handle,
  });
  const profileRow = Array.isArray(profileData) ? profileData[0] : profileData;
  const profileId = profileRow?.id;
  const canonicalHandle = profileRow?.handle;

  if (!profileId) {
    // Try redirect: handle_history first, then fallback from workflows/prompts (for manual DB updates)
    let newHandle = await getProfileRedirectHandle(handle);
    if (!newHandle) newHandle = await getProfileRedirectByOwnerHandle(handle);
    if (newHandle) redirect(`/profile/${encodeURIComponent(newHandle)}`);

    // No profile and no redirect: show not found
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white/90">Profile not found.</div>
          <div className="mt-2 text-xs text-white/55">
            No profile exists for @{handle}. The link may be broken or the account may have been removed.
          </div>
          <Link
            href="/marketplace"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Browse marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PublicProfileView handle={canonicalHandle ?? handle} debug={debug} />
  );
}
