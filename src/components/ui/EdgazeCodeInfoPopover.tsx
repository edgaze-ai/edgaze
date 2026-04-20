"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const DOCS_HREF = "/docs/edgaze-code";
const SUMMARY =
  "Edgaze Code is a short creator-defined keyword that lets anyone go to edgaze.ai, type the code, and instantly open the exact workflow or prompt without relying on external links.";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function EdgazeCodeInfoPopover({
  className,
  panelClassName,
}: {
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 140);
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearCloseTimer();
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("relative shrink-0", className)}
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-label="What is Edgaze Code?"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center bg-transparent text-white/88 shadow-none",
          "transition-colors duration-200 hover:text-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b10]",
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <Info className="h-4.5 w-4.5" />
      </button>

      <div
        id={panelId}
        role="dialog"
        aria-label="About Edgaze Code"
        className={cn(
          "absolute right-0 top-full z-[220] mt-2 w-[290px] rounded-2xl",
          "border border-white/10 bg-black p-3.5 shadow-[0_24px_80px_rgba(0,0,0,0.58)]",
          "transition-all duration-150 ease-out",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
          panelClassName,
        )}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]"
        />
        <p className="pr-2 text-[12px] leading-[1.55] text-white/76">{SUMMARY}</p>
        <Link
          href={DOCS_HREF}
          className="mt-3 inline-flex items-center text-[12px] font-medium text-cyan-200/92 transition-colors hover:text-cyan-100"
          onClick={() => setOpen(false)}
        >
          Learn more
        </Link>
      </div>
    </div>
  );
}
