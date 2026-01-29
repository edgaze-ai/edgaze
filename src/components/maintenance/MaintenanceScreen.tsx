"use client";

import React from "react";
import { motion } from "framer-motion";
import { Construction } from "lucide-react";

export default function MaintenanceScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen flex-col items-center justify-center bg-[#0b0b0b] text-white">
      {/* Edgaze-style gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#07080b]" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 10%, rgba(34,211,238,0.22), transparent 46%), radial-gradient(circle at 82% 18%, rgba(236,72,153,0.18), transparent 46%), radial-gradient(circle at 55% 90%, rgba(34,211,238,0.08), transparent 52%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="mx-auto w-full max-w-lg px-5">
        <div className="overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 sm:p-8 relative">
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl opacity-30"
              style={{
                background:
                  "radial-gradient(circle, rgba(34,211,238,0.8), transparent 60%)",
              }}
              animate={{
                x: [0, 18, -6, 0],
                y: [0, 10, -8, 0],
                opacity: [0.24, 0.34, 0.26, 0.24],
              }}
              transition={{
                duration: 5.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute -bottom-28 -right-24 h-72 w-72 rounded-full blur-3xl opacity-25"
              style={{
                background:
                  "radial-gradient(circle, rgba(236,72,153,0.75), transparent 60%)",
              }}
              animate={{
                x: [0, -14, 8, 0],
                y: [0, -10, 12, 0],
                opacity: [0.22, 0.32, 0.24, 0.22],
              }}
              transition={{
                duration: 5.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.10]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
          </div>

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-6 flex items-center justify-center gap-2">
              <img
                src="/brand/edgaze-mark.png"
                alt=""
                className="h-10 w-10"
              />
              <span className="text-sm font-semibold tracking-wide text-white/90">
                Edgaze
              </span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1.5 text-xs text-white/70">
              <Construction className="h-4 w-4 text-white/75" />
              Platform under maintenance
            </div>

            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              We&apos;ll be back shortly
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
              We&apos;re performing scheduled maintenance. Please check back
              later.
            </p>

            <p className="mt-6 text-sm text-white/60">
              For support, email{" "}
              <a
                href="mailto:support@edgaze.ai"
                className="text-white/80 underline underline-offset-2 hover:text-white"
              >
                support@edgaze.ai
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
