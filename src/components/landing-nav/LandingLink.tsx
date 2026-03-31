"use client";

import type React from "react";
import { LANDING_SCROLL_OFFSET_PX, scrollToHashId } from "./hash-navigate";

export type LandingLinkProps = Pick<
  React.ComponentProps<"a">,
  "href" | "className" | "children" | "aria-label" | "rel" | "target" | "onClick"
> & {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  afterNavigate?: () => void;
};

export function LandingLink(props: LandingLinkProps) {
  const { scrollerRef, afterNavigate, href, className, children, onClick, ...rest } = props;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;

    if (typeof href === "string" && href.startsWith("#")) {
      e.preventDefault();
      scrollToHashId(scrollerRef.current, href, LANDING_SCROLL_OFFSET_PX);
    }
    afterNavigate?.();
  };

  return (
    <a href={href} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
