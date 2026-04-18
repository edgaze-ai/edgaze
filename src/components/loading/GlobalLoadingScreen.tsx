"use client";

import React from "react";
import Image from "next/image";

/**
 * GlobalLoadingScreen - Premium loading experience for Edgaze
 * Shows a branded loading screen instead of black screen during initial page load
 */
export default function GlobalLoadingScreen() {
  // CRITICAL: every visual size below uses inline styles. Tailwind/CSS may not be ready
  // during HMR or initial RSC swaps; without this, the 1024×1024 PNG renders at intrinsic
  // size on a white body (the "raw structure flash" you see during `Compiling…`).
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#07080b",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ position: "relative", width: 80, height: 80 }}>
          <Image
            src="/brand/edgaze-mark.png"
            alt="Edgaze"
            width={80}
            height={80}
            style={{ width: 80, height: 80, display: "block" }}
            priority
          />
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "rgba(255,255,255,0.95)",
          }}
        >
          Edgaze
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#22d3ee",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#a78bfa",
              animation: "pulse 1.4s ease-in-out 0.2s infinite",
            }}
          />
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#ec4899",
              animation: "pulse 1.4s ease-in-out 0.4s infinite",
            }}
          />
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Loading...</div>
      </div>
    </div>
  );
}

/**
 * MinimalLoadingFallback - Simple spinner for non-landing/product pages
 * No branded animation - used for builder, marketplace, layout gate, etc.
 */
export function MinimalLoadingFallback() {
  // Inline styles only — must render correctly even before Tailwind CSS is loaded.
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          border: "2px solid rgba(255,255,255,0.2)",
          borderTopColor: "rgba(255,255,255,0.8)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

/**
 * MinimalLoadingScreen - Ultra-lightweight loading for fastest possible display
 * This can be inlined in HTML for instant visibility
 */
export function MinimalLoadingScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#07080b",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <img
          src="/brand/edgaze-mark.png"
          alt="Edgaze"
          style={{
            width: "64px",
            height: "64px",
            imageRendering: "crisp-edges",
          }}
        />
        <div
          style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            letterSpacing: "-0.01em",
          }}
        >
          Edgaze
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#22d3ee",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#e879f9",
              animation: "pulse 1.4s ease-in-out 0.2s infinite",
            }}
          />
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#ec4899",
              animation: "pulse 1.4s ease-in-out 0.4s infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}
