"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

export default function ProfileMenu() {
  const router = useRouter();
  const { user, openSignIn, signOut } = useAuth();

  // Logged out: show a Sign in pill instead of disappearing
  if (!user) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.08] hover:border-cyan-400 transition-colors"
      >
        <span className="h-6 w-6 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-pink-400 flex items-center justify-center text-[11px] font-semibold text-black">
          EZ
        </span>
        <span>Sign in</span>
      </button>
    );
  }

  const avatarSrc = user.image ?? "/brand/edgaze-mark.png";

  const handleOpenProfile = () => {
    router.push("/profile");
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Main pill – click to open profile */}
      <button
        type="button"
        onClick={handleOpenProfile}
        className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm text-white hover:border-cyan-400 hover:bg-white/[0.08] transition-colors"
      >
        <div className="relative h-7 w-7 rounded-full overflow-hidden flex-shrink-0">
          <Image
            src={avatarSrc}
            alt={user.name ?? "Profile"}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium leading-tight">
            {user.name ?? "Creator"}
          </span>
          <span className="text-[11px] text-white/55 leading-tight">
            {user.plan ?? "Free"} plan
          </span>
        </div>
      </button>

      {/* Small sign out text button */}
      <button
        type="button"
        onClick={handleSignOut}
        className="text-[11px] text-white/50 hover:text-red-300 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
