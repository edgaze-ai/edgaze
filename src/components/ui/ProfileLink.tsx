"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import FoundingCreatorBadge from "./FoundingCreatorBadge";

type ProfileLinkProps = {
  name: string | null | undefined;
  handle?: string | null;
  userId?: string | null;
  href?: string | null;
  className?: string;
  showBadge?: boolean;
  badgeSize?: "xs" | "sm" | "md" | "lg";
  badgeCompact?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
};

export default function ProfileLink({
  name,
  handle,
  userId,
  href,
  className,
  showBadge = false,
  badgeSize = "sm",
  badgeCompact = false,
  children,
  onClick,
}: ProfileLinkProps) {
  const profileHref = useMemo(() => {
    if (href) return href;
    if (handle) return `/profile/@${handle}`;
    if (userId) return `/profile?id=${encodeURIComponent(userId)}`;
    return null;
  }, [href, handle, userId]);

  const content = (
    <>
      {children || <span className={cn("min-w-0 truncate", className)}>{name || "Creator"}</span>}
      {showBadge && <FoundingCreatorBadge size={badgeSize} compact={badgeCompact} className="shrink-0" />}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        {content}
      </button>
    );
  }

  if (profileHref) {
    return (
      <Link
        href={profileHref}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return <span className={className}>{content}</span>;
}
