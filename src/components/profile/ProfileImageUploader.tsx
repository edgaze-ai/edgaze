"use client";

import React, { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../auth/AuthContext";
import { compressImageToMaxSize } from "../../lib/compressImage";

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

    const maxBytes = kind === "avatar" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

    setBusy(true);
    try {
      const toUpload = await compressImageToMaxSize(file, maxBytes);

      const bucket = kind === "avatar" ? "avatars" : "banners";
      const ext = extFromName(file.name);
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, toUpload, {
        cacheControl: "3600",
        upsert: false,
        contentType: toUpload.type || file.type,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const patch = kind === "avatar" ? { avatar_url: publicUrl } : { banner_url: publicUrl };

      const res = await updateProfile(patch as any);
      if (!res.ok) throw new Error(res.error || "Failed to update profile");

      onDone?.(publicUrl);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const inputId = `profile-upload-${kind}-${userId || "anon"}`;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className={`
          inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90
          transition-all hover:border-cyan-500/40 hover:bg-white/10 hover:text-white
          disabled:pointer-events-none disabled:opacity-50
        `}
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.currentTarget.value = "";
          }}
          className="sr-only"
        />
        {busy ? (
          <>
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Uploading…
          </>
        ) : (
          <>Choose photo</>
        )}
      </label>

      {err && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}
    </div>
  );
}
