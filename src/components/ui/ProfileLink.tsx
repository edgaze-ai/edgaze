"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import VerifiedCreatorBadge from "./VerifiedCreatorBadge";

type ProfileLinkProps = {
  name: string | null | undefined;
  handle?: string | null;
  userId?: string | null;
  href?: string | null;
  className?: string;
  linkClassName?: string;
  /** Edgaze verified creator (identity + quality reviewed). */
  verified?: boolean;
  verifiedSize?: "xs" | "sm" | "md";
  children?: React.ReactNode;
  onClick?: () => void;
};

export default function ProfileLink({
  name,
  handle,
  userId,
  href,
  className,
  linkClassName,
  verified = false,
  verifiedSize = "sm",
  children,
  onClick,
}: ProfileLinkProps) {
  const profileHref = useMemo(() => {
    if (href) return href;
    if (handle) return `/profile/@${handle}`;
    if (userId) return `/profile?id=${encodeURIComponent(userId)}`;
    return null;
  }, [href, handle, userId]);

  const nameClasses = cn("min-w-0 truncate", className);

  const nameEl = children ?? <span className={nameClasses}>{name || "Creator"}</span>;
  const content = verified ? (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      {nameEl}
      <VerifiedCreatorBadge size={verifiedSize} variant="mark" />
    </span>
  ) : (
    nameEl
  );

  const linkClasses = cn("cursor-pointer hover:opacity-80 transition-opacity", linkClassName);

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={linkClasses}>
        {content}
      </button>
    );
  }

  if (profileHref) {
    return (
      <Link href={profileHref} className={linkClasses}>
        {content}
      </Link>
    );
  }

  return <span className={className}>{content}</span>;
}
