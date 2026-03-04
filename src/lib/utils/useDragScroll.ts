"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Enables click-and-drag horizontal scrolling (like Figma/Notion).
 * Uses document-level listeners so drag continues when cursor leaves the element.
 * Touch scrolling remains native.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // left click only
    const el = ref.current;
    if (!el) return;
    isDown.current = true;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
    startX.current = e.pageX;
    scrollStart.current = el.scrollLeft;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDown.current) return;
      const el = ref.current;
      if (!el) return;
      e.preventDefault();
      const walk = (e.pageX - startX.current) * 1.2;
      el.scrollLeft = scrollStart.current - walk;
    };

    const onUp = () => {
      const el = ref.current;
      if (el) {
        el.style.cursor = "grab";
        el.style.userSelect = "";
      }
      isDown.current = false;
    };

    document.addEventListener("mousemove", onMove, { capture: true, passive: false });
    document.addEventListener("mouseup", onUp, { capture: true });
    return () => {
      document.removeEventListener("mousemove", onMove, { capture: true });
      document.removeEventListener("mouseup", onUp, { capture: true });
    };
  }, []);

  return {
    ref,
    dragHandlers: {
      onMouseDown,
    },
  };
}
