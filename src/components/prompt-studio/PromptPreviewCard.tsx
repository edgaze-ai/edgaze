// src/components/prompt-studio/PromptPreviewCard.tsx
"use client";

import React, { useMemo } from "react";

type Props = {
  title: string;
  description: string;
  tags: string;
  priceUsd?: string | null;
  isPaid: boolean;
  ownerName?: string | null;
  edgazeCode?: string | null;
  thumbnailUrl?: string | null;
  promptText: string;
  viewCount: number;
  likeCount: number;
};

function buildBlurredPromptImage(promptText: string): string {
  // Fake "image" by drawing prompt text and blurring it
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.5, "#020617");
  gradient.addColorStop(1, "#0f172a");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.85;
  ctx.font = "bold 120px system-ui, -apple-system, BlinkMacSystemFont";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = (promptText || "EDGAZE PROMPT").slice(0, 320);
  const chunks = text.match(/.{1,24}/g) ?? [];
  const totalHeight = chunks.length * 130;
  const startY = canvas.height / 2 - totalHeight / 2;

  chunks.forEach((chunk, idx) => {
    ctx.fillText(chunk.toUpperCase(), canvas.width / 2, startY + idx * 130);
  });

  ctx.filter = "blur(26px)";
  const blurred = canvas.toDataURL("image/jpeg", 0.85);
  return blurred;
}

export default function PromptPreviewCard(props: Props) {
  const {
    title,
    description,
    tags,
    priceUsd,
    isPaid,
    ownerName,
    edgazeCode,
    thumbnailUrl,
    promptText,
    viewCount,
    likeCount,
  } = props;

  const autoThumbnail = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildBlurredPromptImage(promptText);
  }, [promptText]);

  const finalThumb = thumbnailUrl || autoThumbnail || undefined;

  const tagList = (tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-white/[0.02] p-3 text-[11px] text-white">
      <div className="relative mb-3 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 flex w-full items-stretch justify-between">
          <div className="w-1/3 bg-cyan-500/40" />
          <div className="w-1/3 bg-transparent" />
          <div className="w-1/3 bg-pink-500/40" />
        </div>
        <div className="relative m-3 rounded-2xl bg-black/40 p-0.5 backdrop-blur-xl">
          {finalThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={finalThumb}
              alt=""
              className="h-36 w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-36 w-full items-center justify-center rounded-2xl bg-slate-900/80 text-[10px] text-white/50">
              Auto thumbnail
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <div className="truncate text-xs font-semibold">{title}</div>
            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] text-sky-200">
              Prompt
            </span>
          </div>

          <div className="mb-1 flex items-center gap-2 text-[10px] text-white/55">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold">
              {(ownerName || "?")
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <span className="truncate">{ownerName}</span>
          </div>

          <p className="mb-2 line-clamp-2 text-[10px] text-white/65">
            {description}
          </p>

          <div className="mb-2 flex flex-wrap gap-1">
            {tagList.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/70"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-white/55">
            <span>👁 {viewCount}</span>
            <span>👍 {likeCount}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="rounded-md bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-2 py-1 text-[9px] font-semibold text-black">
            /{edgazeCode || "your-code"}
          </div>
          <div className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
            {isPaid && priceUsd ? `$${Number(priceUsd).toFixed(2)}` : "Free"}
          </div>
        </div>
      </div>
    </div>
  );
}