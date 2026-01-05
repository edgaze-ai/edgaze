"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth/AuthContext";

export default function SettingsPage() {
  const router = useRouter();
  const { userId, userEmail, profile, isVerified, loading, authReady, signOut } = useAuth();

  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.handle) return `@${profile.handle}`;
    if (userEmail) return userEmail;
    return "Creator";
  }, [profile?.full_name, profile?.handle, userEmail]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-white/60">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-white/60 text-sm mb-6">Account and basic preferences</p>

        {/* Account */}
        <div className="edge-glass edge-border rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">Account</h2>
              <p className="text-white/50 text-sm mt-1">Signed in as</p>
            </div>

            <div className="text-right">
              <div className="text-white font-medium">{displayName}</div>
              <div className="text-white/50 text-xs mt-1 break-all">{userEmail ?? "—"}</div>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-white/60">User ID</span>
              <span className="text-white/70 text-xs break-all">{userId ?? "—"}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-white/60">Handle</span>
              <span className="text-white">{profile?.handle ? `@${profile.handle}` : "—"}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-white/60">Plan</span>
              <span className="text-white">{profile?.plan ?? "Free"}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-white/60">Email verified</span>
              <span className={isVerified ? "text-emerald-400" : "text-amber-300"}>
                {isVerified ? "Verified" : "Not verified"}
              </span>
            </div>
          </div>
        </div>

        {/* Preferences (UI-only for now) */}
        <div className="edge-glass edge-border rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-medium mb-4">Preferences</h2>

          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Email notifications</span>
              <span className="text-white/40 text-xs">Coming soon</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">Product updates</span>
              <span className="text-white/40 text-xs">Coming soon</span>
            </div>
          </div>
        </div>

        {/* Account actions */}
        <div className="edge-glass edge-border rounded-2xl p-5">
          <h2 className="text-lg font-medium mb-4 text-red-400">Account actions</h2>

          <button
            onClick={handleSignOut}
            className="w-full rounded-xl px-4 py-3 text-sm font-medium
                       bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
          >
            Sign out
          </button>
        </div>

        <p className="text-center text-white/30 text-xs mt-8">
          © {new Date().getFullYear()} Edgaze. All rights reserved.
        </p>
      </div>
    </div>
  );
}
