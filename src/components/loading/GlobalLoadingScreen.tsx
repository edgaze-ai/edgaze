"use client";

import React from "react";
import Image from "next/image";

/**
 * GlobalLoadingScreen - Premium loading experience for Edgaze
 * Shows a branded loading screen instead of black screen during initial page load
 */
export default function GlobalLoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#07080b]">
      {/* Background gradients matching main app */}
      <div className="fixed inset-0 -z-10 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%),radial-gradient(circle_at_55%_90%,rgba(34,211,238,0.08),transparent_52%)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
      
      {/* Loading content */}
      <div className="flex flex-col items-center justify-center gap-6">
        {/* Logo with glow effect */}
        <div className="relative">
          <div className="absolute -inset-8 rounded-full blur-3xl opacity-60 animate-pulse [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.35),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.28),transparent_62%)]" />
          <div className="relative h-16 w-16 sm:h-20 sm:w-20">
            <Image 
              src="/brand/edgaze-mark.png" 
              alt="Edgaze" 
              width={80}
              height={80}
              className="h-full w-full"
              priority
              quality={100}
            />
          </div>
        </div>
        
        {/* Brand name */}
        <div className="text-xl sm:text-2xl font-semibold tracking-tight text-white/95">
          Edgaze
        </div>
        
        {/* Loading indicator */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-[pulse_1.4s_ease-in-out_infinite]" />
          <div className="h-2 w-2 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
          <div className="h-2 w-2 rounded-full bg-pink-400 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
        
        {/* Loading text */}
        <div className="text-sm text-white/50 animate-pulse">
          Loading...
        </div>
      </div>
    </div>
  );
}

/**
 * MinimalLoadingScreen - Ultra-lightweight loading for fastest possible display
 * This can be inlined in HTML for instant visibility
 */
export function MinimalLoadingScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#07080b',
      zIndex: 9999,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
      }}>
        <img 
          src="/brand/edgaze-mark.png" 
          alt="Edgaze" 
          style={{
            width: '64px',
            height: '64px',
            imageRendering: 'crisp-edges',
          }}
        />
        <div style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.95)',
          letterSpacing: '-0.01em',
        }}>
          Edgaze
        </div>
        <div style={{
          display: 'flex',
          gap: '8px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#22d3ee',
            animation: 'pulse 1.4s ease-in-out infinite',
          }} />
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#e879f9',
            animation: 'pulse 1.4s ease-in-out 0.2s infinite',
          }} />
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#ec4899',
            animation: 'pulse 1.4s ease-in-out 0.4s infinite',
          }} />
        </div>
      </div>
    </div>
  );
}
