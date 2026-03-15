"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  progress: number;
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="fixed left-0 right-0 top-0 z-50">
      {/* Glass background */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" />

      {/* Gradient line at top */}
      <div className="absolute left-0 right-0 top-0 h-[1px] bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500" />

      {/* Progress bar */}
      <div className="relative h-1 w-full overflow-hidden bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 shadow-[0_0_12px_rgba(56,189,248,0.6)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        />

        {/* Animated shimmer */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{
            x: ["-100%", "200%"],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ width: "50%" }}
        />
      </div>
    </div>
  );
}
