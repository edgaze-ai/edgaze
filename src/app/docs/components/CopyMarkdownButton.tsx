"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyMarkdownButton({ body }: { title: string; body: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const markdown = body.trim();
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // swallow copy failures silently
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white/95 transition"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-300" />
          <span>Copied markdown</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-white/70" />
          <span>Copy markdown</span>
        </>
      )}
    </button>
  );
}
