// src/app/p/[ownerHandle]/[edgazeCode]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  Eye,
  Heart,
  Sparkles,
  Share2,
  X,
  Link as LinkIcon,
  Copy,
  Download,
  RotateCcw,
  ExternalLink,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/browser";
import { useAuth } from "../../../../components/auth/AuthContext";
import { track } from "../../../../lib/mixpanel";
import CommentsSectionRaw from "../../../../components/marketplace/CommentsSection";
const CommentsSection = CommentsSectionRaw as unknown as React.ComponentType<any>;

function safeTrack(event: string, props?: Record<string, any>) {
  try {
    track(event, props);
  } catch {}
}

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall" | "subscription" | "both" | null;

type PromptPlaceholder = {
  key: string;
  question?: string | null;
  label?: string | null;
  hint?: string | null;
  required?: boolean | null;
  default?: string | null;
};

type PromptListing = {
  id: string;
  owner_id: string | null; // prompts.owner_id is TEXT
  owner_name: string | null;
  owner_handle: string | null;
  type: "prompt" | "workflow" | null;
  edgaze_code: string | null;
  title: string | null;
  description: string | null;
  tags: string | null;
  thumbnail_url: string | null;
  prompt_text: string | null;
  placeholders: any | null; // jsonb
  demo_images: string[] | null;
  output_demo_urls: string[] | null;
  visibility: Visibility | null;
  monetisation_mode: MonetisationMode;
  is_paid: boolean | null;
  price_usd: number | null;
  view_count: number | null;
  like_count: number | null;
};

type PurchaseRow = {
  id: string;
  status: string; // prompt_purchases.status (text)
};

type PublicProfileLite = {
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
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

/* ---------- QR helpers ---------- */
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
      "QR generation"
    );
    return String(dataUrl);
  } catch {
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), 6000);
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(text)}`;
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

/* ---------- Placeholders + fill helpers ---------- */
function coercePlaceholders(raw: any): PromptPlaceholder[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (!x) return null;
        if (typeof x === "string") return { key: x };
        if (typeof x === "object") {
          const key = String((x as any).key ?? (x as any).name ?? (x as any).id ?? "").trim();
          if (!key) return null;
          return {
            key,
            question: (x as any).question ?? null,
            label: (x as any).label ?? null,
            hint: (x as any).hint ?? null,
            required: (x as any).required ?? null,
            default: (x as any).default ?? null,
          };
        }
        return null;
      })
      .filter(Boolean) as PromptPlaceholder[];
  }
  if (typeof raw === "object") {
    return Object.entries(raw).map(([k, v]) => ({
      key: String(k),
      question: typeof v === "string" ? v : null,
    }));
  }
  return [];
}

function extractMustacheKeys(text: string): string[] {
  if (!text) return [];
  const keys = new Set<string>();
  const re = /{{\s*([a-zA-Z0-9_\-\.]+)\s*}}/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(text)) !== null) {
    const k = (m[1] || "").trim();
    if (k) keys.add(k);
  }
  return Array.from(keys);
}

function fillPrompt(template: string, values: Record<string, string>): string {
  if (!template) return "";
  return template.replace(/{{\s*([a-zA-Z0-9_\-\.]+)\s*}}/g, (_m, k) => {
    const key = String(k || "").trim();
    return values[key] ?? "";
  });
}

/* ---------- Providers prefill URLs ---------- */
type Provider = "edgaze" | "chatgpt" | "claude" | "gemini" | "perplexity";
const EDGAZE_RUN_COMING_SOON = true;

function providerInfo(p: Provider) {
  if (p === "edgaze")
    return { name: "Edgaze", sub: "Coming soon", icon: "/brand/edgaze-mark.png", kind: "internal" as const };
  if (p === "chatgpt") return { name: "ChatGPT", sub: "Prefill", icon: "/misc/chatgpt.png", kind: "external" as const };
  if (p === "claude") return { name: "Claude", sub: "Prefill", icon: "/misc/claude.png", kind: "external" as const };
  if (p === "gemini") return { name: "Gemini", sub: "AI Studio", icon: "/misc/gemini.png", kind: "external" as const };
  return { name: "Perplexity", sub: "Search", icon: "/misc/perplexity.png", kind: "external" as const };
}

function buildProviderUrl(p: Provider, filledPrompt: string) {
  const enc = encodeURIComponent(filledPrompt || "");
  if (p === "chatgpt") return `https://chatgpt.com/?q=${enc}`;
  if (p === "claude") return `https://claude.ai/new?q=${enc}`;
  if (p === "perplexity") return `https://www.perplexity.ai/search?q=${enc}`;
  if (p === "gemini") return `https://aistudio.google.com/app/prompts/new_chat?prompt=${enc}`;
  return "";
}

/* ---------- Share helpers ---------- */
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

