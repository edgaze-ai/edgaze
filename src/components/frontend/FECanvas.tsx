// src/components/frontend/FECanvas.tsx
"use client";

import React, { forwardRef, useEffect, useImperativeHandle } from "react";

/** ===== Types (kept for compatibility with existing imports) ===== */
export type BlockType = "text" | "button" | "image";

export type BlockBase = {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TextBlock = BlockBase & {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
};

export type ButtonBlock = BlockBase & {
  type: "button";
  label: string;
  fill: string;
  color: string;
  fontSize: number;
  radius: number;
};

export type ImageBlock = BlockBase & {
  type: "image";
  src: string;
  fit: "cover" | "contain";
};

export type Block = TextBlock | ButtonBlock | ImageBlock;

export type Strip = {
  id: string;
  height: number;
  blocks: Block[];
};

/** ===== Public ref API (kept for compatibility) ===== */
export type FECanvasRef = {
  addStrip: () => void;
  addBlock: (kind: BlockType) => void;
  getDesign: () => Strip[];
};

/** ===== Component (stubbed; frontend canvas removed for now) ===== */
const FECanvas = forwardRef<
  FECanvasRef,
  {
    onSelectionChange?: (sel: Block | null) => void;
  }
>(function FECanvas({ onSelectionChange }, ref) {
  // Expose a stable API so callers don’t crash.
  useImperativeHandle(
    ref,
    () => ({
      addStrip: () => {
        /* no-op (frontend removed) */
      },
      addBlock: (_kind: BlockType) => {
        /* no-op (frontend removed) */
      },
      getDesign: () => [],
    }),
    []
  );

  // Let parents reset inspector state if they were listening.
  useEffect(() => {
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  // Render nothing (no UI, no layout impact).
  return null;
});

export default FECanvas;
