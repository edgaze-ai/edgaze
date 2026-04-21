// src/app/[ownerHandle]/[edgazeCode]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  Heart,
  Sparkles,
  Share2,
  X,
  Link as LinkIcon,
  Copy,
  Download,
  RotateCcw,
  ExternalLink,
  Zap,
  Lock,
  CheckCircle2,
  Play,
  Flag,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { useAuth } from "../../../components/auth/AuthContext";
import WorkflowCommentsSection from "../../../components/marketplace/WorkflowCommentsSection";
import CustomerWorkflowRunModal from "../../../components/runtime/customer/CustomerWorkflowRunModal";
import {
  canRunDemo,
  getDeviceFingerprintHash,
  markDemoRunConsumedLocally,
} from "../../../lib/workflow/device-tracking";
import { extractWorkflowInputs } from "../../../lib/workflow/input-extraction";
import { validateWorkflowGraph } from "../../../lib/workflow/validation";
import { track, type TrackProperties } from "../../../lib/mixpanel";
import { SHOW_PUBLIC_LIKES_AND_RUNS } from "../../../lib/constants";
import TurnstileWidget from "../../../components/apply/TurnstileWidget";
import ProfileAvatar from "../../../components/ui/ProfileAvatar";
import ProfileLink from "../../../components/ui/ProfileLink";
import ReportModal from "../../../components/marketplace/ReportModal";
import ListingImageLightbox from "../../../components/marketplace/ListingImageLightbox";
import EdgazeNotFoundScreen from "../../../components/errors/EdgazeNotFoundScreen";
import { toRuntimeGraph } from "../../../lib/workflow/customer-runtime";
import { finalizeClientWorkflowRunFromExecutionResult } from "../../../lib/workflow/finalize-client-run-result";
import { handleWorkflowRunStream } from "../../../lib/workflow/run-stream-client";
import { startClientTraceSession } from "../../../lib/workflow/client-trace";
import type { WorkflowRunState } from "../../../lib/workflow/run-types";

function safeTrack(event: string, props?: TrackProperties) {
  try {
    track(event, props);
  } catch {}
}

type WorkflowListing = {
  id: string;
  owner_id: string | null; // workflows.owner_id is uuid
  owner_name: string | null;
  owner_handle: string | null;

  title: string | null;
  description: string | null;
  tags: string | null;

  banner_url: string | null;
  thumbnail_url: string | null;

  edgaze_code: string | null;

  is_public: boolean | null;
  is_published: boolean | null;

  monetisation_mode: "free" | "paywall" | "subscription" | "both" | null;
  is_paid: boolean | null;
  price_usd: number | null;

  views_count: number | null;
  likes_count: number | null;
  runs_count?: number | null;

  demo_images: string[] | null;
  output_demo_urls: string[] | null;

  graph_json: any | null;
  graph: any | null;

  removed_at?: string | null;
  removed_reason?: string | null;
  removed_by?: string | null;
  demo_mode_enabled?: boolean | null;
  demo_token?: string | null;
};

type PurchaseRow = {
  id: string;
  status: string; // workflow_purchases.status (text)
};

type PublicProfileLite = {
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  is_verified_creator?: boolean | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

/* ---------- QR helpers (same approach as prompt page) ---------- */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function qrDataUrlLocal(text: string): Promise<string> {
  try {
    const mod: any = await withTimeout(import("qrcode") as any, 2500, "QR module import");
    const QRCode = mod?.default ?? mod;
    const dataUrl = await withTimeout(
      QRCode.toDataURL(text, {
        errorCorrectionLevel: "H",
        margin: 1,
        scale: 10,
        color: { dark: "#0b0c10", light: "#ffffff" },
      }),
      4500,
      "QR generation",
    );
    return String(dataUrl);
  } catch {
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), 6000);
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(
        text,
      )}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error("QR fetch failed");
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Failed to read QR blob"));
        r.readAsDataURL(blob);
      });
    } finally {
      clearTimeout(kill);
    }
  }
}

async function qrWithCenteredLogoDataUrl(text: string) {
  const qrDataUrl = await qrDataUrlLocal(text);

  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, 0, 0, 900, 900);

  const badgeSize = 200;
  const badgeX = (900 - badgeSize) / 2;
  const badgeY = (900 - badgeSize) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  const r = 36;
  ctx.beginPath();
  ctx.moveTo(badgeX + r, badgeY);
  ctx.arcTo(badgeX + badgeSize, badgeY, badgeX + badgeSize, badgeY + badgeSize, r);
  ctx.arcTo(badgeX + badgeSize, badgeY + badgeSize, badgeX, badgeY + badgeSize, r);
  ctx.arcTo(badgeX, badgeY + badgeSize, badgeX, badgeY, r);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeSize, badgeY, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  try {
    const logo = await withTimeout(loadImage("/brand/edgaze-mark.png"), 2500, "Logo load");
    const logoSize = 120;
    ctx.drawImage(logo, (900 - logoSize) / 2, (900 - logoSize) / 2, logoSize, logoSize);
  } catch {
    // ignore
  }

  return canvas.toDataURL("image/png");
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

async function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- Share helpers (match prompt publish modal) ---------- */
type ShareApp = "whatsapp" | "x" | "snapchat" | "reddit" | "facebook";

function shareAppInfo(app: ShareApp) {
  if (app === "whatsapp") return { name: "WhatsApp", icon: "/misc/whatsapp.png" };
  if (app === "x") return { name: "X", icon: "/misc/x.png" };
  if (app === "snapchat") return { name: "Snapchat", icon: "/misc/snapchat.png" };
  if (app === "reddit") return { name: "Reddit", icon: "/misc/reddit.png" };
  return { name: "Facebook", icon: "/misc/facebook.png" };
}

function buildShareUrl(app: ShareApp, shareUrl: string, title?: string | null) {
  const u = encodeURIComponent(shareUrl);
  const t = encodeURIComponent((title || "Edgaze").trim());

  if (app === "whatsapp") {
    return `https://wa.me/?text=${encodeURIComponent(`${title ? `${title}\n` : ""}${shareUrl}`)}`;
  }
  if (app === "x") {
    return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
  }
  if (app === "reddit") {
    return `https://www.reddit.com/submit?url=${u}&title=${t}`;
  }
  if (app === "facebook") {
    return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
  }

  // Snapchat web share is inconsistent. This opens Snapchat's Scan page with an attachment URL (works in some contexts),
  // otherwise user still has the link copied + QR.
  return `https://www.snapchat.com/scan?attachmentUrl=${u}`;
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ---------- Auto-fit circle icon (aggressive) ---------- */
const __ICON_SCALE_CACHE = new Map<string, number>();

function AutoFitCircleIcon({
  src,
  alt,
  size = 28,
  pad = 1,
  maxScale = 3.6,
  className = "",
}: {
  src: string;
  alt: string;
  size?: number;
  pad?: number;
  maxScale?: number;
  className?: string;
}) {
  const cacheKey = `${src}|${size}|${pad}|${maxScale}`;
  const [scale, setScale] = useState<number>(() => __ICON_SCALE_CACHE.get(cacheKey) ?? 1.6);

  useEffect(() => {
    let alive = true;

    async function compute() {
      const cached = __ICON_SCALE_CACHE.get(cacheKey);
      if (cached != null) {
        if (alive) setScale(cached);
        return;
      }

      try {
        const img = new window.Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("icon load failed"));
          img.src = src;
        });

        const CAN = 320;
        const canvas = document.createElement("canvas");
        canvas.width = CAN;
        canvas.height = CAN;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("no ctx");

        ctx.clearRect(0, 0, CAN, CAN);

        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) throw new Error("no size");

        // contain draw (centered)
        const r = Math.min(CAN / iw, CAN / ih);
        const dw = iw * r;
        const dh = ih * r;
        const dx = (CAN - dw) / 2;
        const dy = (CAN - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);

        const { data } = ctx.getImageData(0, 0, CAN, CAN);

        let minX = CAN,
          minY = CAN,
          maxX = -1,
          maxY = -1;

        const ALPHA_THRESHOLD = 10;

        for (let y = 0; y < CAN; y++) {
          for (let x = 0; x < CAN; x++) {
            const idx = (y * CAN + x) * 4 + 3;
            const a = data[idx] ?? 0;
            if (a > ALPHA_THRESHOLD) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < 0 || maxY < 0) {
          const fallback = 1.6;
          __ICON_SCALE_CACHE.set(cacheKey, fallback);
          if (alive) setScale(fallback);
          return;
        }

        const bw = Math.max(1, maxX - minX + 1);
        const bh = Math.max(1, maxY - minY + 1);

        const inner = Math.max(1, size - pad * 2);
        const contentMax = Math.max(bw, bh);

        const boundsFill = CAN / contentMax;
        const target = (inner / size) * boundsFill;

        const next = Math.min(maxScale, Math.max(1.0, target * 1.05));

        __ICON_SCALE_CACHE.set(cacheKey, next);
        if (alive) setScale(next);
      } catch {
        const fallback = 1.6;
        __ICON_SCALE_CACHE.set(cacheKey, fallback);
        if (alive) setScale(fallback);
      }
    }

    compute();
    return () => {
      alive = false;
    };
  }, [src, size, pad, maxScale, cacheKey]);

  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-full border border-white/10 bg-black/30",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute left-1/2 top-1/2 h-full w-full object-contain"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      />
    </div>
  );
}