/* ---------- Auto-fit circle icon (aggressive: fills circle despite PNG padding) ---------- */
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

        // scale factor to make contentMax fill inner, relative to drawn size==size
        const boundsFill = CAN / contentMax;
        const target = (inner / size) * boundsFill;

        // slightly overfill so it visually hits the circle edge
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
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
  const [copied, setCopied] = useState(false);
  const [shareBusy, setShareBusy] = useState<ShareApp | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    safeTrack("Share Modal Opened", {
      surface: "product_page",
      edgaze_code: code,
      owner_handle: ownerHandle,
      title: title || undefined,
    });

    setCopied(false);
    setShareBusy(null);

    let alive = true;
    (async () => {
      setQrBusy(true);
      try {
        const qr = await withTimeout(qrWithCenteredLogoDataUrl(shareUrl), 9000, "QR render");
        if (alive) setQrDataUrl(qr);
      } catch {
        if (alive) setQrDataUrl(null);
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
      
      safeTrack("Product Shared", {
        surface: "share_modal",
        method: app,
        edgaze_code: code,
        owner_handle: ownerHandle,
        title: title || undefined,
      });
      
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
        <div className="relative w-[min(980px,96vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.8)]">
          {/* Header */}
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
                <div className="hidden sm:block text-[11px] text-white/50">Link, QR, and quick-share</div>
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

          {/* Body */}
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-12 gap-3 sm:gap-5">
              {/* Left: code + link */}
              <div className="col-span-12 sm:col-span-7">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="text-[11px] font-semibold text-white/70">Edgaze code</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-[30px] sm:text-[40px] font-semibold tracking-tight text-white leading-none">
                      {code || "—"}
                    </div>
                    <div className="text-right text-[11px] text-white/45">
                      <span className="text-white/70 font-semibold">@{ownerHandle || "creator"}</span>
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
                          safeTrack("Share Link Copied", {
                            surface: "share_modal",
                            edgaze_code: code,
                            owner_handle: ownerHandle,
                            location: "share_modal_link",
                          });
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
                      {(["whatsapp", "x", "snapchat", "reddit", "facebook"] as ShareApp[]).map((app) => {
                        const info = shareAppInfo(app);
                        const busy = shareBusy === app;
                        return (
                          <button
                            key={app}
                            type="button"
                            onClick={() => onShareApp(app)}
                            className={cn(
                              "group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/10",
                              busy && "opacity-70"
                            )}
                            aria-label={`Share to ${info.name}`}
                            title={info.name}
                          >
                            {busy ? (
                              <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border border-white/10 bg-black/30">
                                <Loader2 className="h-4 w-4 animate-spin text-white/70" />
                              </span>
                            ) : (
                              <AutoFitCircleIcon src={info.icon} alt={info.name} size={28} pad={1} maxScale={3.6} />
                            )}

                            <span className="hidden sm:inline">{info.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2 text-[11px] text-white/45">
                      Tapping an app also copies the link for reliable pasting.
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: QR */}
              <div className="col-span-12 sm:col-span-5">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-white/70">QR code</div>
                    <button
                      type="button"
                      onClick={async () => {
                        setQrBusy(true);
                        try {
                          const qr = await withTimeout(qrWithCenteredLogoDataUrl(shareUrl), 9000, "QR render");
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
                    <div className="h-[150px] w-[150px] sm:h-[210px] sm:w-[210px] overflow-hidden rounded-2xl bg-white/[0.03] grid place-items-center">
                      {qrBusy ? (
                        <div className="inline-flex items-center gap-2 text-[12px] text-white/60">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating…
                        </div>
                      ) : qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrDataUrl} alt="Edgaze QR" className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-[12px] text-white/55">QR unavailable</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!qrDataUrl}
                      onClick={() => {
                        if (qrDataUrl) {
                          downloadDataUrl(qrDataUrl, `edgaze-qr-${code || "prompt"}.png`);
                          safeTrack("QR Code Downloaded", {
                            surface: "share_modal",
                            edgaze_code: code,
                            owner_handle: ownerHandle,
                          });
                        }
                      }}
                      className={cn(
                        "h-10 sm:h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 sm:px-4 text-[12px] font-semibold text-white/90 hover:bg-white/10",
                        !qrDataUrl && "opacity-60 cursor-not-allowed"
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
                        setCopied(true);
                        safeTrack("Share Link Copied", {
                          surface: "share_modal",
                          edgaze_code: code,
                          owner_handle: ownerHandle,
                          location: "share_modal_qr_section",
                        });
                        setTimeout(() => setCopied(false), 900);
                      }}
                      className="h-10 sm:h-11 flex-1 rounded-2xl bg-white px-3 sm:px-4 text-[12px] font-semibold text-black hover:bg-white/90"
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <Copy className="h-4 w-4" />
                        Copy link
                      </span>
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/55">
                    Scan to open instantly.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-gradient-to-r from-cyan-400/40 via-white/10 to-pink-500/40" />
        </div>
      </div>
    </div>
  );
}


function BlurredPreview({ text, kind }: { text: string; kind: "prompt" | "workflow" }) {
  const snippet =
    (text || (kind === "workflow" ? "EDGAZE WORKFLOW" : "EDGAZE PROMPT"))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32)
      .toUpperCase() || (kind === "workflow" ? "EDGAZE WORKFLOW" : "EDGAZE PROMPT");

  const label = kind === "workflow" ? "WORKFLOW" : "PROMPT";

  return (
    <div className="relative h-28 w-full overflow-hidden rounded-2xl bg-slate-950/90">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="scale-[1.5] blur-2xl opacity-80">
          <div className="whitespace-nowrap text-5xl font-extrabold tracking-[0.35em] text-white/30">{snippet}</div>
        </div>
      </div>

      <div className="absolute inset-3 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-cyan-400/90 via-cyan-400/20 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-pink-500/90 via-pink-500/20 to-transparent" />

      <div className="relative flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[10px] tracking-[0.15em] text-white/70">
            {label}
          </div>
          <div className="text-[11px] text-white/50">Protected preview.</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Run modal ---------- */
function RunModal({
  open,
  onClose,
  title,
  template,
  placeholders,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  template: string;
  placeholders: PromptPlaceholder[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [providerHint, setProviderHint] = useState<Provider>("chatgpt");
  const [mobileTab, setMobileTab] = useState<"fields" | "prompt">("fields");
  const openedAtRef = useRef<number | null>(null);
  const fieldFillsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      openedAtRef.current = null;
      fieldFillsRef.current.clear();
      return;
    }
    
    openedAtRef.current = Date.now();
    safeTrack("Prompt Run Modal Opened", {
      surface: "product_page",
      title,
      placeholder_count: placeholders.length,
      template_length: template.length,
      has_required_fields: placeholders.some((p) => Boolean(p.required)),
    });
    
    const init: Record<string, string> = {};
    placeholders.forEach((p) => {
      init[p.key] = (p.default ?? "").toString();
    });
    setValues(init);
    setCopied(false);
    setProviderHint("chatgpt");
    setMobileTab(placeholders.length > 0 ? "fields" : "prompt");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const filled = fillPrompt(template, values);

  const anyMissingRequired = placeholders.some((p) => {
    const req = Boolean(p.required);
    if (!req) return false;
    const v = (values[p.key] ?? "").trim();
    return !v;
  });

  async function openProvider(p: Provider) {
    setProviderHint(p);

    const filledLength = filled.trim().length;
    const filledFields = Object.values(values).filter((v) => v.trim()).length;
    const allRequiredFilled = !anyMissingRequired;

    safeTrack("Prompt Provider Selected", {
      surface: "run_modal",
      provider: p,
      title,
      placeholder_count: placeholders.length,
      filled_fields: filledFields,
      all_required_filled: allRequiredFilled,
      prompt_length: filledLength,
      time_in_modal_ms: openedAtRef.current ? Date.now() - openedAtRef.current : undefined,
    });

    if (filled.trim()) {
      const ok = await copyToClipboard(filled);
      setCopied(ok);
      if (ok) {
        safeTrack("Prompt Copied", {
          surface: "run_modal",
          provider: p,
          prompt_length: filledLength,
          filled_fields: filledFields,
        });
      }
      setTimeout(() => setCopied(false), 900);
    }

    if (p === "edgaze") return;
    const url = buildProviderUrl(p, filled);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const Providers = (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {(["edgaze", "chatgpt", "claude", "gemini", "perplexity"] as Provider[]).map((p) => {
        const info = providerInfo(p);
        const active = providerHint === p;
        const isEdgazeDisabled = p === "edgaze" && EDGAZE_RUN_COMING_SOON;
        const disabled = isEdgazeDisabled || (p !== "edgaze" && !filled.trim());

        return (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => openProvider(p)}
            className={cn(
              "rounded-2xl border px-3 py-2 text-left",
              active ? "border-cyan-400/60 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10",
              disabled && "opacity-60 cursor-not-allowed"
            )}
            title={isEdgazeDisabled ? "Run in Edgaze is coming soon" : undefined}
          >
            <div className="flex items-center gap-2">
              <Image src={info.icon} alt={info.name} width={18} height={18} className="h-[18px] w-[18px]" />
              <div className="min-w-0">
                <div className={cn("text-[12px] font-semibold leading-tight", isEdgazeDisabled ? "text-white/70" : "text-white")}>
                  {info.name}
                </div>
                <div className="text-[10px] text-white/45 leading-tight">{info.sub}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const FieldsPanel = (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-white/90">Fill placeholders</div>
        {placeholders.length > 0 ? (
          <div className="text-[11px] text-white/45">{placeholders.length} fields</div>
        ) : (
          <div className="text-[11px] text-white/45">No placeholders</div>
        )}
      </div>

      {placeholders.length === 0 ? (
        <div className="mt-3 text-[12px] text-white/55">This prompt can be run as-is.</div>
      ) : (
        <div className="mt-3 space-y-3 overflow-y-auto pr-1">
          {placeholders.map((p) => {
            const label = (p.label || p.question || p.key || "").toString();
            const q = (p.question || "").toString();
            const v = values[p.key] ?? "";
            const required = Boolean(p.required);

            return (
              <div key={p.key} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-white/90 break-words leading-snug">
                      {label} {required && <span className="ml-1 text-amber-300">*</span>}
                    </div>
                    {q && <div className="mt-1 text-[11px] text-white/55 leading-snug">{q}</div>}
                  </div>
                  <div className="text-[11px] text-white/40 whitespace-nowrap">
                    {"{{"} {p.key} {"}}"}
                  </div>
                </div>

                <input
                  value={v}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setValues((prev) => ({ ...prev, [p.key]: newValue }));
                    
                    // Track first-time field fills
                    if (!fieldFillsRef.current.has(p.key) && newValue.trim()) {
                      fieldFillsRef.current.add(p.key);
                      safeTrack("Prompt Field Filled", {
                        surface: "run_modal",
                        field_key: p.key,
                        field_label: label,
                        is_required: required,
                        has_value: Boolean(newValue.trim()),
                      });
                    }
                  }}
                  placeholder={p.hint || ""}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none focus:border-cyan-400/60"
                />
              </div>
            );
          })}
        </div>
      )}

      {anyMissingRequired && (
        <div className="mt-3 text-[11px] text-amber-300">Fill the required fields (*) for best results.</div>
      )}
    </div>
  );

  const PromptPanel = (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-white/90">Generated prompt</div>
          <div className="mt-1 text-[11px] text-white/55 leading-snug">
            One click opens a provider with your prompt prefilled. Link is also copied automatically.
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(filled);
            setCopied(ok);
            if (ok) {
              safeTrack("Prompt Copied", {
                surface: "run_modal",
                location: "prompt_panel_button",
                prompt_length: filled.trim().length,
                filled_fields: Object.values(values).filter((v) => v.trim()).length,
              });
            }
            setTimeout(() => setCopied(false), 900);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-black hover:bg-white/90"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <textarea
        readOnly
        value={filled}
        className="mt-3 h-40 sm:h-44 w-full resize-none rounded-3xl border border-white/10 bg-black/45 p-3 text-[12px] text-white/85 outline-none"
      />

      <div className="mt-3">{Providers}</div>

      <div className="mt-3 rounded-3xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
        <div className="flex items-start gap-2">
          <ExternalLink className="h-4 w-4 mt-[1px] text-white/45" />
          <div className="min-w-0">
            <div className="text-white/80 font-semibold">Fast fallback</div>
            <div className="mt-0.5 leading-snug">If prefill doesn’t show, paste (Cmd+V / Ctrl+V) and send.</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-[min(1120px,98vw)] max-h-[92vh] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.8)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white">Run</div>
              <div className="mt-0.5 text-[12px] text-white/55 break-words leading-snug">{title}</div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile optimized: tabs (prevents giant useless scroll) */}
          <div className="sm:hidden border-b border-white/10 bg-black/20">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setMobileTab("fields")}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-[12px] font-semibold",
                  mobileTab === "fields" ? "border-cyan-400/60 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Fields
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("prompt")}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-[12px] font-semibold",
                  mobileTab === "prompt" ? "border-cyan-400/60 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Prompt
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            <div className="p-3 sm:p-5">
              {/* Desktop layout */}
              <div className="hidden sm:grid grid-cols-12 gap-4 sm:gap-5">
                <div className="col-span-12 lg:col-span-5">
                  <div className="max-h-[520px] overflow-y-auto">{FieldsPanel}</div>
                </div>
                <div className="col-span-12 lg:col-span-7">
                  {PromptPanel}
                </div>
              </div>

              {/* Mobile layout */}
              <div className="sm:hidden">
                <div className="max-h-[calc(92vh-140px)] overflow-y-auto pb-24">
                  {mobileTab === "fields" ? FieldsPanel : PromptPanel}
                </div>

                {/* Mobile sticky action bar */}
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[145] p-3">
                  <div className="pointer-events-auto rounded-3xl border border-white/10 bg-[#0b0c10]/90 backdrop-blur-md p-2 shadow-[0_-20px_80px_rgba(0,0,0,0.7)]">
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyToClipboard(filled);
                        setCopied(ok);
                        if (ok) {
                          safeTrack("Prompt Copied", {
                            surface: "run_modal",
                            location: "mobile_sticky_button",
                            prompt_length: filled.trim().length,
                            filled_fields: Object.values(values).filter((v) => v.trim()).length,
                          });
                        }
                        setTimeout(() => setCopied(false), 900);
                      }}
                      disabled={!filled.trim()}
                      className={cn(
                        "w-full rounded-2xl px-4 py-3 text-[13px] font-semibold",
                        filled.trim()
                          ? "bg-white text-black hover:bg-white/90"
                          : "bg-white/10 text-white/60 cursor-not-allowed"
                      )}
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <Copy className="h-4 w-4" />
                        {copied ? "Copied" : "Copy prompt"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-gradient-to-r from-cyan-400/40 via-white/10 to-pink-500/40" />
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function PromptProductPage() {
  const params = useParams<{ ownerHandle: string; edgazeCode: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { requireAuth, userId, profile } = useAuth();

  const [listing, setListing] = useState<PromptListing | null>(null);
  const [loading, setLoading] = useState(true);

  const [creatorProfile, setCreatorProfile] = useState<PublicProfileLite | null>(null);

  const [mainDemoIndex, setMainDemoIndex] = useState(0);

  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchase, setPurchase] = useState<PurchaseRow | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const [runOpen, setRunOpen] = useState(false);

  const [upNext, setUpNext] = useState<PromptListing[]>([]);
  const [upNextLoading, setUpNextLoading] = useState(false);
  const [upNextHasMore, setUpNextHasMore] = useState(true);
  const [upNextCursor, setUpNextCursor] = useState(0);
  const upNextSentinelRef = useRef<HTMLDivElement | null>(null);
  const autoActionTriggeredRef = useRef(false);

  const ownerHandle = params?.ownerHandle;
  const edgazeCode = params?.edgazeCode;

  const CLOSED_BETA = true;

  useEffect(() => {
    if (!ownerHandle || !edgazeCode) return;
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("prompts")
        .select(
          [
            "id",
            "owner_id",
            "owner_name",
            "owner_handle",
            "type",
            "edgaze_code",
            "title",
            "description",
            "tags",
            "thumbnail_url",
            "prompt_text",
            "placeholders",
            "demo_images",
            "output_demo_urls",
            "visibility",
            "monetisation_mode",
            "is_paid",
            "price_usd",
            "view_count",
            "like_count",
          ].join(",")
        )
        .eq("owner_handle", ownerHandle)
        .eq("edgaze_code", edgazeCode)
        .in("visibility", ["public", "unlisted"])
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Listing load error", error);
        setListing(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setListing(null);
        setLoading(false);
        return;
      }

      const record = data as unknown as PromptListing;
      setListing(record);
      setLoading(false);

      // Track product page view
      safeTrack("Product Page Viewed", {
        surface: "product_page",
        listing_id: record.id,
        listing_type: record.type || "prompt",
        owner_handle: record.owner_handle,
        edgaze_code: record.edgaze_code,
        title: record.title,
        is_paid: record.is_paid || false,
        monetisation_mode: record.monetisation_mode,
        price_usd: record.price_usd,
        view_count: record.view_count || 0,
        like_count: record.like_count || 0,
        has_demo_images: Array.isArray(record.demo_images) && record.demo_images.length > 0,
        placeholder_count: Array.isArray(coercePlaceholders(record.placeholders)) ? coercePlaceholders(record.placeholders).length : 0,
        is_owner: currentUserId ? String(record.owner_id) === String(currentUserId) : false,
      });

      // best-effort view count bump
      (async () => {
        try {
          await supabase
            .from("prompts")
            .update({ view_count: (record.view_count ?? 0) + 1 })
            .eq("id", record.id);
        } catch {}
      })();
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ownerHandle, edgazeCode, supabase]);

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
        .select("full_name,handle,avatar_url")
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

  const demoImages: string[] = useMemo(() => {
    if (!listing) return [];
    if (Array.isArray(listing.demo_images) && listing.demo_images.length > 0) return listing.demo_images;
    if (Array.isArray(listing.output_demo_urls) && listing.output_demo_urls.length > 0) return listing.output_demo_urls;
    if (listing.thumbnail_url) return [listing.thumbnail_url];
    return [];
  }, [listing]);

  const activeDemo = demoImages[mainDemoIndex] || null;

  const currentUserId = userId ?? null;
  const currentUserName = (profile as any)?.full_name ?? null;
  const currentUserHandle = (profile as any)?.handle ?? null;

  const canonicalShareUrl = useMemo(() => {
    const h = listing?.owner_handle || ownerHandle || "";
    const c = listing?.edgaze_code || edgazeCode || "";
    return `https://edgaze.ai/p/${h}/${c}`;
  }, [listing?.owner_handle, listing?.edgaze_code, ownerHandle, edgazeCode]);

  const goBack = () => router.push("/marketplace");

  const kind = listing?.type === "workflow" ? "workflow" : "prompt";
  const badgeLabel = listing?.type === "workflow" ? "Workflow" : "Prompt";

  const isNaturallyFree = useMemo(() => {
    if (!listing) return true;
    return listing.monetisation_mode === "free" || listing.is_paid === false;
  }, [listing]);

  const showClosedBetaFree = useMemo(() => {
    if (!listing) return false;
    return CLOSED_BETA && !isNaturallyFree;
  }, [CLOSED_BETA, isNaturallyFree, listing]);

  const paidLabel = useMemo(() => {
    if (!listing) return "Free";
    if (isNaturallyFree) return "Free";
    return listing.price_usd != null ? `$${listing.price_usd.toFixed(2)}` : "Paid";
  }, [listing, isNaturallyFree]);

  const primaryCtaLabel = showClosedBetaFree ? "Get access (Free)" : isNaturallyFree ? "Run now" : "Buy access";

  const templatePrompt = useMemo(() => {
    if (!listing) return "";
    const base =
      listing.prompt_text?.trim() ||
      `Title: ${listing.title || "Untitled"}\n\nDescription: ${listing.description || ""}`.trim();
    return base;
  }, [listing]);

  const placeholders = useMemo(() => {
    const fromJson = coercePlaceholders(listing?.placeholders);
    if (fromJson.length > 0) return fromJson;
    const keys = extractMustacheKeys(templatePrompt);
    return keys.map((k) => ({ key: k, question: `Enter ${k}`, label: k }));
  }, [listing?.placeholders, templatePrompt]);

  const isOwner = useMemo(() => {
    if (!listing || !currentUserId) return false;
    return listing.owner_id === String(currentUserId);
  }, [listing, currentUserId]);

  const isOwned = useMemo(() => {
    if (!listing) return false;
    if (isOwner) return true;
    if (isNaturallyFree) return true;
    return Boolean(purchase && (purchase.status === "paid" || purchase.status === "beta"));
  }, [listing, isOwner, isNaturallyFree, purchase]);

  async function loadPurchaseRow(promptId: string, uid: string) {
    const { data, error } = await supabase
      .from("prompt_purchases")
      .select("id,status")
      .eq("prompt_id", promptId)
      .eq("buyer_id", uid)
      .maybeSingle();

    if (error) {
      console.error("purchase load error", error);
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

  // Auto-trigger purchase/run flow after auth redirect
  useEffect(() => {
    if (!userId || !listing) return;
    if (autoActionTriggeredRef.current) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    
    if (action === "run") {
      autoActionTriggeredRef.current = true;
      
      // Remove action param from URL immediately to prevent duplicate triggers
      urlParams.delete("action");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
      
      // Wait a bit for purchase state to load, then trigger
      const timer = setTimeout(() => {
        grantAccessOrRun();
      }, 300);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return;
  }, [userId, listing]);

  async function grantAccessOrRun() {
    if (!listing) return;
    setPurchaseError(null);

    // Save intent in URL before requiring auth so redirect includes it
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("action", "run");
    window.history.replaceState({}, "", currentUrl.toString());

    if (!requireAuth()) {
      return;
    }

    if (isOwned) {
      safeTrack("Run Button Clicked", {
        surface: "product_page",
        listing_id: listing.id,
        listing_type: listing.type,
        edgaze_code: listing.edgaze_code,
        already_owned: true,
      });
      setRunOpen(true);
      return;
    }

    if (showClosedBetaFree) {
      setPurchaseLoading(true);
      try {
        const uid = userId!;
        
        // Check if purchase already exists (might have been created during redirect)
        const existing = await loadPurchaseRow(listing.id, uid);
        if (existing) {
          setPurchase(existing);
          setRunOpen(true);
          setPurchaseLoading(false);
          return;
        }
        
        const { data, error } = await supabase
          .from("prompt_purchases")
          .insert({ buyer_id: uid, prompt_id: listing.id, status: "beta" })
          .select("id,status")
          .maybeSingle();

        if (error) {
          console.error("beta access insert error", error);
          
          // If it's a duplicate key error, try to load the existing purchase
          if (error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("unique")) {
            const existingAfterError = await loadPurchaseRow(listing.id, uid);
            if (existingAfterError) {
              setPurchase(existingAfterError);
              setRunOpen(true);
              setPurchaseLoading(false);
              return;
            }
          }
          
          setPurchaseError("Could not grant access right now. Please try again.");
          safeTrack("Access Grant Failed", {
            surface: "product_page",
            listing_id: listing.id,
            error: error.message,
            error_code: error.code,
            method: "beta",
          });
          return;
        }

        safeTrack("Access Granted", {
          surface: "product_page",
          listing_id: listing.id,
          listing_type: listing.type,
          method: "beta",
          price_usd: listing.price_usd,
        });

        setPurchase((data as PurchaseRow) ?? null);
        setRunOpen(true);
        return;
      } finally {
        setPurchaseLoading(false);
      }
    }

    if (!isNaturallyFree) {
      setPurchaseError("Payments are not available during closed beta.");
      return;
    }

    setRunOpen(true);
    return;
  }

  async function loadMoreUpNext(reset = false) {
    if (upNextLoading) return;
    if (!listing && !reset) return;

    const pageSize = 12;
    const from = reset ? 0 : upNextCursor;
    const to = from + pageSize - 1;

    setUpNextLoading(true);

    const baseSelect = [
      "id",
      "owner_id",
      "owner_name",
      "owner_handle",
      "type",
      "edgaze_code",
      "title",
      "visibility",
      "monetisation_mode",
      "is_paid",
      "price_usd",
      "thumbnail_url",
      "tags",
      "view_count",
      "like_count",
    ].join(",");

    let q = supabase
      .from("prompts")
      .select(baseSelect)
      .in("visibility", ["public", "unlisted"])
      .order("view_count", { ascending: false })
      .order("like_count", { ascending: false });

    if (listing?.id) q = q.neq("id", listing.id);

    const { data, error } = await q.range(from, to);

    if (error) {
      console.error("Up next load error", error);
      setUpNextLoading(false);
      return;
    }

    const rows: PromptListing[] = Array.isArray(data)
      ? (data as any[]).filter(
          (r) =>
            r &&
            typeof r === "object" &&
            typeof (r as any).id === "string" &&
            typeof (r as any).owner_handle !== "undefined" &&
            typeof (r as any).edgaze_code !== "undefined"
        )
      : [];

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
    if (!upNextSentinelRef.current) return;
    if (!upNextHasMore) return;

    const el = upNextSentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) loadMoreUpNext(false);
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 }
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
          <p className="text-sm text-white/60">Loading…</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex h-full flex-col bg-[#050505] text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-lg font-semibold">Listing not found</p>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:border-cyan-400 hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4" /> Back to marketplace
          </button>
        </div>
      </div>
    );
  }
  const creatorName = creatorProfile?.full_name || listing.owner_name || "Creator";
  const creatorHandle = creatorProfile?.handle || listing.owner_handle || "creator";
  const creatorAvatar = creatorProfile?.avatar_url || null;

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      <RunModal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title={listing.title || "Untitled listing"}
        template={templatePrompt}
        placeholders={placeholders}
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
              <ArrowLeft className="h-4 w-4" /> Marketplace
            </button>
            <span className="truncate text-xs text-white/40">
              edgaze.ai/p/{listing.owner_handle}/{listing.edgaze_code}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                safeTrack("Share Button Clicked", {
                  surface: "product_page",
                  location: "desktop_header",
                  listing_id: listing?.id,
                  edgaze_code: listing?.edgaze_code,
                });
                setShareOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
              title="Share"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>

            <div className="flex items-center gap-2">
              {creatorAvatar ? (
                <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <Image src={creatorAvatar} alt={creatorName} fill className="object-cover" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/85">
                  {initialsFromName(creatorName || creatorHandle)}
                </div>
              )}

              <div className="hidden flex-col sm:flex leading-tight">
                <span className="text-xs font-medium text-white/90">{creatorName}</span>
                <span className="text-[11px] text-white/50">@{creatorHandle}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={canonicalShareUrl}
        code={listing.edgaze_code || ""}
        ownerHandle={listing.owner_handle || ""}
        title={listing.title}
      />

      {/* Mobile top bar */}
      <div className="sm:hidden sticky top-0 z-30 bg-[#050505]/85 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={goBack}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/85"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={grantAccessOrRun}
            disabled={purchaseLoading}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold",
              purchaseLoading
                ? "bg-white/10 text-white/70 border border-white/10"
                : "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_22px_rgba(56,189,248,0.75)]"
            )}
          >
            {purchaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isOwned ? "Run" : primaryCtaLabel}
          </button>

          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/85"
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
                <div className="aspect-video w-full">
                  {activeDemo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeDemo}
                      alt={listing.title || "Demo image"}
                      className="h-full w-full cursor-pointer object-cover"
                      onClick={() => window.open(activeDemo, "_blank", "noopener,noreferrer")}
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
                    onClick={() => {
                      const newIndex = mainDemoIndex === 0 ? demoImages.length - 1 : mainDemoIndex - 1;
                      setMainDemoIndex(newIndex);
                      safeTrack("Demo Image Navigated", {
                        surface: "product_page",
                        direction: "previous",
                        index: newIndex,
                        total_images: demoImages.length,
                        listing_id: listing?.id,
                      });
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white hover:border-cyan-400"
                    aria-label="Previous"
                  >
                    {"<"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const newIndex = mainDemoIndex === demoImages.length - 1 ? 0 : mainDemoIndex + 1;
                      setMainDemoIndex(newIndex);
                      safeTrack("Demo Image Navigated", {
                        surface: "product_page",
                        direction: "next",
                        index: newIndex,
                        total_images: demoImages.length,
                        listing_id: listing?.id,
                      });
                    }}
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
                      onClick={() => setMainDemoIndex(idx)}
                      className={cn(
                        "relative h-14 w-24 flex-none overflow-hidden rounded-xl border border-white/10 bg-black/60",
                        idx === mainDemoIndex && "border-cyan-400 shadow-[0_0_14px_rgba(56,189,248,0.55)]"
                      )}
                      aria-label={`Select demo ${idx + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Demo ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-[3px] text-[11px] font-medium",
                      listing.type === "workflow" ? "bg-pink-500/15 text-pink-200" : "bg-cyan-400/15 text-cyan-200"
                    )}
                  >
                    {badgeLabel}
                  </span>

                  {listing.edgaze_code && (
                    <span className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-2 py-[3px] text-[11px] font-semibold text-black shadow-[0_0_14px_rgba(56,189,248,0.55)]">
                      /{listing.edgaze_code}
                    </span>
                  )}

                  {isOwned && !isNaturallyFree && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-[3px] text-[11px] font-semibold text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Purchased
                    </span>
                  )}
                </div>

                <h1 className="text-[18px] sm:text-[22px] font-semibold leading-snug">{listing.title || "Untitled listing"}</h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-4 w-4" /> {listing.view_count ?? 0} views
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-4 w-4" /> {listing.like_count ?? 0} likes
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {creatorAvatar ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5">
                      <Image src={creatorAvatar} alt={creatorName} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/85">
                      {initialsFromName(creatorName || creatorHandle)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white/90">{creatorName}</div>
                    <div className="truncate text-[12px] text-white/55">@{creatorHandle}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={grantAccessOrRun}
                  className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-cyan-400/70"
                >
                  {isOwned ? <Sparkles className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {isOwned ? "Run" : primaryCtaLabel}
                </button>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-sm leading-relaxed text-white/75">{listing.description || "No description provided yet."}</p>

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

              <div className="hidden sm:block mt-6 border-t border-white/10 pt-6">
                <CommentsSection
                  listingId={listing.id}
                  listingOwnerId={listing.owner_id}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  currentUserHandle={currentUserHandle}
                  requireAuth={requireAuth}
                />
              </div>

              {/* Mobile: preview a few comments, open full sheet on tap */}
              <div className="sm:hidden mt-6 border-t border-white/10 pt-5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    safeTrack("Comments Opened", {
                      surface: "product_page",
                      location: "mobile",
                      listing_id: listing?.id,
                    });
                    setCommentsOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      safeTrack("Comments Opened", {
                        surface: "product_page",
                        location: "mobile",
                        listing_id: listing?.id,
                      });
                      setCommentsOpen(true);
                    }
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
                      <CommentsSection
                        listingId={listing.id}
                        listingOwnerId={listing.owner_id}
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                        currentUserHandle={currentUserHandle}
                        requireAuth={requireAuth}
                      />
                    </div>
                  </div>
                </div>

                {commentsOpen && (
                  <div className="fixed inset-0 z-[110]">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setCommentsOpen(false)} />
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
                        <CommentsSection
                          listingId={listing.id}
                          listingOwnerId={listing.owner_id}
                          currentUserId={currentUserId}
                          currentUserName={currentUserName}
                          currentUserHandle={currentUserHandle}
                          requireAuth={requireAuth}
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
                  <span className="text-[11px] text-white/45">Marketplace</span>
                </div>

                <div className="flex flex-col gap-3">
                  {upNext.map((s) => {
                    const suggestionFree = s.monetisation_mode === "free" || s.is_paid === false;
                    const href = s.owner_handle && s.edgaze_code ? `/p/${s.owner_handle}/${s.edgaze_code}` : null;
                    const suggestionPaidLabel = suggestionFree ? "Free" : s.price_usd != null ? `$${s.price_usd.toFixed(2)}` : "Paid";

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!href}
                        onClick={() => href && router.push(href)}
                        className={cn("group flex w-full items-start gap-3 text-left", !href && "cursor-not-allowed opacity-60")}
                      >
                        <div className="relative h-20 w-36 flex-none overflow-hidden rounded-xl bg-black/60 border border-white/10">
                          {s.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.thumbnail_url}
                              alt={s.title || "Listing thumbnail"}
                              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
                              {s.type === "workflow" ? "Workflow" : "Prompt"}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] font-semibold text-white/90">{s.title || "Untitled listing"}</p>
                          <p className="mt-1 truncate text-[12px] text-white/55">@{s.owner_handle || s.owner_name || "creator"}</p>

                          <div className="mt-1 flex items-center justify-between">
                            <p className="truncate text-[11px] text-white/40">
                              {s.tags
                                ? s.tags
                                    .split(",")
                                    .map((t) => t.trim())
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((t) => `#${t}`)
                                    .join(" ")
                                : ""}
                            </p>

                            <span className="text-[12px] font-semibold text-white/75">
                              {CLOSED_BETA && !suggestionFree ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="line-through decoration-white/40">
                                    {suggestionPaidLabel === "Paid" ? "$—" : suggestionPaidLabel}
                                  </span>
                                  <span className="text-white/85">Free</span>
                                </span>
                              ) : (
                                suggestionPaidLabel
                              )}
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

                  {!upNextHasMore && upNext.length > 0 && <p className="text-[12px] text-white/45">You reached the end.</p>}
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
                        {isOwned ? `You own this ${badgeLabel.toLowerCase()}` : `Unlock this ${badgeLabel.toLowerCase()}`}
                      </h2>
                      <p className="mt-1 text-[12px] text-white/55">
                        {isOwned ? "Fill placeholders and run in one click." : "Access attaches to your Edgaze account."}
                      </p>
                    </div>

                    {showClosedBetaFree && !isOwned && (
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/60">Closed beta</span>
                    )}

                    {isOwned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Owned
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    {!isOwned ? (
                      <BlurredPreview text={listing.prompt_text || listing.title || ""} kind={kind} />
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="text-[11px] text-white/55">Includes</div>
                        <div className="mt-2 space-y-2 text-[12px] text-white/80">
                          <div>• Placeholder form</div>
                          <div>• One-click open + prompt prefilled</div>
                          <div>• Auto-copy fallback</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    {showClosedBetaFree && !isNaturallyFree ? (
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-[11px] text-white/45">Price</div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <div className="text-2xl font-semibold">$0.00</div>
                            <div className="text-[12px] text-white/55">during closed beta</div>
                          </div>
                          <div className="mt-1 text-[12px] text-white/50">
                            <span className="line-through decoration-white/40">{paidLabel === "Paid" ? "$—" : paidLabel}</span>
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-white/45">Limited access</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[11px] text-white/45">Price</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <div className="text-2xl font-semibold">{paidLabel === "Free" ? "$0.00" : paidLabel}</div>
                          {!isNaturallyFree && <span className="text-[12px] text-white/55">one-time</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={grantAccessOrRun}
                      disabled={purchaseLoading}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold",
                        purchaseLoading
                          ? "bg-white/10 text-white/70 border border-white/10"
                          : "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_22px_rgba(56,189,248,0.75)]"
                      )}
                    >
                      {purchaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isOwned ? "Run now" : primaryCtaLabel}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:border-cyan-400/70"
                    >
                      <Share2 className="h-4 w-4" /> Share
                    </button>
                  </div>

                  {!isOwned && <div className="mt-3 text-[11px] text-white/45">Full prompt unlocks after access is granted.</div>}
                </section>

                <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/85">Up next</h3>
                    <span className="text-[11px] text-white/45">Marketplace</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {upNext.map((s) => {
                      const suggestionFree = s.monetisation_mode === "free" || s.is_paid === false;
                      const href = s.owner_handle && s.edgaze_code ? `/p/${s.owner_handle}/${s.edgaze_code}` : null;
                      const suggestionPaidLabel = suggestionFree ? "Free" : s.price_usd != null ? `$${s.price_usd.toFixed(2)}` : "Paid";

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!href}
                          onClick={() => href && router.push(href)}
                          className={cn("group flex w-full items-start gap-3 text-left", !href && "cursor-not-allowed opacity-60")}
                        >
                          <div className="relative h-20 w-36 flex-none overflow-hidden rounded-xl bg-black/60 border border-white/10">
                            {s.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={s.thumbnail_url}
                                alt={s.title || "Listing thumbnail"}
                                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
                                {s.type === "workflow" ? "Workflow" : "Prompt"}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[13px] font-semibold text-white/90">{s.title || "Untitled listing"}</p>
                            <p className="mt-1 truncate text-[12px] text-white/55">@{s.owner_handle || s.owner_name || "creator"}</p>

                            <div className="mt-1 flex items-center justify-between">
                              <p className="truncate text-[11px] text-white/40">
                                {s.tags
                                  ? s.tags
                                      .split(",")
                                      .map((t) => t.trim())
                                      .filter(Boolean)
                                      .slice(0, 2)
                                      .map((t) => `#${t}`)
                                      .join(" ")
                                  : ""}
                              </p>

                              <span className="text-[12px] font-semibold text-white/75">
                                {CLOSED_BETA && !suggestionFree ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="line-through decoration-white/40">
                                      {suggestionPaidLabel === "Paid" ? "$—" : suggestionPaidLabel}
                                    </span>
                                    <span className="text-white/85">Free</span>
                                  </span>
                                ) : (
                                  suggestionPaidLabel
                                )}
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
