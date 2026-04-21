"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { normalizeImageSrc } from "../../lib/normalize-image-src";

const SHARED_LINK_PREFETCH = process.env.NODE_ENV === "development" ? false : null;

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function AvatarImageOrFallback({
  avatarUrl,
  name,
  showFallback,
  fontSize,
}: {
  avatarUrl: string;
  name: string | null | undefined;
  showFallback: boolean;
  fontSize: string;
}) {
  const [imageError, setImageError] = useState(false);
  const initials = useMemo(() => initialsFromName(name), [name]);
  const normalizedAvatarUrl = useMemo(() => normalizeImageSrc(avatarUrl), [avatarUrl]);

  if (imageError || !normalizedAvatarUrl) {
    return showFallback ? (
      <div className="flex h-full w-full items-center justify-center bg-gray-600 text-white/80">
        <span className={cn("font-semibold", fontSize)}>{initials}</span>
      </div>
    ) : null;
  }

  return (
    <img
      src={normalizedAvatarUrl}
      alt={name || "Profile"}
      className="h-full w-full object-cover"
      onError={() => setImageError(true)}
    />
  );
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
  const initials = useMemo(() => initialsFromName(name), [name]);
  const normalizedAvatarUrl = useMemo(() => normalizeImageSrc(avatarUrl), [avatarUrl]);

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
        className,
      )}
      style={{ width: px, height: px }}
    >
      {normalizedAvatarUrl ? (
        <AvatarImageOrFallback
          key={normalizedAvatarUrl}
          avatarUrl={normalizedAvatarUrl}
          name={name}
          showFallback={showFallback}
          fontSize={fontSize}
        />
      ) : showFallback ? (
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
        prefetch={SHARED_LINK_PREFETCH}
        className="cursor-pointer"
        aria-label={`View ${name || "profile"}`}
      >
        {avatarContent}
      </Link>
    );
  }

  return avatarContent;
}
