"use client";

import React, { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  images: string[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  title?: string | null;
  onNavigate?: (direction: "previous" | "next", newIndex: number) => void;
};

/**
 * Full-screen image viewer for listing thumbnails / demo images (no navigation to raw storage URLs).
 */
export default function ListingImageLightbox({
  open,
  onClose,
  images,
  activeIndex,
  onActiveIndexChange,
  title,
  onNavigate,
}: Props) {
  const active = images[activeIndex] ?? null;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (images.length > 1) {
        if (e.key === "ArrowLeft") {
          const newIndex = activeIndex === 0 ? images.length - 1 : activeIndex - 1;
          onActiveIndexChange(newIndex);
          onNavigate?.("previous", newIndex);
        } else if (e.key === "ArrowRight") {
          const newIndex = activeIndex === images.length - 1 ? 0 : activeIndex + 1;
          onActiveIndexChange(newIndex);
          onNavigate?.("next", newIndex);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, images.length, activeIndex, onClose, onActiveIndexChange, onNavigate]);

  if (!open || !active) return null;

  const goPrev = () => {
    const newIndex = activeIndex === 0 ? images.length - 1 : activeIndex - 1;
    onActiveIndexChange(newIndex);
    onNavigate?.("previous", newIndex);
  };

  const goNext = () => {
    const newIndex = activeIndex === images.length - 1 ? 0 : activeIndex + 1;
    onActiveIndexChange(newIndex);
    onNavigate?.("next", newIndex);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/50 p-2 text-white hover:bg-white/10"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="relative flex max-h-[100vh] max-w-[100vw] items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-2 text-white hover:bg-white/10 sm:left-4"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        )}
        <img
          src={active}
          alt={title ? `${title} — image ${activeIndex + 1}` : `Image ${activeIndex + 1}`}
          className="max-h-[90vh] max-w-full object-contain"
        />
        {images.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-2 text-white hover:bg-white/10 sm:right-4"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        )}
      </div>
    </div>
  );
}