/* ---------- Confetti (no deps) ---------- */
function fireMiniConfetti() {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.pointerEvents = "none";
  root.style.zIndex = "9999";
  document.body.appendChild(root);

  const pieces = 90;
  const colors = ["#22d3ee", "#60a5fa", "#ec4899", "#a78bfa", "#34d399", "#fbbf24", "#ffffff"];

  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const delay = Math.random() * 120;
    const dur = 900 + Math.random() * 900;

    p.style.position = "absolute";
    p.style.left = `${left}vw`;
    p.style.top = `-12px`;
    p.style.width = `${size}px`;
    p.style.height = `${size * 0.6}px`;
    p.style.background = colors[Math.floor(Math.random() * colors.length)]!;
    p.style.opacity = "0.95";
    p.style.borderRadius = "3px";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    p.style.filter = "drop-shadow(0 8px 18px rgba(0,0,0,0.35))";

    const drift = (Math.random() - 0.5) * 220;
    const spin = (Math.random() - 0.5) * 720;

    p.animate(
      [
        { transform: `translate(0px, 0px) rotate(0deg)`, opacity: 1 },
        {
          transform: `translate(${drift}px, 110vh) rotate(${spin}deg)`,
          opacity: 0.95,
        },
      ],
      {
        duration: dur,
        delay,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards",
      },
    );

    root.appendChild(p);
  }

  setTimeout(() => {
    root.remove();
  }, 2400);
}

