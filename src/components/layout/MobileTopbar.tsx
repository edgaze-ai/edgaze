"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu, User, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { useSidebar } from "./SidebarContext";
import { useAuth } from "../auth/AuthContext";
import ProfileAvatar from "../ui/ProfileAvatar";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Avatar({
  name,
  url,
  size = 26, // ⬅️ reduced
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const px = `${size}px`;
  return (
    <div
      className="overflow-hidden rounded-full border border-white/12 bg-white/10"
      style={{ width: px, height: px }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white/80">
          {name?.[0]?.toUpperCase() ?? "E"}
        </div>
      )}
    </div>
  );
}

export default function MobileTopbar() {
  const { toggleMobile } = useSidebar();
  const { userId, profile, openSignIn, signOut } = useAuth();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (pillRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="md:hidden flex items-center justify-between px-3 h-14 border-b border-white/10 bg-[#050505]">
      {/* LEFT */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleMobile}
          aria-label="Open menu"
          className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-white/85 hover:bg-white/5 active:bg-white/10 active:scale-[0.98] transition"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-1">
          <div className="relative h-7 w-7">
            <Image
              src="/brand/edgaze-mark.png"
              alt="Edgaze"
              fill
              priority
              sizes="28px"
            />
          </div>
          <span className="text-[16px] font-semibold tracking-tight text-white">
            edgaze
          </span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="relative">
        {userId && profile ? (
          <>
            <button
              ref={pillRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open profile menu"
              className="inline-flex items-center justify-center rounded-full border border-gray-600/50 bg-white/5 p-1 hover:bg-white/10 transition"
            >
              <ProfileAvatar
                name={profile.full_name || profile.handle || "Profile"}
                avatarUrl={profile.avatar_url || null}
                size={26}
                handle={profile.handle}
                userId={userId}
                className="border-0"
              />
            </button>

            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-2 z-[90] w-52 overflow-hidden rounded-2xl border border-gray-600/50 bg-black/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5"
                >
                  <User className="h-4 w-4 text-white/60" />
                  View profile
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5"
                >
                  <LogOut className="h-4 w-4 text-white/60" />
                  Sign out
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={openSignIn}
            className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_18px_rgba(56,189,248,0.55)]"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
