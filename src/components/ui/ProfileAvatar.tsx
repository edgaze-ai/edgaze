"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

type ProfileAvatarProps = {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  handle?: string | null;
  userId?: string | null;
  showFallback?: boolean;
  onClick?: () => void;
  href?: string | null;
};

export default function ProfileAvatar({
  name,
  avatarUrl,
  size = 36,
  className,
  handle,
  userId,
  showFallback = true,
  onClick,
  href,
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const initials = useMemo(() => initialsFromName(name), [name]);

  const profileHref = useMemo(() => {
    if (href) return href;
    if (handle) return `/profile/@${handle}`;
    if (userId) return `/profile?id=${encodeURIComponent(userId)}`;
    return null;
  }, [href, handle, userId]);

  const px = `${size}px`;
  const fontSize = size <= 24 ? "text-[10px]" : size <= 32 ? "text-[11px]" : "text-xs";

  const avatarContent = (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-full border border-white/10 bg-gray-600 relative",
        className
      )}
      style={{ width: px, height: px }}
    >
      {avatarUrl && !imageError ? (
        // Show image with fallback while loading
        <>
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-600 text-white/80 z-10">
              <span className={cn("font-semibold", fontSize)}>{initials}</span>
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={name || "Profile"}
            className="h-full w-full object-cover"
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
            loading="lazy"
          />
        </>
      ) : showFallback ? (
        // Show fallback initials
        <div className="flex h-full w-full items-center justify-center bg-gray-600 text-white/80">
          <span className={cn("font-semibold", fontSize)}>{initials}</span>
        </div>
      ) : null}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer"
        aria-label={`View ${name || "profile"}`}
      >
        {avatarContent}
      </button>
    );
  }

  if (profileHref) {
    return (
      <Link
        href={profileHref}
        className="cursor-pointer"
        aria-label={`View ${name || "profile"}`}
      >
        {avatarContent}
      </Link>
    );
  }

  return avatarContent;
}
