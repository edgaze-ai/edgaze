"use client";

import type { ComponentType } from "react";
import {
  FaGithub,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";

/** Matches `Footer.tsx` icon set (Fa6 + 18px footprint). */

const DEFAULT_ICON_CLASS = "h-[18px] w-[18px] shrink-0";

function IconWrap({
  Icon,
  className,
}: {
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  className?: string;
}) {
  return <Icon className={className || DEFAULT_ICON_CLASS} aria-hidden />;
}

export function ProfileSocialIcon({ kind, className }: { kind: string; className?: string }) {
  const k = (kind || "").toLowerCase();
  switch (k) {
    case "twitter":
      return <IconWrap Icon={FaXTwitter} className={className} />;
    case "linkedin":
      return <IconWrap Icon={FaLinkedinIn} className={className} />;
    case "github":
      return <IconWrap Icon={FaGithub} className={className} />;
    case "youtube":
      return <IconWrap Icon={FaYoutube} className={className} />;
    case "instagram":
      return <IconWrap Icon={FaInstagram} className={className} />;
    case "website":
    default:
      return <IconWrap Icon={FaGlobe} className={className} />;
  }
}
