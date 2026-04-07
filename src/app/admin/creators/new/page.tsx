"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";
const inputClass =
  "w-full rounded-lg border border-white/[0.12] bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50";

export default function AdminNewCreatorPage() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [target_email, setTargetEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [full_name, setFullName] = useState("");
  const [bio, setBio] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/creators", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          target_email: target_email.trim().toLowerCase(),
          handle: handle.trim(),
          full_name: full_name.trim(),
          bio: bio.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const id = data.profile?.id;
      if (id) router.push(`/admin/creators/${id}`);
      else router.push("/admin/creators");
    } catch (err: any) {
      setError(err?.message || "Provisioning failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/admin/creators"
        className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to list
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-white">Provision creator workspace</h1>
        <p className="mt-1 text-sm text-white/50">
          Creates a dormant auth user and profile. Send a claim link from the detail page.
        </p>
      </div>

      <form onSubmit={onSubmit} className={`${cardClass} p-6 space-y-4`}>
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/60">Contact email</label>
          <input
            type="email"
            required
            className={inputClass}
            value={target_email}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="creator@example.com"
          />
          <p className="mt-1 text-[11px] text-white/35">
            Private — used for claim link validation.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/60">Handle</label>
          <input
            className={inputClass}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="creator_handle"
            required
            pattern="[a-z0-9_]{3,24}"
            title="3–24 chars: lowercase letters, numbers, underscore"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/60">Display name</label>
          <input
            className={inputClass}
            value={full_name}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="River Kim"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/60">Bio (optional)</label>
          <textarea
            className={`${inputClass} min-h-[88px] resize-y`}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short bio…"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create workspace
        </button>
      </form>
    </div>
  );
}
