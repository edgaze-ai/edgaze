"use client";

import { AlertTriangle } from "lucide-react";
import { NODE_STYLES } from "./nodeStyles";

type NodeErrorBannerProps = {
  errorMessage?: string;
};

export function NodeErrorBanner({ errorMessage }: NodeErrorBannerProps) {
  if (!errorMessage) return null;

  const truncated =
    errorMessage.length > NODE_STYLES.errorBanner.maxChars
      ? errorMessage.slice(0, NODE_STYLES.errorBanner.maxChars) + "…"
      : errorMessage;

  return (
    <div
      className="flex items-center gap-2 node-error-banner"
      style={{
        background: NODE_STYLES.errorBanner.background,
        borderBottom: NODE_STYLES.errorBanner.borderBottom,
        fontSize: NODE_STYLES.errorBanner.fontSize,
        color: NODE_STYLES.errorBanner.color,
        padding: NODE_STYLES.errorBanner.padding,
      }}
    >
      <AlertTriangle size={12} className="shrink-0" aria-hidden />
      <span className="truncate">{truncated}</span>
    </div>
  );
}
