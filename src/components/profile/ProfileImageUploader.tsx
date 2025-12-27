"use client";

import React, { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../auth/AuthContext";

function extFromName(name: string) {
  const p = name.split(".").pop();
  return (p || "jpg").toLowerCase();
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

export default function ProfileImageUploader({
  kind, // "avatar" | "banner"
  onDone,
}: {
  kind: "avatar" | "banner";
  onDone?: (publicUrl: string) => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, updateProfile, requireAuth } = useAuth();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = "image/png,image/jpeg,image/webp";

  const upload = async (file: File) => {
    setErr(null);

    if (!requireAuth() || !userId) return;
    if (!isImage(file)) {
      setErr("Only image files are allowed.");
      return;
    }

    // Hard limits
    const maxBytes = kind === "avatar" ? 4 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErr(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB.`);
      return;
    }

    setBusy(true);
    try {
      const bucket = "profile-media";
      const ext = extFromName(file.name);
      const path =
        kind === "avatar"
          ? `avatars/${userId}/${crypto.randomUUID()}.${ext}`
          : `banners/${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const patch =
        kind === "avatar" ? { avatar_url: publicUrl } : { banner_url: publicUrl };

      const res = await updateProfile(patch as any);
      if (!res.ok) throw new Error(res.error || "Failed to update profile");

      onDone?.(publicUrl);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.currentTarget.value = "";
        }}
        className="block w-full text-xs text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:brightness-110"
      />

      {busy && (
        <div className="text-[11px] text-white/55">Uploading…</div>
      )}
      {err && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {err}
        </div>
      )}
    </div>
  );
}