/* ---------- Share Modal ---------- */
function ShareModal({
  open,
  onClose,
  shareUrl,
  code,
  ownerHandle,
  title,
}: {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  code: string;
  ownerHandle: string;
  title?: string | null;
}) {
  const [shareBusy, setShareBusy] = useState<ShareApp | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCopied(false);
    setShareBusy(null);
    setQrDataUrl(null);
    (async () => {
      setQrBusy(true);
      try {
        const qr = await withTimeout(qrWithCenteredLogoDataUrl(shareUrl), 9000, "QR render");
        if (!alive) return;
        setQrDataUrl(qr);
      } catch {
        if (!alive) return;
        setQrDataUrl(null);
      } finally {
        if (alive) setQrBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, shareUrl]);

  async function onShareApp(app: ShareApp) {
    try {
      setShareBusy(app);
      await copyToClipboard(shareUrl);
      const url = buildShareUrl(app, shareUrl, title);
      openExternal(url);
    } finally {
      setTimeout(() => setShareBusy(null), 500);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div className="relative w-[min(1120px,98vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={28}
                height={28}
                className="h-6 w-6 sm:h-7 sm:w-7"
              />
              <div>
                <div className="text-[13px] sm:text-[14px] font-semibold text-white">Share</div>
                <div className="hidden sm:block text-[11px] text-white/50">
                  Link, QR, and quick-share
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Close share"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-12 gap-4 sm:gap-5">
              <div className="col-span-12 sm:col-span-7">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="text-[11px] font-semibold text-white/70">Edgaze code</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-[34px] sm:text-[40px] font-semibold tracking-tight text-white leading-none">
                      {code || "—"}
                    </div>
                    <div className="text-right text-[11px] text-white/45">
                      <span className="text-white/70 font-semibold">
                        @{ownerHandle || "creator"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-[11px] font-semibold text-white/70">Share link</div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5 text-[12px] text-white/85 overflow-hidden">
                        <span className="inline-flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-white/55" />
                          <span className="truncate">{shareUrl}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await copyToClipboard(shareUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 900);
                        }}
                        className="h-10 sm:h-11 rounded-2xl border border-white/10 bg-white/5 px-3 sm:px-4 text-[12px] font-semibold text-white/90 hover:bg-white/10"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Copy className="h-4 w-4" />
                          {copied ? "Copied" : "Copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Quick share row */}
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold text-white/70">Quick share</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {(["whatsapp", "x", "snapchat", "reddit", "facebook"] as ShareApp[]).map(
                        (app) => {
                          const info = shareAppInfo(app);
                          const busy = shareBusy === app;
                          return (
                            <button
                              key={app}
                              type="button"
                              onClick={() => onShareApp(app)}
                              className={cn(
                                "group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/10",
                                busy && "opacity-70",
                              )}
                              aria-label={`Share to ${info.name}`}
                              title={info.name}
                            >
                              {busy ? (
                                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border border-white/10 bg-black/30">
                                  <Loader2 className="h-4 w-4 animate-spin text-white/70" />
                                </span>
                              ) : (
                                <AutoFitCircleIcon
                                  src={info.icon}
                                  alt={info.name}
                                  size={28}
                                  pad={1}
                                  maxScale={3.6}
                                />
                              )}

                              <span className="hidden sm:inline">{info.name}</span>
                            </button>
                          );
                        },
                      )}
                    </div>

                    <div className="mt-2 text-[11px] text-white/45">
                      Tapping an app also copies the link for reliable pasting.
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-12 sm:col-span-5">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-white/70">QR code</div>
                    <button
                      type="button"
                      onClick={async () => {
                        setQrBusy(true);
                        try {
                          const qr = await withTimeout(
                            qrWithCenteredLogoDataUrl(shareUrl),
                            9000,
                            "QR render",
                          );
                          setQrDataUrl(qr);
                        } finally {
                          setQrBusy(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Regenerate
                    </button>
                  </div>

                  <div className="mt-3 grid place-items-center rounded-3xl border border-white/10 bg-black/35 p-3">
                    <div className="h-[160px] w-[160px] sm:h-[210px] sm:w-[210px] overflow-hidden rounded-2xl bg-white/[0.03] grid place-items-center">
                      {qrBusy ? (
                        <div className="inline-flex items-center gap-2 text-[12px] text-white/60">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating…
                        </div>
                      ) : qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="Edgaze QR"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-[12px] text-white/55">QR unavailable</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!qrDataUrl}
                      onClick={() =>
                        qrDataUrl
                          ? downloadDataUrl(qrDataUrl, `edgaze-qr-${code || "workflow"}.png`)
                          : null
                      }
                      className={cn(
                        "h-10 sm:h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 sm:px-4 text-[12px] font-semibold text-white/90 hover:bg-white/10",
                        !qrDataUrl && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <Download className="h-4 w-4" />
                        Download
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await copyToClipboard(shareUrl);
                      }}
                      className="h-10 sm:h-11 flex-1 rounded-2xl bg-white px-3 sm:px-4 text-[12px] font-semibold text-black hover:bg-white/90"
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <Copy className="h-4 w-4" />
                        Copy link
                      </span>
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
                    <div className="flex items-start gap-2">
                      <ExternalLink className="h-4 w-4 mt-[1px] text-white/45" />
                      <div className="min-w-0">
                        <div className="text-white/80 font-semibold">Share friction killer</div>
                        <div className="mt-0.5 leading-snug">
                          Copy link → paste anywhere. Edgaze code is short for shoutouts on video.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-white/40">
                    QR auto-generates; regenerate if needed.
                  </div>
                </div>
              </div>

              <div className="col-span-12 sm:hidden text-[11px] text-white/45">
                QR + link are ready to share.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Purchase success modal ---------- */
function PurchaseSuccessModal({
  open,
  title,
  onClose,
  onOpenStudio,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onOpenStudio: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    fireMiniConfetti();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-[min(640px,94vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.85)]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 border border-emerald-400/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-200" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-white">Purchased</div>
                <div className="text-[11px] text-white/55">
                  Access is now attached to your account
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[12px] text-white/70">You unlocked</div>
              <div className="mt-1 text-[16px] font-semibold text-white leading-snug">{title}</div>
              <div className="mt-3 space-y-2 text-[12px] text-white/75">
                <div>• 10 hosted runs included</div>
                <div>• Use your own API key after hosted runs are finished</div>
                <div>• Workflow Studio in preview mode (no edit access)</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenStudio}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_22px_rgba(56,189,248,0.75)]"
              >
                <Sparkles className="h-4 w-4" />
                Open in Workflow Studio
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold border border-white/15 bg-white/5 text-white hover:border-cyan-400/70"
              >
                Continue browsing
              </button>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              Opens in <span className="text-white/70 font-semibold">preview mode</span>: you can
              run and move nodes, but not edit, publish, or use the block library or inspector.
              Listing owners still have full edit access.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function WorkflowProductPage() {
  const params = useParams<{ ownerHandle: string; edgazeCode: string }>();
  const router = useRouter();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { requireAuth, userId, profile, getAccessToken, refreshAuthSession, isAdmin } = useAuth();

  const [listing, setListing] = useState<WorkflowListing | null>(null);
  const [loading, setLoading] = useState(true);

  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const [mainDemoIndex, setMainDemoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchase, setPurchase] = useState<PurchaseRow | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const [purchaseSuccessOpen, setPurchaseSuccessOpen] = useState(false);

  // Demo run state
  const [demoRunModalOpen, setDemoRunModalOpen] = useState(false);
  const [demoRunState, setDemoRunState] = useState<WorkflowRunState | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);

  // Turnstile verification for demo
  const [turnstileVerifying, setTurnstileVerifying] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [demoVerificationError, setDemoVerificationError] = useState<string | null>(null);
  const [demoVerificationPhase, setDemoVerificationPhase] = useState<
    "idle" | "checking" | "turnstile"
  >("idle");

  const [upNext, setUpNext] = useState<WorkflowListing[]>([]);
  const [upNextLoading, setUpNextLoading] = useState(false);
  const [upNextHasMore, setUpNextHasMore] = useState(true);
  const [upNextCursor, setUpNextCursor] = useState(0);
  const upNextSentinelRef = useRef<HTMLDivElement | null>(null);
  const autoActionTriggeredRef = useRef(false);
  const demoRunAbortRef = useRef<AbortController | null>(null);
  const demoRunSessionPollRef = useRef<AbortController | null>(null);
  const demoRunAutoExecuteRef = useRef(false);
  const pendingDemoInputValuesRef = useRef<Record<string, any> | null>(null);
  const [demoAvailable, setDemoAvailable] = useState<boolean | null>(null);

  const [demoExecutionGraph, setDemoExecutionGraph] = useState<{
    nodes: any[];
    edges: any[];
  } | null>(null);

  // Load creator profile for avatar
  const [creatorProfile, setCreatorProfile] = useState<PublicProfileLite | null>(null);

  const ownerHandle = params?.ownerHandle;
  const edgazeCode = params?.edgazeCode;

  const demoModalState =
    demoRunState ??
    (listing
      ? {
          workflowId: listing.id,
          workflowName: listing.title || "Untitled Workflow",
          phase: "input",
          status: "idle",
          steps: [],
          logs: [],
        }
      : null);

  useEffect(() => {
    if (!listing?.id) {
      setDemoAvailable(null);
      return;
    }

    let cancelled = false;
    void canRunDemo(listing.id, true)
      .then((allowed) => {
        if (!cancelled) setDemoAvailable(allowed);
      })
      .catch(() => {
        if (!cancelled) setDemoAvailable(null);
      });

    return () => {
      cancelled = true;
    };
  }, [listing?.id]);

  useEffect(() => {
    if (!ownerHandle || !edgazeCode) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setDemoAvailable(null);
      setPurchaseError(null);
      setDemoVerificationError(null);

      let record: WorkflowListing | null = null;
      try {
        const res = await fetch(
          `/api/workflow/storefront-detail?owner_handle=${encodeURIComponent(ownerHandle)}&edgaze_code=${encodeURIComponent(edgazeCode)}`,
        );
        const json = await res.json().catch(() => ({}));
        record = (json?.listing as WorkflowListing | null) ?? null;
      } catch (e) {
        console.error("Workflow listing load error", e);
        record = null;
      }

      if (cancelled) return;

      if (!record) {
        setListing(null);
        setLoading(false);
        return;
      }

      // Basic guard: don’t show private.
      if (record.is_public === false) {
        setListing(null);
        setLoading(false);
        return;
      }

      setListing(record);
      setLoading(false);

      const canonical = record.owner_handle?.trim().toLowerCase();
      const fromUrl = String(ownerHandle).trim().toLowerCase();
      if (canonical && fromUrl && canonical !== fromUrl && record.owner_handle) {
        router.replace(
          `/${encodeURIComponent(record.owner_handle.trim())}/${encodeURIComponent(edgazeCode)}`,
        );
      }

      (async () => {
        try {
          const token = await getAccessToken();
          await fetch("/api/views/track", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify({
              listingId: record.id,
              listingType: "workflow",
              deviceFingerprint: getDeviceFingerprintHash(),
            }),
          });
        } catch {
          /* best-effort */
        }
      })();
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ownerHandle, edgazeCode, router, getAccessToken]);

  useEffect(() => {
    if (!listing?.id) return;
    setLikeCount(Number(listing.likes_count ?? 0) || 0);
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/marketplace/like?itemId=${encodeURIComponent(listing.id)}&itemType=workflow`,
          { credentials: "include" },
        );
        const j = (await res.json().catch(() => ({}))) as { isLiked?: boolean };
        if (!alive) return;
        setIsLiked(Boolean(j.isLiked));
      } catch {
        if (!alive) return;
        setIsLiked(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listing?.id, listing?.likes_count]);

  const demoImages: string[] = useMemo(() => {
    if (!listing) return [];
    if (Array.isArray(listing.demo_images) && listing.demo_images.length > 0)
      return listing.demo_images;
    if (Array.isArray(listing.output_demo_urls) && listing.output_demo_urls.length > 0)
      return listing.output_demo_urls;
    if (listing.banner_url) return [listing.banner_url];
    if (listing.thumbnail_url) return [listing.thumbnail_url];
    return [];
  }, [listing]);

  const activeDemo = demoImages[mainDemoIndex] || null;

  const currentUserId = userId ?? null;
  const currentUserName = (profile as any)?.full_name ?? null;
  const currentUserHandle = (profile as any)?.handle ?? null;

  // Load creator avatar/name from profiles (handle-based, avoids uuid/text mismatch)
  useEffect(() => {
    if (!listing?.owner_handle) {
      setCreatorProfile(null);
      return;
    }

    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,handle,avatar_url,is_verified_creator")
        .eq("handle", listing.owner_handle)
        .maybeSingle();

      if (!alive) return;
      if (error || !data) {
        setCreatorProfile(null);
        return;
      }
      setCreatorProfile(data as PublicProfileLite);
    })();

    return () => {
      alive = false;
    };
  }, [listing?.owner_handle, supabase]);

  const creatorHandle = useMemo(() => {
    if (!listing) return ownerHandle || "";
    const isOwner = !!userId && String(listing.owner_id) === String(userId);
    if (isOwner && (profile as { handle?: string } | null)?.handle)
      return (profile as { handle?: string }).handle!;
    return listing.owner_handle || creatorProfile?.handle || ownerHandle || "creator";
  }, [listing, userId, profile, creatorProfile, ownerHandle]);

  const canonicalShareUrl = useMemo(() => {
    const h = creatorHandle || listing?.owner_handle || ownerHandle || "";
    const c = listing?.edgaze_code || edgazeCode || "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://edgaze.ai";
    return `${origin}/${h}/${c}`;
  }, [creatorHandle, listing?.owner_handle, listing?.edgaze_code, ownerHandle, edgazeCode]);

  // Typed routes in Next can be strict; cast to any for runtime-safe string routes.
  const goBack = () => router.push("/marketplace" as any);

  // Only treat as free when listing is loaded and explicitly free (source of truth: DB).
  const isNaturallyFree = useMemo(() => {
    if (!listing) return false;
    return listing.monetisation_mode === "free" || listing.is_paid === false;
  }, [listing]);

  const paidLabel = useMemo(() => {
    if (!listing) return "Free";
    if (isNaturallyFree) return "Free";
    return listing.price_usd != null ? `$${Number(listing.price_usd).toFixed(2)}` : "Paid";
  }, [listing, isNaturallyFree]);

  const demoStatusKnown = !loading && demoAvailable !== null;
  const demoButtonEnabled = demoStatusKnown && demoAvailable === true;
  const demoButtonBusy = demoRunning || turnstileVerifying || loading;
  const demoButtonLabel = loading
    ? "Checking demo..."
    : demoAvailable === false
      ? "Demo used for this workflow"
      : "Try a one-time demo";
  const demoButtonTitle = loading
    ? "Checking demo availability for this workflow."
    : demoAvailable === false
      ? "You've already used the one-time demo for this workflow on this device."
      : "Try a one-time demo";
  const effectiveViewerId = currentUserId || userId || null;

  const isOwner = useMemo(() => {
    if (!listing || !effectiveViewerId) return false;
    return String(listing.owner_id ?? "") === String(effectiveViewerId);
  }, [listing, effectiveViewerId]);

  // Access ONLY: owner OR has a row in workflow_purchases (paid/beta). No free access without purchase.
  const isOwned = useMemo(() => {
    if (!listing) return false;
    if (isOwner) return true;
    // Require purchase row for everyone else (even free items need to be "purchased" to show in library)
    return Boolean(purchase && (purchase.status === "paid" || purchase.status === "beta"));
  }, [listing, isOwner, purchase]);

  const primaryCtaLabel = useMemo(() => {
    if (isNaturallyFree) return "Open in Workflow Studio";
    return "Buy access";
  }, [isNaturallyFree]);

  const ownershipBadgeLabel = useMemo(() => {
    if (isOwner) return "Yours";
    if (isOwned) return "Owned";
    return null;
  }, [isOwner, isOwned]);

  useEffect(() => {
    if (isOwned && purchaseError) {
      setPurchaseError(null);
    }
  }, [isOwned, purchaseError]);

  function openWorkflowStudio() {
    if (!listing) return;

    // Owners get full builder. Everyone else opens preview-only (read-only) mode.
    const wid = listing.id;
    const mode = isOwner ? "edit" : "preview";

    router.push(
      `/builder?workflowId=${encodeURIComponent(
        wid,
      )}&mode=${encodeURIComponent(mode)}` as any as any,
    );
  }

  async function loadPurchaseRow(workflowId: string, uid: string) {
    const { data, error } = await supabase
      .from("workflow_purchases")
      .select("id,status")
      .eq("workflow_id", workflowId)
      .eq("buyer_id", uid)
      .maybeSingle();

    if (error) {
      console.error("workflow purchase load error", error);
      return null;
    }
    return (data as PurchaseRow) ?? null;
  }

  useEffect(() => {
    if (!listing?.id) return;
    if (!userId) {
      setPurchase(null);
      setPurchaseError(null);
      return;
    }
    let alive = true;
    (async () => {
      const row = await loadPurchaseRow(listing.id, userId);
      if (!alive) return;
      setPurchase(row);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id, userId]);

  // Auto-trigger purchase/run flow only after auth redirect (not on shared links or back navigation)
  useEffect(() => {
    if (!userId || !listing) return;
    if (autoActionTriggeredRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");

    if (action === "purchase") {
      // Only auto-trigger if user initiated this flow (intent set when they clicked Buy Access)
      try {
        const intentAt = sessionStorage.getItem("edgaze:actionIntentAt");
        const intentPath = sessionStorage.getItem("edgaze:actionIntentPath");
        const age = intentAt ? Date.now() - parseInt(intentAt, 10) : Infinity;
        const pathMatch = intentPath === window.location.pathname;
        if (!intentAt || !pathMatch || age > 120_000) {
          urlParams.delete("action");
          const newUrl =
            window.location.pathname +
            (urlParams.toString() ? `?${urlParams.toString()}` : "") +
            window.location.hash;
          window.history.replaceState({}, "", newUrl);
          sessionStorage.removeItem("edgaze:actionIntentAt");
          sessionStorage.removeItem("edgaze:actionIntentPath");
          return;
        }
        sessionStorage.removeItem("edgaze:actionIntentAt");
        sessionStorage.removeItem("edgaze:actionIntentPath");
      } catch {}

      autoActionTriggeredRef.current = true;

      urlParams.delete("action");
      const newUrl =
        window.location.pathname +
        (urlParams.toString() ? `?${urlParams.toString()}` : "") +
        window.location.hash;
      window.history.replaceState({}, "", newUrl);

      const timer = setTimeout(() => {
        grantAccessOrOpen();
      }, 300);

      return () => clearTimeout(timer);
    }
    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, listing]);

  async function grantAccessOrOpen() {
    if (!listing) return;
    setPurchaseError(null);

    // Save intent in URL before requiring auth so redirect includes it
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("action", "purchase");
    const relativePath =
      window.location.pathname +
      (urlParams.toString() ? `?${urlParams.toString()}` : "") +
      window.location.hash;
    window.history.replaceState({}, "", relativePath);
    // Mark that user initiated this flow (for auto-trigger after auth redirect only)
    try {
      sessionStorage.setItem("edgaze:actionIntentAt", String(Date.now()));
      sessionStorage.setItem("edgaze:actionIntentPath", window.location.pathname);
    } catch {}

    // For paid items when not logged in: full-screen sign-in-to-buy page (conversion-optimized)
    if (!userId && !isNaturallyFree) {
      const returnPath =
        window.location.pathname + (window.location.search ? window.location.search : "");
      window.location.href = `/auth/sign-in-to-buy?return=${encodeURIComponent(returnPath)}&type=workflow`;
      return;
    }

    if (!requireAuth()) {
      return;
    }

    // Re-check ownership right before acting (prevents stale `purchase` state
    // during auto-trigger after auth redirect).
    let isOwnedNow = isOwned || isOwner;
    if (!isOwner && userId) {
      const uid = userId;
      const row = await loadPurchaseRow(listing.id, uid);
      setPurchase(row);
      isOwnedNow = Boolean(row && (row.status === "paid" || row.status === "beta"));
    }

    if (isOwnedNow) {
      openWorkflowStudio();
      return;
    }

    // For free items: insert purchase row (free items still need purchase to show in library)
    if (isNaturallyFree) {
      setPurchaseLoading(true);
      try {
        const uid = userId!;

        // Check if purchase already exists (might have been created during redirect)
        const existing = await loadPurchaseRow(listing.id, uid);
        if (existing) {
          setPurchase(existing);
          setPurchaseSuccessOpen(true);
          setPurchaseLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("workflow_purchases")
          .insert({
            buyer_id: uid,
            workflow_id: listing.id,
            status: "beta",
          })
          .select("id,status")
          .maybeSingle();

        if (error) {
          console.error("workflow beta access insert error", error);

          // If it's a duplicate key error, try to load the existing purchase
          if (
            error.code === "23505" ||
            error.message?.includes("duplicate") ||
            error.message?.includes("unique")
          ) {
            const existingAfterError = await loadPurchaseRow(listing.id, uid);
            if (existingAfterError) {
              setPurchase(existingAfterError);
              setPurchaseSuccessOpen(true);
              setPurchaseLoading(false);
              return;
            }
          }

          setPurchaseError("Could not grant access. Please try again.");
          return;
        }

        setPurchase((data as PurchaseRow) ?? null);
        setPurchaseSuccessOpen(true);
        return;
      } finally {
        setPurchaseLoading(false);
      }
    }

    // Real paid checkout (Stripe) - create session and redirect to hosted checkout (loading on button)
    if (!isNaturallyFree) {
      try {
        sessionStorage.removeItem("edgaze:actionIntentAt");
        sessionStorage.removeItem("edgaze:actionIntentPath");
      } catch {}
      setPurchaseLoading(true);
      try {
        let token = await getAccessToken();
        if (!token) {
          await refreshAuthSession();
          token = await getAccessToken();
        }
        if (!token) {
          setPurchaseError("Please sign in to continue.");
          return;
        }
        const res = await fetch("/api/stripe/checkout/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({
            type: "workflow",
            workflowId: listing.id,
            sourceTable: "workflows",
            embedded: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPurchaseError(data.error || "Failed to start checkout");
          return;
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        setPurchaseError("Invalid checkout response");
      } catch (err) {
        setPurchaseError(err instanceof Error ? err.message : "Failed to start checkout");
      } finally {
        setPurchaseLoading(false);
      }
      return;
    }

    // Should not reach here - all paths above return
    setPurchaseError("Unable to grant access. Please try again.");
  }

  // Handle Turnstile token from widget
  async function handleTurnstileToken(token: string) {
    if (!token) {
      setTurnstileToken(null);
      return;
    }

    setTurnstileToken(token);
    setTurnstileVerifying(true);
    setDemoVerificationError(null);

    try {
      // Verify token with server
      const response = await fetch("/api/turnstile/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          purpose: "workflow_demo",
          workflowId: listing.id,
          deviceFingerprint: getDeviceFingerprintHash(),
        }),
      });

      const result = await response.json();

      if (result.ok) {
        setTurnstileVerifying(false);
        setTurnstileToken(null);
        setDemoVerificationPhase("idle");
        demoRunAutoExecuteRef.current = false;

        const pendingInputs = pendingDemoInputValuesRef.current;
        pendingDemoInputValuesRef.current = null;

        if (pendingInputs) {
          await handleDemoSubmitInputs(pendingInputs);
          return;
        }

        await startDemoRun();
      } else {
        setDemoVerificationError("Captcha verification failed. Please try again.");
        setTurnstileVerifying(false);
        setTurnstileToken(null);
      }
    } catch (error: any) {
      setDemoVerificationError("Failed to verify captcha. Please try again.");
      setTurnstileVerifying(false);
      setTurnstileToken(null);
    }
  }

  // Start demo run after Turnstile verification
  async function startDemoRun() {
    if (!listing) return;

    const canRun = await canRunDemo(listing.id, true);
    setDemoAvailable(canRun);
    if (!canRun) {
      setPurchaseError(
        "You've already used the one-time demo for this workflow on this device. Buy access to run this workflow again.",
      );
      setDemoRunModalOpen(false);
      setDemoVerificationPhase("idle");
      return;
    }

    try {
      safeTrack("Workflow Demo Run Initiated", {
        surface: "product_page",
        listing_id: listing.id,
        edgaze_code: listing.edgaze_code,
      });

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const payload: Record<string, unknown> = { workflowId: listing.id };
      if (!userId) {
        payload.deviceFingerprint = getDeviceFingerprintHash();
      } else {
        let token = await getAccessToken();
        if (!token) {
          await refreshAuthSession();
          token = await getAccessToken();
        }
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/workflow/resolve-run-graph", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const payloadJson = await res.json().catch(() => ({}));
      if (!res.ok || !payloadJson.ok) {
        throw new Error(payloadJson.error || "Failed to load workflow");
      }
      const graph: { nodes: any[]; edges: any[] } = {
        nodes: payloadJson.nodes || [],
        edges: payloadJson.edges || [],
      };

      setDemoExecutionGraph(graph);

      // Validate workflow
      const validation = validateWorkflowGraph(graph.nodes || [], graph.edges || []);
      if (!validation.valid) {
        throw new Error(validation.errors.map((e) => e.message).join("\n"));
      }

      // Extract inputs
      const inputs = extractWorkflowInputs(graph.nodes || []);

      // Initialize run state
      const initialState: WorkflowRunState = {
        workflowId: listing.id,
        workflowName: listing.title || "Untitled Workflow",
        phase: inputs.length > 0 ? "input" : "executing",
        status: "idle",
        steps: [],
        logs: [],
        inputs: inputs.length > 0 ? inputs : undefined,
        graph: toRuntimeGraph(graph),
      };

      setDemoRunState(initialState);
      setDemoRunModalOpen(true);
      setDemoVerificationPhase("idle");
      setDemoVerificationError(null);
    } catch (error: any) {
      setPurchaseError(error.message || "Failed to start demo");
      setDemoRunModalOpen(false);
      setDemoVerificationPhase("idle");
    }
  }

  // Handle demo button click - verification stays inside the run modal.
  async function handleDemoButtonClick() {
    if (!listing) return;
    setPurchaseError(null);
    setDemoVerificationError(null);
    setTurnstileToken(null);
    pendingDemoInputValuesRef.current = null;
    setDemoRunModalOpen(true);

    setDemoVerificationPhase("checking");

    try {
      const canRun = await canRunDemo(listing.id, true);
      setDemoAvailable(canRun);
      if (!canRun) {
        setPurchaseError(
          "You've already used the one-time demo for this workflow on this device. Buy access to run this workflow again.",
        );
        setDemoRunModalOpen(false);
        setDemoVerificationPhase("idle");
        return;
      }

      setDemoVerificationPhase("turnstile");
    } catch (err) {
      setPurchaseError("Failed to verify demo eligibility. Please try again.");
      setDemoRunModalOpen(false);
      setDemoVerificationPhase("idle");
    }
  }

  // Handle demo input submission
  async function handleDemoSubmitInputs(inputValues: Record<string, any>) {
    if (!listing || !demoRunState) return;

    const graph = demoExecutionGraph || {
      nodes: (listing.graph_json || listing.graph)?.nodes || [],
      edges: (listing.graph_json || listing.graph)?.edges || [],
    };

    // Convert File objects to base64
    const processedInputs: Record<string, any> = {};
    for (const [key, value] of Object.entries(inputValues)) {
      if (value instanceof File) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(value);
          });
          processedInputs[key] = {
            filename: value.name,
            type: value.type,
            size: value.size,
            data: base64,
          };
        } catch (error) {
          setPurchaseError("Failed to process file upload");
          return;
        }
      } else {
        processedInputs[key] = value;
      }
    }

    // Update state to executing
    setDemoRunState({
      ...demoRunState,
      phase: "executing",
      status: "running",
      inputValues: processedInputs,
      startedAt: Date.now(),
      connectionState: "connecting",
      connectionLabel: "Connecting to execution...",
      lastEventAt: Date.now(),
    });
    setDemoRunning(true);

    try {
      const clientTrace = startClientTraceSession({
        routeId: "customer.workflow.run",
        requestPath: typeof window !== "undefined" ? window.location.pathname : null,
        workflowId: listing.id,
        context: {
          surface: "customer_marketplace_full",
          isDemoRun: true,
          userId: userId ?? null,
        },
      });
      clientTrace.record({
        phase: "request",
        eventName: "run_start.initiated",
        payload: {
          workflowId: listing.id,
          inputKeyCount: Object.keys(processedInputs ?? {}).length,
          isDemoRun: true,
          hasUserId: Boolean(userId),
        },
      });
      const deviceFingerprint = !userId ? getDeviceFingerprintHash() : undefined;

      // Signed-in users must send Bearer token - API uses getUserFromRequest (Bearer only)
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userId) {
        const tokenStartedAt = Date.now();
        let token = await getAccessToken({ eagerRefresh: false });
        if (!token) {
          await refreshAuthSession();
          token = await getAccessToken();
        }
        clientTrace.record({
          phase: "request",
          eventName: "auth.token_resolved",
          durationMs: Date.now() - tokenStartedAt,
          payload: {
            workflowId: listing.id,
            hasToken: Boolean(token),
          },
        });
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }
      demoRunSessionPollRef.current?.abort();
      demoRunSessionPollRef.current = null;
      demoRunAbortRef.current = new AbortController();

      const postStartedAt = Date.now();
      const response = await fetch("/api/flow/run", {
        method: "POST",
        headers,
        credentials: "include",
        signal: demoRunAbortRef.current.signal,
        body: JSON.stringify({
          workflowId: listing.id,
          inputs: processedInputs,
          userApiKeys: {},
          isDemo: !userId,
          deviceFingerprint,
          stream: true,
          forceDemoModelTier: true,
        }),
      });
      clientTrace.setClockFromServerEpoch(response.headers.get("x-trace-server-epoch-ms"));
      clientTrace.record({
        phase: "request",
        eventName: "run_start.post_completed",
        durationMs: Date.now() - postStartedAt,
        httpStatus: response.status,
        payload: {
          workflowId: listing.id,
          ok: response.ok,
          traceSessionId: response.headers.get("x-trace-session-id"),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        await clientTrace.finish({
          status: "failed",
          errorMessage: error.error || `HTTP ${response.status}`,
        });
        if (!userId) {
          const allowed = await canRunDemo(listing.id, true).catch(() => null);
          if (typeof allowed === "boolean") setDemoAvailable(allowed);
        }
        if (
          typeof error?.error === "string" &&
          error.error.includes("Verification required before running this demo")
        ) {
          demoRunAutoExecuteRef.current = false;
          pendingDemoInputValuesRef.current = processedInputs;
          setTurnstileToken(null);
          setTurnstileVerifying(false);
          setDemoVerificationError(null);
          setDemoVerificationPhase("turnstile");
          setDemoRunState((prev) =>
            prev
              ? {
                  ...prev,
                  status: "idle",
                  error: undefined,
                  finishedAt: undefined,
                  connectionState: "idle",
                  connectionLabel: "Complete verification to continue this demo run.",
                }
              : prev,
          );
        }
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      if (!userId) {
        markDemoRunConsumedLocally(listing.id);
        setDemoAvailable(false);
      }

      const streamResult = await handleWorkflowRunStream({
        response,
        accessToken: headers.Authorization
          ? String(headers.Authorization).replace(/^Bearer\s+/i, "")
          : null,
        runSessionPollRef: demoRunSessionPollRef,
        setRunState: setDemoRunState,
        workflowId: listing.id,
        workflowName: listing.title || "Workflow",
        inputValues: processedInputs,
        sourceGraph: toRuntimeGraph(graph),
        clientTrace,
      });
      if (streamResult.handedOff) {
        return;
      }

      const result = streamResult.result;
      if (!result.ok) {
        throw new Error(result.error || "Execution failed");
      }

      {
        const executionResult = result.result;
        const completion = finalizeClientWorkflowRunFromExecutionResult({
          executionResult,
          graphNodes: graph.nodes || [],
          processedInputs,
        });
        setDemoRunState({
          ...demoRunState,
          ...completion,
        });
      }
      await clientTrace.finish({ status: "completed" });
    } catch (error: any) {
      if (
        typeof error?.message === "string" &&
        error.message.includes("Verification required before running this demo")
      ) {
        setDemoRunning(false);
        return;
      }
      if (!userId) {
        const allowed = await canRunDemo(listing.id, true).catch(() => null);
        if (typeof allowed === "boolean") setDemoAvailable(allowed);
      }
      setDemoRunState({
        ...demoRunState,
        phase: "output",
        status: "error",
        error: error.message || "Execution failed",
        finishedAt: Date.now(),
      });
    } finally {
      setDemoRunning(false);
    }
  }

  async function loadMoreUpNext(reset = false) {
    if (upNextLoading) return;

    const pageSize = 12;
    const from = reset ? 0 : upNextCursor;
    const to = from + pageSize - 1;

    setUpNextLoading(true);

    const baseSelect = [
      "id",
      "owner_id",
      "owner_name",
      "owner_handle",
      "title",
      "thumbnail_url",
      "banner_url",
      "edgaze_code",
      "is_public",
      "is_published",
      "monetisation_mode",
      "is_paid",
      "price_usd",
      "views_count",
      "likes_count",
      "tags",
    ].join(",");

    let q = supabase
      .from("workflows")
      .select(baseSelect)
      .eq("is_published", true)
      .eq("is_public", true)
      .order("views_count", { ascending: false })
      .order("likes_count", { ascending: false });

    if (listing?.id) q = q.neq("id", listing.id);

    const { data, error } = await q.range(from, to);

    if (error) {
      console.error("Workflow Up next load error", error);
      setUpNextLoading(false);
      return;
    }

    // TS build fix: cast through unknown to avoid GenericStringError[] overlap type.
    const rows = (data ?? []) as unknown as WorkflowListing[];
    setUpNext((prev) => (reset ? rows : [...prev, ...rows]));
    setUpNextCursor(from + rows.length);
    setUpNextHasMore(rows.length === pageSize);
    setUpNextLoading(false);
  }

  useEffect(() => {
    if (!listing) return;
    setUpNext([]);
    setUpNextCursor(0);
    setUpNextHasMore(true);
    loadMoreUpNext(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id]);

  useEffect(() => {
    return () => {
      demoRunAbortRef.current?.abort();
      demoRunSessionPollRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (
      demoRunState?.status === "success" ||
      demoRunState?.status === "error" ||
      demoRunState?.status === "cancelled"
    ) {
      setDemoRunning(false);
    }
  }, [demoRunState?.status]);

  useEffect(() => {
    if (!demoRunModalOpen) {
      demoRunAutoExecuteRef.current = false;
      pendingDemoInputValuesRef.current = null;
      setDemoVerificationPhase("idle");
      setDemoVerificationError(null);
      setTurnstileToken(null);
      setTurnstileVerifying(false);
    }
  }, [demoRunModalOpen]);

  useEffect(() => {
    if (
      !demoRunModalOpen ||
      demoVerificationPhase !== "idle" ||
      !demoRunState ||
      demoRunState.phase !== "executing" ||
      demoRunState.status !== "idle" ||
      demoRunAutoExecuteRef.current
    )
      return;
    const hasInputs = demoRunState.inputs && demoRunState.inputs.length > 0;
    if (hasInputs) return;
    demoRunAutoExecuteRef.current = true;
    void handleDemoSubmitInputs({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirrors builder: auto-start run when modal opens with no inputs
  }, [
    demoRunModalOpen,
    demoVerificationPhase,
    demoRunState?.phase,
    demoRunState?.status,
    demoRunState?.inputs?.length,
  ]);

  useEffect(() => {
    if (!upNextSentinelRef.current) return;
    if (!upNextHasMore) return;

    const el = upNextSentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) loadMoreUpNext(false);
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 },
    );

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNextHasMore, upNextCursor, upNextLoading]);

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-[#050505] text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
          <p className="text-sm text-white/60">Loading workflow…</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <EdgazeNotFoundScreen
        code="WF-404"
        eyebrow="Workflow unavailable"
        title="This workflow is not on the marketplace right now."
        description="It may have been unpublished, moved to a new Edgaze code, or the link was typed incorrectly. Head back to discovery and find another premium workflow to run."
        primaryHref="/marketplace"
        primaryLabel="Browse workflows"
      />
    );
  }

  if (listing.removed_at) {
    const reasonText =
      listing.removed_by === "owner"
        ? "Removed by owner"
        : listing.removed_reason || "This item has been removed.";
    return (
      <div className="flex h-full flex-col bg-[#050505] text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-lg font-semibold">This item has been removed</p>
          <p className="text-sm text-white/70 text-center max-w-md">{reasonText}</p>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:border-cyan-400 hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      <PurchaseSuccessModal
        open={purchaseSuccessOpen}
        title={listing.title || "Untitled workflow"}
        onClose={() => setPurchaseSuccessOpen(false)}
        onOpenStudio={() => {
          setPurchaseSuccessOpen(false);
          openWorkflowStudio();
        }}
      />

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={canonicalShareUrl}
        code={listing.edgaze_code || ""}
        ownerHandle={creatorHandle || listing.owner_handle || ""}
        title={listing.title}
      />

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="workflow"
        targetId={listing.id}
        targetTitle={listing.title}
        targetOwnerHandle={creatorHandle || listing.owner_handle}
        targetOwnerName={listing.owner_name}
      />

      {/* Demo Run Modal */}
      <CustomerWorkflowRunModal
        open={demoRunModalOpen}
        showExecutionTimer={isAdmin}
        demoImageWatermarkEnabled
        demoImageWatermarkOwnerHandle={listing?.owner_handle || ownerHandle || ""}
        onClose={() => {
          const activelyRunning =
            demoRunState?.status === "running" || demoRunState?.status === "cancelling";
          if (!activelyRunning && !turnstileVerifying) {
            demoRunAbortRef.current?.abort();
            demoRunSessionPollRef.current?.abort();
            setDemoRunModalOpen(false);
            setDemoRunState(null);
            setDemoExecutionGraph(null);
            setDemoVerificationPhase("idle");
            setDemoVerificationError(null);
            setTurnstileToken(null);
          }
        }}
        state={demoModalState}
        customBody={
          demoVerificationPhase === "idle" ? null : (
            <div className="mx-auto flex h-full w-full max-w-[420px] flex-col justify-center gap-2.5 px-0 py-0.5 text-white md:max-w-[500px] md:gap-5 md:px-1 md:py-2">
              {demoVerificationPhase === "checking" ? (
                <div className="flex flex-col items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-6 text-center md:gap-4 md:rounded-[28px] md:px-6 md:py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-300 md:h-10 md:w-10" />
                  <div className="space-y-2">
                    <div className="text-[16px] font-semibold text-white md:text-xl">
                      Checking demo eligibility...
                    </div>
                    <div className="text-[12px] leading-[1.1rem] text-white/60 md:text-sm md:leading-6">
                      Verifying device and usage limits before we start the run.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-[20px] border border-amber-300/15 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(255,255,255,0.02))] p-3.5 md:rounded-[28px] md:p-5">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[18px] border border-amber-300/20 bg-amber-400/10 md:h-11 md:w-11 md:rounded-2xl">
                        <Lock className="h-4 w-4 text-amber-100 md:h-5 md:w-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/70 md:text-[13px] md:tracking-[0.18em]">
                          Demo Verification
                        </div>
                        <div className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-white md:mt-2 md:text-2xl md:tracking-tight">
                          Verify here to continue the run
                        </div>
                        <div className="mt-1.5 text-[12px] leading-[1.1rem] text-white/62 md:mt-2 md:text-sm md:leading-6">
                          Complete the security check below and we will continue this demo in the
                          same run modal. No separate verification popup needed.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3.5 md:rounded-[28px] md:p-5">
                    <div className="mb-2.5 text-[12px] leading-[1.1rem] text-white/68 md:mb-4 md:text-sm md:leading-6">
                      This protects the demo from abuse while keeping the run flow in one place.
                      Each device gets one demo run.
                    </div>

                    <div
                      className="flex min-h-[92px] justify-center rounded-[16px] border border-white/8 bg-black/20 p-2.5 md:min-h-[120px] md:rounded-[22px] md:p-4"
                      key="turnstile-inline-verification"
                    >
                      <TurnstileWidget onToken={handleTurnstileToken} />
                    </div>

                    {turnstileVerifying ? (
                      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/72">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying...
                      </div>
                    ) : null}

                    {demoVerificationError ? (
                      <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                        {demoVerificationError}
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )
        }
        canCloseOverride={
          demoVerificationPhase === "idle"
            ? undefined
            : demoVerificationPhase !== "checking" && !turnstileVerifying
        }
        onCancel={async () => {
          let runId: string | undefined;
          let runAccessToken: string | undefined;
          setDemoRunState((prev) => {
            runId = prev?.runId ?? undefined;
            runAccessToken = prev?.runAccessToken ?? undefined;
            if (prev?.status === "running") {
              return { ...prev, status: "cancelling", error: undefined };
            }
            return prev;
          });

          demoRunSessionPollRef.current?.abort();
          demoRunSessionPollRef.current = null;
          demoRunAbortRef.current?.abort();

          if (runId) {
            try {
              const accessToken = userId ? await getAccessToken() : null;
              const headers: HeadersInit = { "Content-Type": "application/json" };
              if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
              const query = runAccessToken
                ? `?runAccessToken=${encodeURIComponent(runAccessToken)}`
                : "";
              await fetch(`/api/runs/${encodeURIComponent(runId)}/cancel${query}`, {
                method: "POST",
                headers,
                credentials: "include",
              });
              return;
            } catch {}
          }
          setDemoRunState((prev) =>
            prev ? { ...prev, status: "cancelled", error: undefined } : null,
          );
          setDemoRunning(false);
        }}
        onRerun={() => {
          setDemoRunState(null);
          setDemoRunModalOpen(false);
          setTimeout(() => handleDemoButtonClick(), 100);
        }}
        onSubmitInputs={handleDemoSubmitInputs}
        onBuyWorkflow={() => {
          setDemoRunModalOpen(false);
          grantAccessOrOpen();
        }}
      />

      {/* Desktop top bar */}
      <header className="hidden sm:block sticky top-0 z-30 border-b border-white/10 bg-[#050505]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs text-white/75 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Marketplace
            </button>

            <span className="truncate text-xs text-white/40">
              edgaze.ai/{creatorHandle}/{listing.edgaze_code}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>

            <button
              type="button"
              onClick={() => {
                safeTrack("Report Button Clicked", {
                  surface: "product_page",
                  location: "desktop_header",
                  listing_id: listing?.id,
                  edgaze_code: listing?.edgaze_code,
                });
                setReportOpen(true);
              }}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
              title="Report"
              aria-label="Report"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <ProfileAvatar
                name={creatorProfile?.full_name || listing.owner_name || creatorHandle}
                avatarUrl={creatorProfile?.avatar_url || null}
                size={32}
                handle={creatorHandle}
              />
              <div className="hidden sm:flex flex-col leading-tight min-w-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <ProfileLink
                    name={creatorProfile?.full_name || listing.owner_name || "Creator"}
                    handle={creatorHandle}
                    verified={Boolean(creatorProfile?.is_verified_creator)}
                    className="min-w-0 truncate text-xs font-medium text-white/90"
                  />
                </div>
                {creatorHandle && (
                  <ProfileLink
                    name={`@${creatorHandle}`}
                    handle={creatorHandle}
                    className="truncate text-[11px] text-white/50"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <div className="sm:hidden sticky top-0 z-30 bg-[#050505]/85 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={goBack}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/5 text-white/85"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={grantAccessOrOpen}
            disabled={purchaseLoading}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 h-10 text-xs font-semibold",
              purchaseLoading
                ? "bg-white/10 text-white/70 border border-white/10"
                : "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_16px_rgba(56,189,248,0.6)]",
            )}
          >
            {purchaseLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isOwned ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            <span className="flex items-center gap-1.5">
              {isOwned ? "Open" : primaryCtaLabel}
              {!isOwned && !isNaturallyFree && (
                <span className="tabular-nums text-black/80 opacity-90">· {paidLabel}</span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/5 text-white/85"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-4 py-5 sm:px-6">
          {purchaseError && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
              <div className="font-semibold">Access error</div>
              <div className="mt-1 text-rose-100/80">{purchaseError}</div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
            {/* LEFT */}
            <div className="min-w-0">
              <section className="relative overflow-hidden rounded-2xl bg-black/60 border border-white/10">
                <div className="aspect-video w-full overflow-hidden">
                  {activeDemo ? (
                    <img
                      src={activeDemo}
                      alt={listing.title || "Workflow demo image"}
                      className="h-full w-full cursor-pointer object-cover object-center"
                      role="button"
                      tabIndex={0}
                      aria-label="View larger image"
                      onClick={() => setLightboxOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setLightboxOpen(true);
                        }
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-xs text-white/50">
                      No demo images yet.
                    </div>
                  )}
                </div>

                {demoImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setMainDemoIndex((prev) => (prev === 0 ? demoImages.length - 1 : prev - 1))
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white hover:border-cyan-400"
                      aria-label="Previous"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMainDemoIndex((prev) => (prev === demoImages.length - 1 ? 0 : prev + 1))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white hover:border-cyan-400"
                      aria-label="Next"
                    >
                      {">"}
                    </button>
                  </>
                )}
              </section>

              {demoImages.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {demoImages.map((img, idx) => (
                    <button
                      key={img + idx}
                      type="button"
                      onClick={() => {
                        setMainDemoIndex(idx);
                        setLightboxOpen(true);
                      }}
                      className={cn(
                        "relative aspect-video w-20 flex-none overflow-hidden rounded-xl border border-white/10 bg-black/60",
                        idx === mainDemoIndex &&
                          "border-cyan-400 shadow-[0_0_14px_rgba(56,189,248,0.55)]",
                      )}
                      aria-label={`Select demo ${idx + 1}`}
                    >
                      {}
                      <img
                        src={img}
                        alt={`Demo ${idx + 1}`}
                        className="h-full w-full object-cover object-center"
                      />
                    </button>
                  ))}
                </div>
              )}

              <ListingImageLightbox
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                images={demoImages}
                activeIndex={mainDemoIndex}
                onActiveIndexChange={setMainDemoIndex}
                title={listing?.title}
                onNavigate={(direction, newIndex) => {
                  safeTrack("Demo Image Navigated", {
                    surface: "lightbox",
                    direction,
                    index: newIndex,
                    total_images: demoImages.length,
                    listing_id: listing?.id,
                  });
                }}
              />

              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-[3px] text-[11px] font-medium bg-pink-500/15 text-pink-200">
                    Workflow
                  </span>

                  {listing.edgaze_code && (
                    <span className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-2 py-[3px] text-[11px] font-semibold text-black shadow-[0_0_14px_rgba(56,189,248,0.55)]">
                      /{listing.edgaze_code}
                    </span>
                  )}

                  {ownershipBadgeLabel && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-[3px] text-[11px] font-semibold text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {ownershipBadgeLabel}
                    </span>
                  )}

                  {!isOwner && (
                    <span className="rounded-full bg-white/5 px-2 py-[3px] text-[11px] font-semibold text-white/70">
                      Preview only
                    </span>
                  )}
                </div>

                {/* Title + prominent mobile price */}
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <h1 className="text-[18px] sm:text-[22px] font-semibold leading-snug flex-1 min-w-0">
                    {listing.title || "Untitled workflow"}
                  </h1>
                  <div
                    className={cn(
                      "flex w-full shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-3.5 text-center lg:hidden",
                      isNaturallyFree
                        ? "border-emerald-400/30 bg-emerald-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-8px_rgba(52,211,153,0.25)]"
                        : "border-white/15 bg-white/[0.06]",
                    )}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
                      Price
                    </span>
                    <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
                      <span
                        className={cn(
                          "text-[22px] font-semibold leading-none tracking-tight tabular-nums",
                          isNaturallyFree ? "text-emerald-400" : "text-white",
                        )}
                      >
                        {paidLabel}
                      </span>
                      {!isNaturallyFree && paidLabel !== "Paid" && (
                        <span className="text-[11px] font-medium text-white/45">one-time</span>
                      )}
                    </div>
                  </div>
                </div>

                {SHOW_PUBLIC_LIKES_AND_RUNS && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
                    <span className="inline-flex items-center gap-1.5 tabular-nums text-white/65">
                      <Zap className="h-4 w-4 shrink-0 text-cyan-300/90" />
                      {listing.runs_count ?? 0} runs
                    </span>
                    <button
                      type="button"
                      disabled={likeBusy}
                      onClick={async () => {
                        if (!requireAuth()) return;
                        if (!listing) return;
                        setLikeBusy(true);
                        try {
                          const token = await getAccessToken();
                          const res = await fetch("/api/marketplace/like", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            credentials: "include",
                            body: JSON.stringify({
                              itemId: listing.id,
                              itemType: "workflow",
                            }),
                          });
                          const j = (await res.json().catch(() => ({}))) as {
                            likesCount?: number;
                            isLiked?: boolean;
                          };
                          if (res.ok && typeof j.likesCount === "number") {
                            setLikeCount(j.likesCount);
                            setIsLiked(Boolean(j.isLiked));
                          }
                        } finally {
                          setLikeBusy(false);
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                        isLiked
                          ? "border-pink-400/40 bg-pink-500/15 text-pink-100"
                          : "border-white/15 bg-white/[0.06] text-white/70 hover:border-white/25 hover:text-white/90",
                      )}
                    >
                      <Heart className="h-4 w-4" fill={isLiked ? "currentColor" : "none"} />
                      {likeCount} likes
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ProfileAvatar
                    name={creatorProfile?.full_name || listing.owner_name || creatorHandle}
                    avatarUrl={creatorProfile?.avatar_url || null}
                    size={40}
                    handle={creatorHandle}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <ProfileLink
                        name={creatorProfile?.full_name || listing.owner_name || "Creator"}
                        handle={creatorHandle}
                        verified={Boolean(creatorProfile?.is_verified_creator)}
                        className="min-w-0 truncate text-sm font-medium text-white/90"
                      />
                    </div>
                    <ProfileLink
                      name={`@${creatorHandle || "creator"}`}
                      handle={creatorHandle}
                      className="truncate text-[12px] text-white/55"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={grantAccessOrOpen}
                  className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-cyan-400/70"
                >
                  {isOwned ? <Sparkles className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {isOwned ? "Open" : primaryCtaLabel}
                </button>
              </div>

              {/* Mobile: Try demo - placed directly below creator info */}
              <div className="sm:hidden mt-4 flex flex-col gap-2">
                {listing && (
                  <button
                    type="button"
                    onClick={handleDemoButtonClick}
                    disabled={demoButtonBusy || !demoButtonEnabled}
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold border transition-all",
                      demoButtonEnabled
                        ? "border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 text-amber-200 shadow-[0_4px_16px_rgba(251,191,36,0.3)] hover:from-amber-500/30 hover:via-yellow-500/30 hover:to-amber-500/30"
                        : "cursor-not-allowed border-white/10 bg-[#111317] text-white/38 shadow-none",
                    )}
                    title={demoButtonTitle}
                  >
                    {demoButtonBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {demoButtonLabel}
                  </button>
                )}
                {listing && demoAvailable === false && (
                  <div className="rounded-2xl border border-white/10 bg-[#111317] px-3 py-2 text-[11px] text-white/60">
                    Demo already used for this workflow on this device. Buy access to run it again.
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-sm leading-relaxed text-white/75">
                  {listing.description || "No description provided yet."}
                </p>

                {listing.tags && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
                    {listing.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((t) => (
                        <span key={t} className="rounded-full bg-white/5 px-2 py-1">
                          #{t}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              <div className="lg:hidden mt-4 rounded-2xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
                <div className="font-semibold text-white/80">What you get</div>
                <div className="mt-2 space-y-1.5 leading-relaxed">
                  <div>• 10 hosted runs included</div>
                  <div>• Use your own API key after hosted runs are finished</div>
                  <div>• Workflow Studio in preview mode (no edit access)</div>
                </div>
              </div>

              <div className="hidden sm:block mt-6 border-t border-white/10 pt-6">
                <WorkflowCommentsSection listingId={listing.id} listingOwnerId={listing.owner_id} />
              </div>

              {/* Mobile: preview a few comments, open full sheet on tap (match prompt styling) */}
              <div className="sm:hidden mt-6 border-t border-white/10 pt-5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setCommentsOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setCommentsOpen(true);
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left cursor-pointer select-none"
                  aria-label="Open comments"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-white/85">Comments</div>
                    <div className="text-[11px] text-white/55">Tap to view</div>
                  </div>

                  <div className="mt-3 max-h-[140px] overflow-hidden relative">
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#050505] to-transparent" />
                    <div className="pointer-events-none opacity-90">
                      <WorkflowCommentsSection
                        listingId={listing.id}
                        listingOwnerId={listing.owner_id}
                      />
                    </div>
                  </div>
                </div>

                {commentsOpen && (
                  <div className="fixed inset-0 z-[110]">
                    <div
                      className="absolute inset-0 bg-black/80"
                      onClick={() => setCommentsOpen(false)}
                    />
                    <div className="absolute inset-x-0 bottom-0 top-[10%] rounded-t-3xl border border-white/10 bg-[#050505] overflow-hidden">
                      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                        <div className="text-[14px] font-semibold text-white">Comments</div>
                        <button
                          type="button"
                          onClick={() => setCommentsOpen(false)}
                          className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80"
                          aria-label="Close comments"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="h-[calc(100%-52px)] overflow-y-auto px-4 py-4">
                        <WorkflowCommentsSection
                          listingId={listing.id}
                          listingOwnerId={listing.owner_id}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile up next */}
              <div className="lg:hidden mt-8 border-t border-white/10 pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/85">Up next</h3>
                  <span className="text-[11px] text-white/45">Workflows</span>
                </div>

                <div className="flex flex-col gap-3">
                  {upNext.map((s) => {
                    const suggestionFree = s.monetisation_mode === "free" || s.is_paid === false;
                    const href =
                      s.owner_handle && s.edgaze_code
                        ? `/${s.owner_handle}/${s.edgaze_code}`
                        : null;
                    const suggestionPaidLabel = suggestionFree
                      ? "Free"
                      : s.price_usd != null
                        ? `$${Number(s.price_usd).toFixed(2)}`
                        : "Paid";

                    const thumb = s.thumbnail_url || s.banner_url || null;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!href}
                        onClick={() => href && router.push(href as any)}
                        className={cn(
                          "group flex w-full items-start gap-3 text-left",
                          !href && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <div className="relative h-20 w-36 flex-none overflow-hidden rounded-xl bg-black/60 border border-white/10">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={s.title || "Workflow thumbnail"}
                              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
                              Workflow
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] font-semibold text-white/90">
                            {s.title || "Untitled workflow"}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 min-w-0">
                            <span className="truncate text-[12px] text-white/55">
                              @{s.owner_handle || s.owner_name || "creator"}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="truncate text-[11px] text-white/40">
                              {s.tags
                                ? s.tags
                                    .split(",")
                                    .map((t) => t.trim())
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((t) => `#${t}`)
                                    .join("  ")
                                : ""}
                            </p>

                            <span
                              className={cn(
                                "text-[12px] font-semibold tabular-nums",
                                suggestionFree ? "text-emerald-400" : "text-white/75",
                              )}
                            >
                              {suggestionPaidLabel}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <div ref={upNextSentinelRef} className="h-8" />

                  {upNextLoading && (
                    <div className="flex items-center gap-2 text-[12px] text-white/60">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading…</span>
                    </div>
                  )}

                  {!upNextHasMore && upNext.length > 0 && (
                    <p className="text-[12px] text-white/45">You reached the end.</p>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <aside className="min-w-0 hidden lg:block">
              <div className="lg:sticky lg:top-[76px]">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_30px_rgba(15,23,42,0.65)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">
                        {isOwner
                          ? "This workflow is yours"
                          : isOwned
                            ? "You own this workflow"
                            : "Unlock this workflow"}
                      </h2>
                      <p className="mt-1 text-[12px] text-white/55">
                        {isOwner
                          ? "Open it in Workflow Studio with full edit access."
                          : isOwned
                            ? "Open it in Workflow Studio (read-only)."
                            : "Access attaches to your Edgaze account."}
                      </p>
                    </div>

                    {ownershipBadgeLabel && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {ownershipBadgeLabel}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-[11px] text-white/45">
                        {isOwner ? "Listing price" : "Price"}
                      </div>
                      <div
                        className={cn(
                          "text-2xl font-semibold tabular-nums",
                          isNaturallyFree ? "text-emerald-400" : "text-white",
                        )}
                      >
                        {paidLabel}
                      </div>
                      {!isNaturallyFree && paidLabel !== "Paid" && (
                        <span className="text-[12px] text-white/55">one-time</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={grantAccessOrOpen}
                      disabled={purchaseLoading}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold",
                        purchaseLoading
                          ? "bg-white/10 text-white/70 border border-white/10"
                          : "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_22px_rgba(56,189,248,0.75)]",
                      )}
                    >
                      {purchaseLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isOwned ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      {isOwned
                        ? isOwner
                          ? "Open in Workflow Studio"
                          : "Open in Workflow Studio (Preview)"
                        : primaryCtaLabel}
                    </button>

                    {!isOwned && (
                      <p className="mt-3 text-[11px] text-white/45">
                        By {isNaturallyFree ? "getting access" : "purchasing"}, you agree to our{" "}
                        <a
                          href="/docs/terms-of-service"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/60 hover:text-white underline underline-offset-4"
                        >
                          Terms of Service
                        </a>
                        ,{" "}
                        <a
                          href="/docs/privacy-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/60 hover:text-white underline underline-offset-4"
                        >
                          Privacy Policy
                        </a>
                        {!isNaturallyFree && (
                          <>
                            , and{" "}
                            <a
                              href="/docs/refund-policy"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white/60 hover:text-white underline underline-offset-4"
                            >
                              Refund Policy
                            </a>
                          </>
                        )}
                        .
                      </p>
                    )}

                    {/* Try demo - available to anyone (anonymous + logged in) */}
                    {listing && (
                      <button
                        type="button"
                        onClick={handleDemoButtonClick}
                        disabled={demoButtonBusy || !demoButtonEnabled}
                        className={cn(
                          "flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all",
                          demoButtonEnabled
                            ? "border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 text-amber-200 shadow-[0_4px_20px_rgba(251,191,36,0.3)] hover:from-amber-500/30 hover:via-yellow-500/30 hover:to-amber-500/30 hover:shadow-[0_6px_24px_rgba(251,191,36,0.4)]"
                            : "cursor-not-allowed border-white/10 bg-[#111317] text-white/38 shadow-none",
                        )}
                        title={demoButtonTitle}
                      >
                        {demoButtonBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        {demoButtonLabel}
                      </button>
                    )}
                    {listing && demoAvailable === false && (
                      <p className="text-[11px] text-white/52">
                        Demo already used for this workflow on this device. Buy access to run it
                        again.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:border-cyan-400/70"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        safeTrack("Report Button Clicked", {
                          surface: "product_page",
                          location: "sidebar",
                          listing_id: listing?.id,
                          edgaze_code: listing?.edgaze_code,
                        });
                        setReportOpen(true);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white/80"
                    >
                      <Flag className="h-3 w-3" /> Report
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
                    <div className="font-semibold text-white/80">What you get</div>
                    <div className="mt-2 space-y-1.5 leading-relaxed">
                      <div>• 10 hosted runs included</div>
                      <div>• Use your own API key after hosted runs are finished</div>
                      <div>• Workflow Studio in preview mode (no edit access)</div>
                    </div>
                  </div>
                </section>

                <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/85">Up next</h3>
                    <span className="text-[11px] text-white/45">Workflows</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {upNext.map((s) => {
                      const suggestionFree = s.monetisation_mode === "free" || s.is_paid === false;
                      const href =
                        s.owner_handle && s.edgaze_code
                          ? `/${s.owner_handle}/${s.edgaze_code}`
                          : null;
                      const suggestionPaidLabel = suggestionFree
                        ? "Free"
                        : s.price_usd != null
                          ? `$${Number(s.price_usd).toFixed(2)}`
                          : "Paid";
                      const thumb = s.thumbnail_url || s.banner_url || null;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!href}
                          onClick={() => href && router.push(href as any)}
                          className={cn(
                            "group flex w-full items-start gap-3 text-left",
                            !href && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <div className="relative h-20 w-36 flex-none overflow-hidden rounded-xl bg-black/60 border border-white/10">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={s.title || "Workflow thumbnail"}
                                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
                                Workflow
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[13px] font-semibold text-white/90">
                              {s.title || "Untitled workflow"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 min-w-0">
                              <span className="truncate text-[12px] text-white/55">
                                @{s.owner_handle || s.owner_name || "creator"}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <p className="truncate text-[11px] text-white/40">
                                {s.tags
                                  ? s.tags
                                      .split(",")
                                      .map((t) => t.trim())
                                      .filter(Boolean)
                                      .slice(0, 2)
                                      .map((t) => `#${t}`)
                                      .join("  ")
                                  : ""}
                              </p>

                              <span
                                className={cn(
                                  "text-[12px] font-semibold tabular-nums",
                                  suggestionFree ? "text-emerald-400" : "text-white/75",
                                )}
                              >
                                {suggestionPaidLabel}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    <div ref={upNextSentinelRef} className="h-8" />

                    {upNextLoading && (
                      <div className="flex items-center gap-2 text-[12px] text-white/60">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading…</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
