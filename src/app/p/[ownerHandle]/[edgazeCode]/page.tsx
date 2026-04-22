// src/app/p/[ownerHandle]/[edgazeCode]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  Flag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/browser";
import { useAuth } from "../../../../components/auth/AuthContext";
import { track, type TrackProperties } from "../../../../lib/mixpanel";
import { SHOW_PUBLIC_LIKES_AND_RUNS } from "../../../../lib/constants";
import { findPurchaseForResource } from "../../../../lib/purchases/ownership";
import CommentsSectionRaw from "../../../../components/marketplace/CommentsSection";
import CustomerWorkflowRunModal from "../../../../components/runtime/customer/CustomerWorkflowRunModal";
import {
  canRunDemo,
  getDeviceFingerprintHash,
  canRunDemoSync,
} from "../../../../lib/workflow/device-tracking";
import { extractWorkflowInputs } from "../../../../lib/workflow/input-extraction";
import { validateWorkflowGraph } from "../../../../lib/workflow/validation";
import { isPremiumAiSpec } from "../../../../lib/workflow/spec-id-aliases";
import ProfileAvatar from "../../../../components/ui/ProfileAvatar";
import ProfileLink from "../../../../components/ui/ProfileLink";
import ReportModal from "../../../../components/marketplace/ReportModal";
import ListingImageLightbox from "../../../../components/marketplace/ListingImageLightbox";
import EdgazeNotFoundScreen from "../../../../components/errors/EdgazeNotFoundScreen";
import { toRuntimeGraph } from "../../../../lib/workflow/customer-runtime";
import { finalizeClientWorkflowRunFromExecutionResult } from "../../../../lib/workflow/finalize-client-run-result";
import { handleWorkflowRunStream } from "../../../../lib/workflow/run-stream-client";
import { startClientTraceSession } from "../../../../lib/workflow/client-trace";
import type { WorkflowRunState } from "../../../../lib/workflow/run-types";
import { demoTokensEqual } from "../../../../lib/demo-token";
const CommentsSection = CommentsSectionRaw as React.ComponentType<Record<string, unknown>>;

function safeTrack(event: string, props?: TrackProperties) {
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
  views_count?: number | null;
  like_count: number | null;
  likes_count?: number | null;
  runs_count?: number | null;
  removed_at?: string | null;
  removed_reason?: string | null;
  removed_by?: string | null;
  demo_mode_enabled?: boolean | null;
  demo_token?: string | null;
};

