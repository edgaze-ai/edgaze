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
import CommentsSection from "../../../../components/marketplace/CommentsSection";

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
  // Keep labels short so nothing truncates on mobile.
  if (p === "edgaze") return { name: "Edgaze", sub: "Coming soon", icon: "/brand/edgaze-mark.png", kind: "internal" as const };
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

/* ---------- Share Modal ---------- */
function ShareModal({
  open,
  onClose,
  shareUrl,
  code,
  ownerHandle,
}: {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  code: string;
  ownerHandle: string;
}) {
  const [qrBusy, setQrBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCopied(false);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div className="relative w-[min(1120px,98vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={28} height={28} className="h-6 w-6 sm:h-7 sm:w-7" />
              <div>
                <div className="text-[13px] sm:text-[14px] font-semibold text-white">Share</div>
                <div className="hidden sm:block text-[11px] text-white/50">Share link, QR, and Edgaze code</div>
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
                    <div className="text-[34px] sm:text-[40px] font-semibold tracking-tight text-white leading-none">{code || "—"}</div>
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

                  <div className="mt-3 text-[11px] text-white/45">
                    URL uses <span className="text-white/70">edgaze.ai</span>.
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
                    <div className="h-[160px] w-[160px] sm:h-[210px] sm:w-[210px] overflow-hidden rounded-2xl bg-white/[0.03] grid place-items-center">
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
                      onClick={() => (qrDataUrl ? downloadDataUrl(qrDataUrl, `edgaze-qr-${code || "prompt"}.png`) : null)}
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
                </div>
              </div>

              <div className="col-span-12 sm:hidden text-[11px] text-white/45">QR + link are ready to share.</div>
            </div>
          </div>
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
          <div className="rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[10px] tracking-[0.15em] text-white/70">{label}</div>
          <div className="text-[11px] text-white/50">Full content stays protected.</div>
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

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    placeholders.forEach((p) => {
      init[p.key] = (p.default ?? "").toString();
    });
    setValues(init);
    setCopied(false);
    setProviderHint("chatgpt");
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

    // Always copy when a provider is clicked (so Cmd+V is instant fallback).
    if (filled.trim()) {
      const ok = await copyToClipboard(filled);
      setCopied(ok);
      setTimeout(() => setCopied(false), 900);
    }

    if (p === "edgaze") return;

    const url = buildProviderUrl(p, filled);
    if (!url) return;

    // Must be in click handler to avoid popup blocking
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-[140]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-[min(1120px,98vw)] max-h-[92vh] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.8)]">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white">Run</div>
              {/* FIX: no truncation; wrap nicely */}
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

          <div className="overflow-y-auto">
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-12 gap-4 sm:gap-5">
                <div className="col-span-12 lg:col-span-5">
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
                      <div className="mt-3 text-[12px] text-white/55">This prompt has no placeholders. You can run it as-is.</div>
                    ) : (
                      <div className="mt-3 space-y-3 max-h-[360px] lg:max-h-[440px] overflow-y-auto pr-1">
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
                                    {label}
                                    {required && <span className="ml-1 text-amber-300">*</span>}
                                  </div>
                                  {q && <div className="mt-1 text-[11px] text-white/55 leading-snug">{q}</div>}
                                </div>
                                <div className="text-[11px] text-white/40 whitespace-nowrap">
                                  {"{{"}
                                  {p.key}
                                  {"}}"}
                                </div>
                              </div>

                              <input
                                value={v}
                                onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                                placeholder={p.hint || ""}
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none focus:border-cyan-400/60"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {anyMissingRequired && <div className="mt-3 text-[11px] text-amber-300">Fill the required fields (*) for best results.</div>}
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-7">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-white/90">Generated prompt</div>
                        <div className="mt-1 text-[11px] text-white/55 leading-snug">
                          One click opens with prompt prefilled. Provider ignores it sometimes — paste (Cmd+V / Ctrl+V).
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyToClipboard(filled);
                          setCopied(ok);
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

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                                {/* FIX: no truncation; short names + optional subline */}
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

                    <div className="mt-3 rounded-3xl border border-white/10 bg-black/35 p-3 text-[11px] text-white/55">
                      <div className="flex items-start gap-2">
                        <ExternalLink className="h-4 w-4 mt-[1px] text-white/45" />
                        <div className="min-w-0">
                          <div className="text-white/80 font-semibold">Fallback (instant)</div>
                          <div className="mt-0.5 leading-snug">
                            Clicking a provider also copies the prompt.
                            <span className="text-white/70"> If the tab doesn’t open or prefill fails:</span> paste (Cmd+V / Ctrl+V) → send.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-white/40">Auto-submit differs by provider. Prefill + copy is the reliable path.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-[1px] bg-gradient-to-r from-cyan-400/40 via-white/10 to-pink-500/40" />
          </div>
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

      const record = data as PromptListing;
      setListing(record);
      setLoading(false);

      supabase
        .from("prompts")
        .update({ view_count: (record.view_count ?? 0) + 1 })
        .eq("id", record.id)
        .then()
        .catch(() => {});
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ownerHandle, edgazeCode, supabase]);

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

  async function grantAccessOrRun() {
    if (!listing) return;
    setPurchaseError(null);

    if (!requireAuth()) return;

    if (isOwned) {
      setRunOpen(true);
      return;
    }

    if (showClosedBetaFree) {
      setPurchaseLoading(true);
      try {
        const uid = userId!;
        const { data, error } = await supabase
          .from("prompt_purchases")
          .insert({
            buyer_id: uid,
            prompt_id: listing.id,
            status: "beta",
          })
          .select("id,status")
          .maybeSingle();

        if (error) {
          console.error("beta access insert error", error);
          setPurchaseError("Could not grant access. Check RLS policies for prompt_purchases (INSERT + SELECT).");
          return;
        }

        setPurchase((data as PurchaseRow) ?? null);
        setRunOpen(true);
        return;
      } finally {
        setPurchaseLoading(false);
      }
    }

    if (!isNaturallyFree) {
      setPurchaseError("Paid checkout not wired yet. Stripe should create prompt_purchases(status='paid') server-side.");
      return;
    }

    setRunOpen(true);
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

    const rows = (data ?? []) as PromptListing[];
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
          <p className="text-sm text-white/60">Loading listing…</p>
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
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      <RunModal open={runOpen} onClose={() => setRunOpen(false)} title={listing.title || "Untitled listing"} template={templatePrompt} placeholders={placeholders} />

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
              edgaze.ai/p/{listing.owner_handle}/{listing.edgaze_code}
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

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">
                {initialsFromName(listing.owner_name || listing.owner_handle)}
              </div>
              <div className="hidden flex-col sm:flex leading-tight">
                <span className="text-xs font-medium text-white/90">{listing.owner_name || "Creator"}</span>
                {listing.owner_handle && <span className="text-[11px] text-white/50">@{listing.owner_handle}</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} shareUrl={canonicalShareUrl} code={listing.edgaze_code || ""} ownerHandle={listing.owner_handle || ""} />

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
              <div className="mt-2 text-rose-100/70">
                Fix: prompt_purchases RLS must allow <span className="font-semibold">INSERT</span> and <span className="font-semibold">SELECT</span> for the buyer_id.
              </div>
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
                    <div className="flex h-full items-center justify-center px-6 text-center text-xs text-white/50">No demo images yet.</div>
                  )}
                </div>

                {demoImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMainDemoIndex((prev) => (prev === 0 ? demoImages.length - 1 : prev - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white hover:border-cyan-400"
                      aria-label="Previous"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMainDemoIndex((prev) => (prev === demoImages.length - 1 ? 0 : prev + 1))}
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
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Purchased
                    </span>
                  )}
                </div>

                <h1 className="text-[18px] sm:text-[22px] font-semibold leading-snug">{listing.title || "Untitled listing"}</h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {listing.view_count ?? 0} views
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {listing.like_count ?? 0} likes
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                    {initialsFromName(listing.owner_name || listing.owner_handle)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white/90">{listing.owner_name || "Creator"}</div>
                    <div className="truncate text-[12px] text-white/55">@{listing.owner_handle || "creator"}</div>
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
                  listingOwnerName={listing.owner_name}
                  listingOwnerHandle={listing.owner_handle}
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
                      <CommentsSection
                        listingId={listing.id}
                        listingOwnerId={listing.owner_id}
                        listingOwnerName={listing.owner_name}
                        listingOwnerHandle={listing.owner_handle}
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
                          listingOwnerName={listing.owner_name}
                          listingOwnerHandle={listing.owner_handle}
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
                                    .join("  ")
                                : ""}
                            </p>

                            <span className="text-[12px] font-semibold text-white/75">
                              {CLOSED_BETA && !suggestionFree ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="line-through decoration-white/40">{suggestionPaidLabel === "Paid" ? "$—" : suggestionPaidLabel}</span>
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
                      <h2 className="text-sm font-semibold">{isOwned ? `You own this ${badgeLabel.toLowerCase()}` : `Unlock this ${badgeLabel.toLowerCase()}`}</h2>
                      <p className="mt-1 text-[12px] text-white/55">{isOwned ? "Fill placeholders and run in one click." : "Access attaches to your Edgaze account."}</p>
                    </div>

                    {showClosedBetaFree && !isOwned && <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/60">Closed beta</span>}

                    {isOwned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Owned
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
                          <div>• Auto-copy fallback (Cmd+V)</div>
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
                        <div className="text-right text-[11px] text-white/45">Limited access drop</div>
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
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </div>

                  {!isOwned && <div className="mt-3 text-[11px] text-white/45">Full prompt stays protected until a purchase row exists.</div>}
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
                              <img src={s.thumbnail_url} alt={s.title || "Listing thumbnail"} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
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
                                      .join("  ")
                                  : ""}
                              </p>

                              <span className="text-[12px] font-semibold text-white/75">
                                {CLOSED_BETA && !suggestionFree ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="line-through decoration-white/40">{suggestionPaidLabel === "Paid" ? "$—" : suggestionPaidLabel}</span>
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