type PurchaseRow = {
  id: string;
  status: string; // prompt_purchases.status (text)
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
      "QR generation",
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
    return {
      name: "Edgaze",
      sub: "Coming soon",
      icon: "/brand/edgaze-mark.png",
      kind: "internal" as const,
    };
  if (p === "chatgpt")
    return {
      name: "ChatGPT",
      sub: "Prefill",
      icon: "/misc/chatgpt.png",
      kind: "external" as const,
    };
  if (p === "claude")
    return { name: "Claude", sub: "Prefill", icon: "/misc/claude.png", kind: "external" as const };
  if (p === "gemini")
    return {
      name: "Gemini",
      sub: "AI Studio",
      icon: "/misc/gemini.png",
      kind: "external" as const,
    };
  return {
    name: "Perplexity",
    sub: "Search",
    icon: "/misc/perplexity.png",
    kind: "external" as const,
  };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shareUrl/title/code/ownerHandle derived from route; intentional deps
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
                    <div className="h-[150px] w-[150px] sm:h-[210px] sm:w-[210px] overflow-hidden rounded-2xl bg-white/[0.03] grid place-items-center">
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
          <div className="whitespace-nowrap text-5xl font-extrabold tracking-[0.35em] text-white/30">
            {snippet}
          </div>
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
  promptId,
  title,
  template,
  placeholders,
}: {
  open: boolean;
  onClose: () => void;
  promptId: string;
  title: string;
  template: string;
  placeholders: PromptPlaceholder[];
}) {
  const { getAccessToken } = useAuth();

  async function trackPromptRun(provider?: string) {
    try {
      const token = await getAccessToken();
      let deviceFingerprint: string | undefined;
      try {
        deviceFingerprint = (await getDeviceFingerprintHash()) ?? undefined;
      } catch {
        deviceFingerprint = undefined;
      }
      const res = await fetch("/api/runs/track-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ promptId, provider, deviceFingerprint }),
      });
      if (!res.ok) console.warn("[trackPromptRun] Failed:", await res.text());
    } catch (e) {
      console.warn("[trackPromptRun] Error:", e);
    }
  }

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

    if (p === "edgaze") {
      if (filled.trim()) {
        const ok = await copyToClipboard(filled);
        setCopied(ok);
        if (ok) {
          await trackPromptRun("edgaze");
          safeTrack("Prompt Copied", {
            surface: "run_modal",
            provider: p,
            prompt_length: filledLength,
            filled_fields: filledFields,
          });
        }
        setTimeout(() => setCopied(false), 900);
      }
      return;
    }

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

    const url = buildProviderUrl(p, filled);
    if (!url) return;
    await trackPromptRun(p);
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
              active
                ? "border-cyan-400/60 bg-white/10"
                : "border-white/10 bg-white/5 hover:bg-white/10",
              disabled && "opacity-60 cursor-not-allowed",
            )}
            title={isEdgazeDisabled ? "Run in Edgaze is coming soon" : undefined}
          >
            <div className="flex items-center gap-2">
              <Image
                src={info.icon}
                alt={info.name}
                width={18}
                height={18}
                className="h-[18px] w-[18px]"
              />
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-[12px] font-semibold leading-tight",
                    isEdgazeDisabled ? "text-white/70" : "text-white",
                  )}
                >
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
        <div className="mt-3 text-[11px] text-amber-300">
          Fill the required fields (*) for best results.
        </div>
      )}
    </div>
  );

  const PromptPanel = (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-white/90">Generated prompt</div>
          <div className="mt-1 text-[11px] text-white/55 leading-snug">
            One click opens a provider with your prompt prefilled. Link is also copied
            automatically.
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(filled);
            setCopied(ok);
            if (ok) {
              await trackPromptRun("copy");
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
            <div className="mt-0.5 leading-snug">
              If prefill doesn’t show, paste (Cmd+V / Ctrl+V) and send.
            </div>
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
              <div className="mt-0.5 text-[12px] text-white/55 break-words leading-snug">
                {title}
              </div>
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
                  mobileTab === "fields"
                    ? "border-cyan-400/60 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70",
                )}
              >
                Fields
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("prompt")}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-[12px] font-semibold",
                  mobileTab === "prompt"
                    ? "border-cyan-400/60 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70",
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
                <div className="col-span-12 lg:col-span-7">{PromptPanel}</div>
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
                          : "bg-white/10 text-white/60 cursor-not-allowed",
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
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { requireAuth, userId, profile, getAccessToken, refreshAuthSession, isAdmin } = useAuth();

  const [listing, setListing] = useState<PromptListing | null>(null);
  const [loading, setLoading] = useState(true);

  const [creatorProfile, setCreatorProfile] = useState<PublicProfileLite | null>(null);

  const [mainDemoIndex, setMainDemoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchase, setPurchase] = useState<PurchaseRow | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [demoRunAllowed, setDemoRunAllowed] = useState<boolean | null>(null); // null = checking, true/false = result
  const [checkingDemoRun, setCheckingDemoRun] = useState(false);

  const [runOpen, setRunOpen] = useState(false);
  const [workflowRunModalOpen, setWorkflowRunModalOpen] = useState(false);
  const [workflowRunState, setWorkflowRunState] = useState<WorkflowRunState | null>(null);
  const [workflowGraph, setWorkflowGraph] = useState<any>(null);

  const [upNext, setUpNext] = useState<PromptListing[]>([]);
  const [upNextLoading, setUpNextLoading] = useState(false);
  const [upNextHasMore, setUpNextHasMore] = useState(true);
  const [upNextCursor, setUpNextCursor] = useState(0);
  const upNextSentinelRef = useRef<HTMLDivElement | null>(null);
  const autoActionTriggeredRef = useRef(false);
  const workflowRunAbortRef = useRef<AbortController | null>(null);
  const workflowRunSessionPollRef = useRef<AbortController | null>(null);
  const workflowRunIsDemoRef = useRef(false);
  const workflowRunAutoExecuteRef = useRef(false);

  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const ownerHandle = params?.ownerHandle;
  const edgazeCode = params?.edgazeCode;

  // Demo mode: when visiting with ?demo=TOKEN and it matches, skip sign-in for Run
  const demoTokenFromUrl = searchParams?.get("demo") ?? null;
  const isDemoModeActive = Boolean(
    listing?.demo_mode_enabled &&
    listing?.demo_token &&
    demoTokenFromUrl &&
    demoTokensEqual(demoTokenFromUrl, listing.demo_token),
  );

  // When demo mode is off but URL has ?demo=, redirect to clean URL
  useEffect(() => {
    if (!listing || !demoTokenFromUrl) return;
    if (isDemoModeActive) return;
    const cleanPath = `/p/${ownerHandle}/${edgazeCode}`;
    router.replace(cleanPath);
  }, [listing, demoTokenFromUrl, isDemoModeActive, ownerHandle, edgazeCode, router]);

  useEffect(() => {
    if (!listing?.id) return;
    const lc = listing.likes_count ?? listing.like_count ?? 0;
    setLikeCount(Number(lc) || 0);
    let alive = true;
    const itemType = listing.type === "workflow" ? "workflow" : "prompt";
    (async () => {
      try {
        const res = await fetch(
          `/api/marketplace/like?itemId=${encodeURIComponent(listing.id)}&itemType=${itemType}`,
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
  }, [listing?.id, listing?.type, listing?.likes_count, listing?.like_count]);

  useEffect(() => {
    if (!ownerHandle || !edgazeCode) return;
    let cancelled = false;

    async function load() {
      setLoading(true);

      let record: PromptListing | null = null;
      try {
        const res = await fetch(
          `/api/prompt/storefront-detail?owner_handle=${encodeURIComponent(ownerHandle)}&edgaze_code=${encodeURIComponent(edgazeCode)}`,
        );
        const json = await res.json().catch(() => ({}));
        record = (json?.listing as PromptListing | null) ?? null;
      } catch (e) {
        console.error("Listing load error", e);
        record = null;
      }

      if (cancelled) return;

      if (!record) {
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
          `/p/${encodeURIComponent(record.owner_handle.trim())}/${encodeURIComponent(edgazeCode)}`,
        );
      }

      {
        // Track product page view only when not removed
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
          placeholder_count: Array.isArray(coercePlaceholders(record.placeholders))
            ? coercePlaceholders(record.placeholders).length
            : 0,
          is_owner: currentUserId ? String(record.owner_id) === String(currentUserId) : false,
        });

        // best-effort view count (6hr cooldown per user, server-side)
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
                listingType: record.type === "workflow" ? "workflow" : "prompt",
                deviceFingerprint: getDeviceFingerprintHash(),
              }),
            });
          } catch {}
        })();
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentUserId from auth; load runs when route/listing identity changes
  }, [ownerHandle, edgazeCode, supabase, getAccessToken, router]);

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

  const demoImages: string[] = useMemo(() => {
    if (!listing) return [];
    if (Array.isArray(listing.demo_images) && listing.demo_images.length > 0)
      return listing.demo_images;
    if (Array.isArray(listing.output_demo_urls) && listing.output_demo_urls.length > 0)
      return listing.output_demo_urls;
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
    // Use current origin (works for localhost and production)
    const origin = typeof window !== "undefined" ? window.location.origin : "https://edgaze.ai";
    return `${origin}/p/${h}/${c}`;
  }, [listing?.owner_handle, listing?.edgaze_code, ownerHandle, edgazeCode]);

  const goBack = () => router.push("/marketplace");

  const kind = listing?.type === "workflow" ? "workflow" : "prompt";
  const badgeLabel = listing?.type === "workflow" ? "Workflow" : "Prompt";

  // Only treat as free when listing is loaded and explicitly free (source of truth: DB).
  const isNaturallyFree = useMemo(() => {
    if (!listing) return false;
    return listing.monetisation_mode === "free" || listing.is_paid === false;
  }, [listing]);

  const paidLabel = useMemo(() => {
    if (!listing) return "Free";
    if (isNaturallyFree) return "Free";
    return listing.price_usd != null ? `$${listing.price_usd.toFixed(2)}` : "Paid";
  }, [listing, isNaturallyFree]);

  const primaryCtaLabel = useMemo(() => {
    if (isNaturallyFree) return listing?.type === "workflow" ? "Try a one time demo" : "Run now";
    return "Buy access";
  }, [isNaturallyFree, listing?.type]);

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

  // Access ONLY: owner OR has a row in prompt_purchases (paid/beta). No free access without purchase.
  const isOwned = useMemo(() => {
    if (!listing) return false;
    if (isOwner) return true;
    // Require purchase row for everyone else (even free items need to be "purchased" to show in library)
    return Boolean(purchase && (purchase.status === "paid" || purchase.status === "beta"));
  }, [listing, isOwner, purchase]);

  // Check demo run eligibility for non-authenticated users on free workflows
  useEffect(() => {
    if (!listing || listing.type !== "workflow" || !isNaturallyFree || userId) {
      setDemoRunAllowed(null);
      return;
    }

    let cancelled = false;
    setCheckingDemoRun(true);

    (async () => {
      try {
        const allowed = await canRunDemo(listing.id, true);
        if (!cancelled) {
          setDemoRunAllowed(allowed);
          setCheckingDemoRun(false);
        }
      } catch (err) {
        console.error("[Demo Run] Error checking eligibility:", err);
        if (!cancelled) {
          setDemoRunAllowed(false); // Default to false on error
          setCheckingDemoRun(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listing used inside async load; avoid re-running on every listing field change
  }, [listing?.id, listing?.type, isNaturallyFree, userId]);

  async function loadPurchaseRow(promptId: string, uid: string) {
    const { purchase, error } = await findPurchaseForResource({
      supabase,
      resourceId: promptId,
      buyerId: uid,
      preferredTable: "prompt_purchases",
      type: listing?.type || "prompt",
    });

    if (error) {
      console.error("purchase load error", error);
      return null;
    }
    return (purchase as PurchaseRow | null) ?? null;
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

  useEffect(() => {
    if (!listing?.id || !userId) return;
    const isFree = listing.monetisation_mode === "free" || listing.is_paid === false;
    if (isFree) return;
    if (listing.prompt_text) return;
    const isOwner = String(listing.owner_id) === String(userId);
    const hasAccess =
      isOwner || (purchase && (purchase.status === "paid" || purchase.status === "beta"));
    if (!hasAccess) return;

    let alive = true;
    (async () => {
      try {
        let token = await getAccessToken();
        if (!token) {
          await refreshAuthSession();
          token = await getAccessToken();
        }
        if (!token) return;
        const res = await fetch(
          `/api/prompt/resolve-content?prompt_id=${encodeURIComponent(listing.id)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const j = (await res.json()) as {
          prompt_text?: string | null;
          placeholders?: unknown;
        };
        if (!alive) return;
        setListing((prev) =>
          prev
            ? {
                ...prev,
                prompt_text: j.prompt_text ?? prev.prompt_text,
                placeholders:
                  j.placeholders !== undefined
                    ? (j.placeholders as typeof prev.placeholders)
                    : prev.placeholders,
              }
            : null,
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    listing?.id,
    listing?.monetisation_mode,
    listing?.is_paid,
    listing?.prompt_text,
    listing?.owner_id,
    userId,
    purchase,
    getAccessToken,
    refreshAuthSession,
  ]);

  // Auto-trigger purchase/run flow only after auth redirect (not on shared links or back navigation)
  useEffect(() => {
    if (!userId || !listing) return;
    if (autoActionTriggeredRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");

    const isRunOrPurchase = action === "run" || action === "purchase";
    if (isRunOrPurchase) {
      // Only auto-trigger if user initiated this flow (intent set when they clicked Buy/Run or came from sign-in-to-buy)
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
        grantAccessOrRun();
      }, 300);

      return () => clearTimeout(timer);
    }

    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grantAccessOrRun called from timeout; stable callback
  }, [userId, listing]);

  async function grantAccessOrRun() {
    if (!listing) return;
    setPurchaseError(null);

    // Save intent in URL before requiring auth so redirect includes it
    // Use relative path only (not absolute URL)
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("action", "run");
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

    // Demo mode: admin-enabled demo link — skip sign-in, allow direct run
    if (isDemoModeActive) {
      if (listing.type === "workflow") {
        safeTrack("Workflow Demo Run Initiated", {
          surface: "product_page",
          listing_id: listing.id,
          listing_type: listing.type,
          edgaze_code: listing.edgaze_code,
          demo_mode: true,
        });
        handleWorkflowRun({ isDemoRun: false });
        return;
      }
      // Prompt: open run modal (copy prompt)
      setRunOpen(true);
      return;
    }

    // For workflows: allow demo runs even when not authenticated (if free)
    if (listing.type === "workflow" && isNaturallyFree && !userId) {
      // Check if demo run is allowed (server-side check)
      const canRun = await canRunDemo(listing.id, true);
      if (!canRun) {
        setPurchaseError(
          "You've already used your one-time demo run for this workflow. Each device and IP address combination gets one demo run.",
        );
        safeTrack("Workflow Demo Run Blocked", {
          surface: "product_page",
          listing_id: listing.id,
          reason: "device_ip_limit_reached",
        });
        return;
      }

      // Allow demo run for non-authenticated users
      safeTrack("Workflow Demo Run Initiated", {
        surface: "product_page",
        listing_id: listing.id,
        listing_type: listing.type,
        edgaze_code: listing.edgaze_code,
        authenticated: false,
      });

      handleWorkflowRun({ isDemoRun: true });
      return;
    }

    // For paid items when not logged in: full-screen sign-in-to-buy page (conversion-optimized)
    if (!userId && !isNaturallyFree) {
      try {
        sessionStorage.setItem("edgaze:actionIntentAt", String(Date.now()));
        sessionStorage.setItem("edgaze:actionIntentPath", window.location.pathname);
      } catch {}
      const returnPath =
        window.location.pathname + (window.location.search ? window.location.search : "");
      const type = listing.type === "workflow" ? "workflow" : "prompt";
      window.location.href = `/auth/sign-in-to-buy?return=${encodeURIComponent(returnPath)}&type=${type}`;
      return;
    }

    // For other cases (e.g. free but need auth), use modal
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
      safeTrack("Run Button Clicked", {
        surface: "product_page",
        listing_id: listing.id,
        listing_type: listing.type,
        edgaze_code: listing.edgaze_code,
        already_owned: true,
      });

      // Handle workflows differently
      if (listing.type === "workflow") {
        handleWorkflowRun({ isDemoRun: false });
        return;
      }

      setRunOpen(true);
      return;
    }

    // For beta OR free items: insert purchase row (free items still need purchase to show in library)
    if (isNaturallyFree) {
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
          console.error("purchase insert error", error);

          // If it's a duplicate key error, try to load the existing purchase
          if (
            error.code === "23505" ||
            error.message?.includes("duplicate") ||
            error.message?.includes("unique")
          ) {
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
            method: isNaturallyFree ? "free" : "beta",
          });
          return;
        }

        safeTrack("Access Granted", {
          surface: "product_page",
          listing_id: listing.id,
          listing_type: listing.type,
          method: isNaturallyFree ? "free" : "beta",
          price_usd: listing.price_usd,
        });

        setPurchase((data as PurchaseRow) ?? null);
        setRunOpen(true);
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
            type: listing.type || "prompt",
            workflowId: listing.type === "workflow" ? listing.id : undefined,
            promptId: listing.type === "prompt" ? listing.id : undefined,
            sourceTable: "prompts",
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

  async function handleWorkflowRun(options?: { isDemoRun?: boolean }) {
    if (!listing || listing.type !== "workflow") return;
    const isDemoRun = options?.isDemoRun === true;
    workflowRunIsDemoRef.current = isDemoRun;

    // Check device-based demo limit (server-side for strict enforcement)
    // Only explicit one-time demo runs should go through demo tracking.
    if (!userId && isDemoRun) {
      const canRun = await canRunDemo(listing.id, true);
      if (!canRun) {
        safeTrack("Workflow Demo Run Blocked", {
          surface: "product_page",
          listing_id: listing.id,
          reason: "device_ip_limit_reached",
        });
        setPurchaseError(
          "You've already used your one-time demo run for this workflow. Each device and IP address combination gets one demo run.",
        );
        return;
      }
    }

    safeTrack("Workflow Run Initiated", {
      surface: "product_page",
      listing_id: listing.id,
      edgaze_code: listing.edgaze_code,
    });

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const payload: Record<string, unknown> = { workflowId: listing.id };
      if (!userId && isDemoRun) {
        payload.deviceFingerprint = getDeviceFingerprintHash();
      } else {
        let token = await getAccessToken();
        if (!token) {
          await refreshAuthSession();
          token = await getAccessToken();
        }
        if (!token) throw new Error("Sign in required");
        headers["Authorization"] = `Bearer ${token}`;
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
      const graph = {
        nodes: payloadJson.nodes || [],
        edges: payloadJson.edges || [],
      };

      // Validate workflow graph before execution
      const validation = validateWorkflowGraph(graph.nodes || [], graph.edges || []);

      if (!validation.valid) {
        const errorMessage = validation.errors.map((e) => e.message).join("\n\n");
        setPurchaseError(errorMessage);
        safeTrack("Workflow Run Blocked", {
          surface: "product_page",
          listing_id: listing.id,
          reason: "validation_failed",
          errors: validation.errors.map((e) => e.message),
        });
        return;
      }

      setWorkflowGraph(graph);

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
        summary:
          validation.warnings.length > 0
            ? `${validation.warnings.length} warning(s): ${validation.warnings[0]?.message ?? ""}`
            : undefined,
      };

      setWorkflowRunState(initialState);
      setWorkflowRunModalOpen(true);
    } catch (error: any) {
      setPurchaseError(error.message || "Failed to load workflow");
    }
  }

  async function handleSubmitWorkflowInputs(inputValues: Record<string, any>) {
    if (!listing || !workflowGraph || !workflowRunState) return;
    const isDemoRun = workflowRunIsDemoRef.current;

    // Convert File objects to base64 for transmission
    const processedInputs: Record<string, any> = {};
    for (const [key, value] of Object.entries(inputValues)) {
      if (value instanceof File) {
        // Convert file to base64
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result);
            };
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
          console.error("Failed to convert file to base64:", error);
          setPurchaseError("Failed to process file upload. Please try again.");
          return;
        }
      } else {
        processedInputs[key] = value;
      }
    }

    // Collect API keys from node configs
    const userApiKeys: Record<string, Record<string, string>> = {};
    for (const node of workflowGraph.nodes || []) {
      const specId = node.data?.specId;
      const apiKey = node.data?.config?.apiKey;

      // Check if this node requires API keys and has one configured
      if (specId && isPremiumAiSpec(specId)) {
        if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
          userApiKeys[node.id] = { apiKey: apiKey.trim() };
        }
      }
    }

    // Update state to executing
    setWorkflowRunState({
      ...workflowRunState,
      phase: "executing",
      status: "running",
      inputValues: processedInputs,
      startedAt: Date.now(),
      connectionState: "connecting",
      connectionLabel: "Connecting to execution...",
      lastEventAt: Date.now(),
    });

    try {
      const clientTrace = startClientTraceSession({
        routeId: "customer.workflow.run",
        requestPath: typeof window !== "undefined" ? window.location.pathname : null,
        workflowId: listing.id,
        context: {
          surface: "customer_marketplace_compact",
          isDemoRun,
          userId: userId ?? null,
        },
      });
      clientTrace.record({
        phase: "request",
        eventName: "run_start.initiated",
        payload: {
          workflowId: listing.id,
          inputKeyCount: Object.keys(processedInputs ?? {}).length,
          userApiKeyNodeCount: Object.keys(userApiKeys ?? {}).length,
          isDemoRun,
          hasUserId: Boolean(userId),
        },
      });
      // Admin demo link: pass token to bypass auth and device limit. Otherwise use device fingerprint for anonymous demo.
      const deviceFingerprint =
        !userId && isDemoRun && !isDemoModeActive ? getDeviceFingerprintHash() : undefined;

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
      workflowRunSessionPollRef.current?.abort();
      workflowRunSessionPollRef.current = null;
      workflowRunAbortRef.current = new AbortController();

      const postStartedAt = Date.now();
      const response = await fetch("/api/flow/run", {
        method: "POST",
        headers,
        credentials: "include",
        signal: workflowRunAbortRef.current.signal,
        body: JSON.stringify({
          workflowId: listing.id,
          inputs: processedInputs,
          userApiKeys,
          isDemo: !userId && isDemoRun && !isDemoModeActive,
          deviceFingerprint,
          adminDemoToken: isDemoModeActive && listing?.demo_token ? listing.demo_token : undefined,
          stream: true,
          forceDemoModelTier: isDemoRun,
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
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const streamResult = await handleWorkflowRunStream({
        response,
        accessToken: headers.Authorization
          ? String(headers.Authorization).replace(/^Bearer\s+/i, "")
          : null,
        runSessionPollRef: workflowRunSessionPollRef,
        setRunState: setWorkflowRunState,
        workflowId: listing.id,
        workflowName: listing.title || "Workflow",
        inputValues: processedInputs,
        sourceGraph: toRuntimeGraph(workflowGraph),
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
          graphNodes: workflowGraph.nodes || [],
          processedInputs,
        });
        setWorkflowRunState({
          ...workflowRunState,
          ...completion,
        });
      }
      await clientTrace.finish({ status: "completed" });
    } catch (error: any) {
      setWorkflowRunState({
        ...workflowRunState,
        phase: "output",
        status: "error",
        error: error.message || "Execution failed",
        finishedAt: Date.now(),
      });
    }
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
            typeof (r as any).edgaze_code !== "undefined",
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
    return () => {
      workflowRunAbortRef.current?.abort();
      workflowRunSessionPollRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!workflowRunModalOpen) workflowRunAutoExecuteRef.current = false;
  }, [workflowRunModalOpen]);

  useEffect(() => {
    if (
      !workflowRunModalOpen ||
      !workflowRunState ||
      workflowRunState.phase !== "executing" ||
      workflowRunState.status !== "idle" ||
      workflowRunAutoExecuteRef.current
    )
      return;
    const hasInputs = workflowRunState.inputs && workflowRunState.inputs.length > 0;
    if (hasInputs) return;
    workflowRunAutoExecuteRef.current = true;
    void handleSubmitWorkflowInputs({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirrors builder: auto-start run when modal opens with no inputs
  }, [
    workflowRunModalOpen,
    workflowRunState?.phase,
    workflowRunState?.status,
    workflowRunState?.inputs?.length,
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
          <p className="text-sm text-white/60">Loading…</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <EdgazeNotFoundScreen
        code="PR-404"
        eyebrow="Prompt unavailable"
        title="This prompt is no longer available here."
        description="The creator may have moved it, unpublished it, or replaced the listing with a fresh Edgaze release. Jump back into the marketplace to discover other polished prompt products."
        primaryHref="/marketplace"
        primaryLabel="Explore prompts"
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
            <ArrowLeft className="h-4 w-4" /> Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  const creatorName = creatorProfile?.full_name || listing.owner_name || "Creator";
  // When viewer is owner, use current profile handle so updated handle shows immediately (isOwner from useMemo above)
  const creatorHandle =
    (isOwner && (profile as { handle?: string } | null)?.handle) ||
    listing.owner_handle ||
    creatorProfile?.handle ||
    "creator";
  const creatorAvatar = creatorProfile?.avatar_url || null;

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      {/* Premium Workflow Run Modal */}
      {listing?.type === "workflow" && (
        <CustomerWorkflowRunModal
          open={workflowRunModalOpen}
          showExecutionTimer={isAdmin}
          demoImageWatermarkEnabled={workflowRunIsDemoRef.current}
          demoImageWatermarkOwnerHandle={creatorHandle || listing.owner_handle || ownerHandle || ""}
          onClose={() => {
            if (
              workflowRunState?.status !== "running" &&
              workflowRunState?.status !== "cancelling"
            ) {
              workflowRunAbortRef.current?.abort();
              workflowRunSessionPollRef.current?.abort();
              setWorkflowRunModalOpen(false);
              setWorkflowRunState(null);
              setWorkflowGraph(null);
            }
          }}
          state={workflowRunState}
          onCancel={async () => {
            let runId: string | undefined;
            let runAccessToken: string | undefined;
            setWorkflowRunState((prev) => {
              runId = prev?.runId ?? undefined;
              runAccessToken = prev?.runAccessToken ?? undefined;
              if (prev?.status === "running") {
                return { ...prev, status: "cancelling", error: undefined };
              }
              return prev;
            });

            workflowRunSessionPollRef.current?.abort();
            workflowRunSessionPollRef.current = null;
            workflowRunAbortRef.current?.abort();

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
            setWorkflowRunState((prev) =>
              prev ? { ...prev, status: "cancelled", error: undefined } : null,
            );
          }}
          onRerun={() => {
            setWorkflowRunState(null);
            setWorkflowRunModalOpen(false);
            setTimeout(() => handleWorkflowRun(), 100);
          }}
          onSubmitInputs={handleSubmitWorkflowInputs}
        />
      )}

      {/* Prompt Run Modal */}
      {listing?.type !== "workflow" && listing && (
        <RunModal
          open={runOpen}
          onClose={() => setRunOpen(false)}
          promptId={listing.id}
          title={listing.title || "Untitled listing"}
          template={templatePrompt}
          placeholders={placeholders}
        />
      )}

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
              edgaze.ai/p/{creatorHandle}/{listing.edgaze_code}
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

            <div className="flex items-center gap-2">
              <ProfileAvatar
                name={creatorName}
                avatarUrl={creatorAvatar}
                size={32}
                handle={creatorHandle}
              />

              <div className="hidden sm:flex flex-col leading-tight min-w-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <ProfileLink
                    name={creatorName}
                    handle={creatorHandle}
                    verified={Boolean(creatorProfile?.is_verified_creator)}
                    className="min-w-0 truncate text-xs font-medium text-white/90"
                  />
                </div>
                <ProfileLink
                  name={`@${creatorHandle}`}
                  handle={creatorHandle}
                  className="truncate text-[11px] text-white/50"
                />
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
        ownerHandle={creatorHandle || listing.owner_handle || ""}
        title={listing.title}
      />

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType={listing.type === "workflow" ? "workflow" : "prompt"}
        targetId={listing.id}
        targetTitle={listing.title}
        targetOwnerHandle={creatorHandle || listing.owner_handle}
        targetOwnerName={listing.owner_name}
      />

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
            onClick={grantAccessOrRun}
            disabled={
              purchaseLoading ||
              (listing?.type === "workflow" &&
                isNaturallyFree &&
                !userId &&
                demoRunAllowed === false)
            }
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 h-10 text-xs font-semibold relative",
              purchaseLoading ||
                (listing?.type === "workflow" &&
                  isNaturallyFree &&
                  !userId &&
                  demoRunAllowed === false)
                ? "bg-white/10 text-white/70 border border-white/10 opacity-60"
                : "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_16px_rgba(56,189,248,0.6)]",
            )}
            title={
              listing?.type === "workflow" && isNaturallyFree && !userId && demoRunAllowed === false
                ? "You've already used your one-time demo. Each device and IP address combination gets one demo run."
                : undefined
            }
          >
            {purchaseLoading || checkingDemoRun ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isOwned ||
              (listing?.type === "workflow" &&
                isNaturallyFree &&
                !userId &&
                (demoRunAllowed === true || demoRunAllowed === null)) ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : listing?.type === "workflow" &&
              isNaturallyFree &&
              !userId &&
              demoRunAllowed === false ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            <span className="flex items-center gap-1.5">
              {isOwned
                ? listing?.type === "workflow"
                  ? "Try a one time demo"
                  : "Run"
                : listing?.type === "workflow" && isNaturallyFree && !userId
                  ? demoRunAllowed === false
                    ? "Used"
                    : "Try a one time demo"
                  : primaryCtaLabel}
              {listing?.type === "workflow" &&
                isNaturallyFree &&
                !userId &&
                demoRunAllowed === false && (
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">Used</span>
                )}
              {!isOwned && (
                <span
                  className={cn(
                    "tabular-nums opacity-90",
                    isNaturallyFree ? "text-emerald-700" : "text-black/80",
                  )}
                >
                  · {paidLabel}
                </span>
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
                      alt={listing.title || "Demo image"}
                      className="h-full w-full cursor-pointer object-cover object-center"
                      style={{ aspectRatio: "16/9" }}
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
                      onClick={() => {
                        const newIndex =
                          mainDemoIndex === 0 ? demoImages.length - 1 : mainDemoIndex - 1;
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
                        const newIndex =
                          mainDemoIndex === demoImages.length - 1 ? 0 : mainDemoIndex + 1;
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
                  <span
                    className={cn(
                      "rounded-full px-2 py-[3px] text-[11px] font-medium",
                      listing.type === "workflow"
                        ? "bg-pink-500/15 text-pink-200"
                        : "bg-cyan-400/15 text-cyan-200",
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

                {/* Title + prominent mobile price */}
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <h1 className="text-[18px] sm:text-[22px] font-semibold leading-snug flex-1 min-w-0">
                    {listing.title || "Untitled listing"}
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
                          const itemType = listing.type === "workflow" ? "workflow" : "prompt";
                          const res = await fetch("/api/marketplace/like", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            credentials: "include",
                            body: JSON.stringify({
                              itemId: listing.id,
                              itemType,
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
                          ? listing.type === "workflow"
                            ? "border-pink-400/40 bg-pink-500/15 text-pink-100"
                            : "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
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
                    name={creatorName}
                    avatarUrl={creatorAvatar}
                    size={40}
                    handle={creatorHandle}
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <ProfileLink
                        name={creatorName}
                        handle={creatorHandle}
                        verified={Boolean(creatorProfile?.is_verified_creator)}
                        className="min-w-0 truncate text-sm font-medium text-white/90"
                      />
                    </div>
                    <ProfileLink
                      name={`@${creatorHandle}`}
                      handle={creatorHandle}
                      className="truncate text-[12px] text-white/55"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={grantAccessOrRun}
                  disabled={
                    listing?.type === "workflow" &&
                    isNaturallyFree &&
                    !userId &&
                    demoRunAllowed === false
                  }
                  className={cn(
                    "hidden sm:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-cyan-400/70 relative",
                    listing?.type === "workflow" &&
                      isNaturallyFree &&
                      !userId &&
                      demoRunAllowed === false &&
                      "opacity-60 cursor-not-allowed",
                  )}
                  title={
                    listing?.type === "workflow" &&
                    isNaturallyFree &&
                    !userId &&
                    demoRunAllowed === false
                      ? "You've already used your one-time demo. Each device and IP address combination gets one demo run."
                      : undefined
                  }
                >
                  {isOwned ? (
                    <Sparkles className="h-4 w-4" />
                  ) : listing?.type === "workflow" &&
                    isNaturallyFree &&
                    !userId &&
                    demoRunAllowed === false ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : listing?.type === "workflow" &&
                    isNaturallyFree &&
                    !userId &&
                    (demoRunAllowed === true || demoRunAllowed === null) ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  <span className="flex items-center gap-1.5">
                    {isOwned
                      ? listing?.type === "workflow"
                        ? "Try a one time demo"
                        : "Run"
                      : listing?.type === "workflow" && isNaturallyFree && !userId
                        ? demoRunAllowed === false
                          ? "Used"
                          : "Try a one time demo"
                        : primaryCtaLabel}
                    {listing?.type === "workflow" &&
                      isNaturallyFree &&
                      !userId &&
                      demoRunAllowed === false && (
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                          Used
                        </span>
                      )}
                  </span>
                </button>
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

              {/* Mobile: Report button after description */}
              <div className="sm:hidden mt-4">
                <button
                  type="button"
                  onClick={() => {
                    safeTrack("Report Button Clicked", {
                      surface: "product_page",
                      location: "mobile_near_description",
                      listing_id: listing?.id,
                      edgaze_code: listing?.edgaze_code,
                    });
                    setReportOpen(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white/80"
                >
                  <Flag className="h-3 w-3" /> Report
                </button>
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
                    const href =
                      s.owner_handle && s.edgaze_code
                        ? `/p/${s.owner_handle}/${s.edgaze_code}`
                        : null;
                    const suggestionPaidLabel = suggestionFree
                      ? "Free"
                      : s.price_usd != null
                        ? `$${s.price_usd.toFixed(2)}`
                        : "Paid";

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!href}
                        onClick={() => href && router.push(href)}
                        className={cn(
                          "group flex w-full items-start gap-3 text-left",
                          !href && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <div className="relative h-20 w-36 flex-none overflow-hidden rounded-xl bg-black/60 border border-white/10">
                          {s.thumbnail_url ? (
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
                          <p className="line-clamp-2 text-[13px] font-semibold text-white/90">
                            {s.title || "Untitled listing"}
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
                                    .join(" ")
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
                        {isOwned
                          ? `You own this ${badgeLabel.toLowerCase()}`
                          : `Unlock this ${badgeLabel.toLowerCase()}`}
                      </h2>
                      <p className="mt-1 text-[12px] text-white/55">
                        {isOwned
                          ? "Fill placeholders and run in one click."
                          : "Access attaches to your Edgaze account."}
                      </p>
                    </div>

                    {isOwned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Owned
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    {!isOwned ? (
                      <BlurredPreview
                        text={listing.prompt_text || listing.title || ""}
                        kind={kind}
                      />
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
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-[11px] text-white/45">Price</div>
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
                      onClick={grantAccessOrRun}
                      disabled={
                        purchaseLoading ||
                        (listing?.type === "workflow" &&
                          isNaturallyFree &&
                          !userId &&
                          demoRunAllowed === false)
                      }
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold relative",
                        purchaseLoading ||
                          (listing?.type === "workflow" &&
                            isNaturallyFree &&
                            !userId &&
                            demoRunAllowed === false)
                          ? "bg-white/10 text-white/70 border border-white/10 opacity-60"
                          : "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 text-black shadow-[0_0_22px_rgba(56,189,248,0.75)]",
                      )}
                      title={
                        listing?.type === "workflow" &&
                        isNaturallyFree &&
                        !userId &&
                        demoRunAllowed === false
                          ? "You've already used your one-time demo. Each device and IP address combination gets one demo run."
                          : undefined
                      }
                    >
                      {purchaseLoading || checkingDemoRun ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isOwned ? (
                        <Sparkles className="h-4 w-4" />
                      ) : listing?.type === "workflow" &&
                        isNaturallyFree &&
                        !userId &&
                        demoRunAllowed === false ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : listing?.type === "workflow" &&
                        isNaturallyFree &&
                        !userId &&
                        (demoRunAllowed === true || demoRunAllowed === null) ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span className="flex items-center gap-1.5">
                        {isOwned
                          ? "Run now"
                          : listing?.type === "workflow" && isNaturallyFree && !userId
                            ? demoRunAllowed === false
                              ? "Used"
                              : "Run now"
                            : primaryCtaLabel}
                        {listing?.type === "workflow" &&
                          isNaturallyFree &&
                          !userId &&
                          demoRunAllowed === false && (
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                              Used
                            </span>
                          )}
                      </span>
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

                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:border-cyan-400/70"
                    >
                      <Share2 className="h-4 w-4" /> Share
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

                  {!isOwned && (
                    <div className="mt-3 text-[11px] text-white/45">
                      Full prompt unlocks after access is granted.
                    </div>
                  )}
                </section>

                <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/85">Up next</h3>
                    <span className="text-[11px] text-white/45">Marketplace</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {upNext.map((s) => {
                      const suggestionFree = s.monetisation_mode === "free" || s.is_paid === false;
                      const href =
                        s.owner_handle && s.edgaze_code
                          ? `/p/${s.owner_handle}/${s.edgaze_code}`
                          : null;
                      const suggestionPaidLabel = suggestionFree
                        ? "Free"
                        : s.price_usd != null
                          ? `$${s.price_usd.toFixed(2)}`
                          : "Paid";

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!href}
                          onClick={() => href && router.push(href)}
                          className={cn(
                            "group flex w-full items-start gap-3 text-left",
                            !href && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <div className="relative h-20 w-36 flex-none overflow-hidden rounded-xl bg-black/60 border border-white/10">
                            {s.thumbnail_url ? (
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
                            <p className="line-clamp-2 text-[13px] font-semibold text-white/90">
                              {s.title || "Untitled listing"}
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
                                      .join(" ")
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
